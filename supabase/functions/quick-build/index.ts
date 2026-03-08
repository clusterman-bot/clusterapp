import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALPACA_API_KEY = Deno.env.get("ALPACA_API_KEY");
const ALPACA_API_SECRET = Deno.env.get("ALPACA_API_SECRET");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Fetch 1 year of OHLCV data — uses user's brokerage credentials for crypto via alpaca-trading function
async function fetchMarketData(ticker: string, userToken: string): Promise<OHLCVBar[]> {
  const isCrypto = ticker.includes("/");

  if (isCrypto) {
    return await fetchCryptoViaAlpacaTrading(ticker, userToken);
  }

  // For stocks, use server-side Alpaca keys
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    throw new Error("Alpaca credentials are not configured.");
  }
  return await fetchFromAlpaca(ticker);
}

// Fetch crypto bars by calling the alpaca-trading edge function (which uses the user's own brokerage keys)
async function fetchCryptoViaAlpacaTrading(ticker: string, userToken: string): Promise<OHLCVBar[]> {
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  const start = startDate.toISOString().split("T")[0];

  console.log(`[QuickBuild] Fetching crypto bars via alpaca-trading for ${ticker}`);

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/alpaca-trading/get-crypto-bars`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      isPaper: true,
      symbol: ticker,
      timeframe: "1Day",
      start,
      limit: 1000,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`[QuickBuild] alpaca-trading crypto bars error (${resp.status}): ${errText}`);
    throw new Error(`Failed to fetch crypto market data: ${errText}`);
  }

  const data = await resp.json();
  if (!data.success || !data.bars?.length) {
    throw new Error(`No crypto market data returned for ${ticker}`);
  }

  console.log(`[QuickBuild] Got ${data.bars.length} crypto bars via alpaca-trading`);
  return data.bars.map((bar: any) => ({
    date: bar.date.split("T")[0],
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
}

async function fetchFromAlpaca(ticker: string): Promise<OHLCVBar[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

  const baseUrl = `https://data.alpaca.markets/v2/stocks/${ticker}/bars?timeframe=1Day&start=${start}&end=${end}&limit=1000&adjustment=raw&sort=asc`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[QuickBuild] Fetching from Alpaca (attempt ${attempt}/3): ${ticker}`);
    const resp = await fetch(baseUrl, {
      headers: {
        "APCA-API-KEY-ID": ALPACA_API_KEY!,
        "APCA-API-SECRET-KEY": ALPACA_API_SECRET!,
      },
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[QuickBuild] Alpaca HTTP ${resp.status}: ${errText}`);
      if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
      throw new Error(`Alpaca API error (${resp.status}): ${errText}`);
    }
    const data = await resp.json();
    const bars = data.bars;
    if (bars && bars.length > 0) {
      console.log(`[QuickBuild] Got ${bars.length} bars from Alpaca`);
      return bars.map((bar: any) => ({
        date: bar.t.split("T")[0],
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));
    }
    console.warn(`[QuickBuild] Alpaca returned no bars (attempt ${attempt}/3)`);
    if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
    throw new Error(`No market data returned from Alpaca for ${ticker}`);
  }
  throw new Error("Failed to fetch live market data from Alpaca after 3 attempts");
}

// Compute summary statistics from OHLCV data
function computeDataStats(bars: OHLCVBar[]) {
  const closes = bars.map((b) => b.close);
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance);

  // Simple trend: compare SMA50 vs SMA200
  const sma = (arr: number[], w: number) =>
    arr.length >= w ? arr.slice(-w).reduce((s, v) => s + v, 0) / w : null;
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const trend = sma50 && sma200 ? (sma50 > sma200 ? "bullish" : "bearish") : "neutral";

  // Max drawdown
  let peak = closes[0];
  let maxDD = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = (peak - c) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Mean-reversion score: autocorrelation of returns at lag 1
  const meanRevScore =
    returns.length > 1
      ? returns.slice(1).reduce((s, r, i) => s + r * returns[i], 0) /
        (returns.length - 1) /
        (variance || 1)
      : 0;

  return {
    total_bars: bars.length,
    avg_daily_return: +(avgReturn * 100).toFixed(4),
    volatility: +(volatility * 100).toFixed(4),
    max_drawdown: +(maxDD * 100).toFixed(2),
    trend,
    mean_reversion_score: +meanRevScore.toFixed(4),
    price_range: { low: Math.min(...closes), high: Math.max(...closes) },
    start_date: bars[0]?.date,
    end_date: bars[bars.length - 1]?.date,
  };
}

// Call Lovable AI to determine optimal indicators and hyperparameters
async function aiAnalyze(ticker: string, stats: any, platformContext: string = "") {
  const systemPrompt = `You are an expert quantitative analyst. Given summary statistics of a stock's historical price data, determine the optimal technical indicators, their parameters, and ML model hyperparameters for building a trading signal model. You may also generate custom JavaScript indicators using the signature \`(bars) => number\` where bars is an array of \`{date, open, high, low, close, volume}\`. Use these for calculations not covered by the native indicators — e.g., VWAP, ATR, custom momentum, volume-price patterns, or stock-specific signals. You must respond using the suggest_config tool.${platformContext}`;

  const userPrompt = `Analyze ${ticker} with these characteristics:
- ${stats.total_bars} trading days of data (${stats.start_date} to ${stats.end_date})
- Avg daily return: ${stats.avg_daily_return}%
- Volatility: ${stats.volatility}%
- Max drawdown: ${stats.max_drawdown}%
- Trend: ${stats.trend}
- Mean-reversion score: ${stats.mean_reversion_score}
- Price range: $${stats.price_range.low} - $${stats.price_range.high}

Determine which indicators to enable and their optimal parameters. Also set hyperparameters for Random Forest, Gradient Boosting, and Logistic Regression models. Choose an appropriate training/validation split (roughly 80/20). Set horizon (prediction lookahead in minutes, 5-60) and theta (signal threshold 0.005-0.05). Explain your reasoning.`;

  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "suggest_config",
          description: "Return optimal indicator config, hyperparameters, date splits, and reasoning.",
          parameters: {
            type: "object",
            properties: {
              indicators: {
                type: "object",
                properties: {
                  sma: {
                    type: "object",
                    properties: {
                      enabled: { type: "boolean" },
                      windows: { type: "array", items: { type: "number" } },
                    },
                    required: ["enabled", "windows"],
                  },
                  rsi: {
                    type: "object",
                    properties: {
                      enabled: { type: "boolean" },
                      period: { type: "number" },
                    },
                    required: ["enabled", "period"],
                  },
                  bollinger: {
                    type: "object",
                    properties: {
                      enabled: { type: "boolean" },
                      window: { type: "number" },
                      std: { type: "number" },
                    },
                    required: ["enabled", "window", "std"],
                  },
                  volatility: {
                    type: "object",
                    properties: {
                      enabled: { type: "boolean" },
                      window: { type: "number" },
                    },
                    required: ["enabled", "window"],
                  },
                  sma_deviation: {
                    type: "object",
                    properties: { enabled: { type: "boolean" } },
                    required: ["enabled"],
                  },
                },
                required: ["sma", "rsi", "bollinger", "volatility", "sma_deviation"],
              },
              hyperparameters: {
                type: "object",
                properties: {
                  random_forest: {
                    type: "object",
                    properties: {
                      n_estimators: { type: "number" },
                      max_depth: { type: "number" },
                      min_samples_split: { type: "number" },
                    },
                    required: ["n_estimators", "max_depth", "min_samples_split"],
                  },
                  gradient_boosting: {
                    type: "object",
                    properties: {
                      n_estimators: { type: "number" },
                      learning_rate: { type: "number" },
                      max_depth: { type: "number" },
                    },
                    required: ["n_estimators", "learning_rate", "max_depth"],
                  },
                  logistic_regression: {
                    type: "object",
                    properties: {
                      C: { type: "number" },
                      max_iter: { type: "number" },
                    },
                    required: ["C", "max_iter"],
                  },
                },
                required: ["random_forest", "gradient_boosting", "logistic_regression"],
              },
              training_date_range: {
                type: "object",
                properties: {
                  start: { type: "string" },
                  end: { type: "string" },
                },
                required: ["start", "end"],
              },
              validation_date_range: {
                type: "object",
                properties: {
                  start: { type: "string" },
                  end: { type: "string" },
                },
                required: ["start", "end"],
              },
              horizon: { type: "number" },
              theta: { type: "number" },
              reasoning: { type: "string" },
              custom_indicators: {
                type: "array",
                description: "Optional custom JavaScript indicators using the (bars) => number signature. Each bar has {date, open, high, low, close, volume}. Use for calculations not covered by native indicators like VWAP, ATR, momentum oscillators, volume-price patterns.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Short snake_case name for the indicator, e.g. vwap_ratio" },
                    description: { type: "string", description: "Brief explanation of what this indicator measures" },
                    code: { type: "string", description: "JavaScript function body as a string, must follow (bars) => number signature" },
                  },
                  required: ["name", "description", "code"],
                },
              },
            },
            required: [
              "indicators",
              "hyperparameters",
              "training_date_range",
              "validation_date_range",
              "horizon",
              "theta",
              "reasoning",
            ],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "suggest_config" } },
  };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI analysis failed (${resp.status}): ${t}`);
  }

  const result = await resp.json();
  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI did not return tool call result");
  }

  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Authenticate
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { symbol } = await req.json();
    if (!symbol) {
      return new Response(JSON.stringify({ error: "symbol is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upperSymbol = symbol.toUpperCase();
    console.log(`[QuickBuild] Starting for ${upperSymbol}, user ${user.id}`);

    // 1. Create quick_build_runs record
    const { data: run, error: insertErr } = await supabase
      .from("quick_build_runs")
      .insert({
        user_id: user.id,
        symbol: upperSymbol,
        status: "analyzing",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    console.log(`[QuickBuild] Created run ${run.id}`);

    // 2. Fetch market data (pass user token for crypto brokerage auth)
    const bars = await fetchMarketData(upperSymbol, token);
    console.log(`[QuickBuild] Fetched ${bars.length} bars`);

    if (bars.length < 30) {
      await supabase
        .from("quick_build_runs")
        .update({ status: "failed", error_message: "Insufficient market data (need at least 30 trading days)" })
        .eq("id", run.id);
      return new Response(JSON.stringify({ error: "Insufficient market data", run_id: run.id }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Compute stats, fetch platform knowledge, and run AI analysis
    const stats = computeDataStats(bars);
    console.log(`[QuickBuild] Stats:`, JSON.stringify(stats));

    // Fetch platform knowledge for this symbol
    let platformContext = "";
    try {
      const pkResp = await fetch(`${SUPABASE_URL}/functions/v1/strategy-knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ action: "query", symbol: upperSymbol }),
      });
      if (pkResp.ok) {
        const pkData = await pkResp.json();
        if (pkData.total_entries > 0 && pkData.summary) {
          const s = pkData.summary;
          platformContext = `\n\nPLATFORM INTELLIGENCE: ${pkData.total_entries} strategies built for ${upperSymbol}.`;
          if (s.avg_sharpe != null) platformContext += ` Avg Sharpe: ${s.avg_sharpe}.`;
          if (s.avg_win_rate != null) platformContext += ` Avg win rate: ${(s.avg_win_rate * 100).toFixed(1)}%.`;
          if (s.common_pitfalls?.length > 0) platformContext += ` Pitfalls: ${s.common_pitfalls.join("; ")}.`;
        }
      }
    } catch (e) {
      console.warn("[QuickBuild] Platform knowledge fetch failed:", e);
    }

    let aiConfig: any;
    try {
      aiConfig = await aiAnalyze(upperSymbol, stats, platformContext);
      console.log(`[QuickBuild] AI config received`);
    } catch (aiErr: any) {
      console.error("[QuickBuild] AI analysis failed:", aiErr.message);
      // Fallback to sensible defaults
      const splitIdx = Math.floor(bars.length * 0.8);
      aiConfig = {
        indicators: {
          sma: { enabled: true, windows: [5, 20] },
          rsi: { enabled: true, period: 14 },
          bollinger: { enabled: true, window: 20, std: 2 },
          volatility: { enabled: true, window: 20 },
          sma_deviation: { enabled: true },
        },
        hyperparameters: {
          random_forest: { n_estimators: 100, max_depth: 10, min_samples_split: 5 },
          gradient_boosting: { n_estimators: 100, learning_rate: 0.1, max_depth: 5 },
          logistic_regression: { C: 1.0, max_iter: 1000 },
        },
        training_date_range: { start: bars[0].date, end: bars[splitIdx].date },
        validation_date_range: { start: bars[splitIdx + 1].date, end: bars[bars.length - 1].date },
        horizon: 15,
        theta: 0.01,
        reasoning: "Using default configuration as AI analysis was unavailable.",
      };
    }

    // Merge custom indicators into the indicators config
    const indicatorsWithCustom = {
      ...aiConfig.indicators,
      ...(aiConfig.custom_indicators?.length ? { custom_indicators: aiConfig.custom_indicators } : {}),
    };

    // Update run with AI analysis
    await supabase
      .from("quick_build_runs")
      .update({
        status: "training",
        ai_analysis: { reasoning: aiConfig.reasoning, stats },
        indicators_config: indicatorsWithCustom,
        hyperparameters: aiConfig.hyperparameters,
        training_period: `${aiConfig.training_date_range.start} to ${aiConfig.training_date_range.end}`,
        validation_period: `${aiConfig.validation_date_range.start} to ${aiConfig.validation_date_range.end}`,
      })
      .eq("id", run.id);

    // 4. Create training run via ml-backend
    const { data: trainingRun, error: trainInsertErr } = await supabase
      .from("training_runs")
      .insert({
        user_id: user.id,
        ticker: upperSymbol,
        start_date: aiConfig.training_date_range.start,
        end_date: aiConfig.training_date_range.end,
        indicators_enabled: indicatorsWithCustom,
        hyperparameters: {
          ...aiConfig.hyperparameters,
          horizon_minutes: aiConfig.horizon,
        },
        status: "pending",
      })
      .select()
      .single();

    if (trainInsertErr) throw trainInsertErr;

    // Link training run
    await supabase
      .from("quick_build_runs")
      .update({ training_run_id: trainingRun.id })
      .eq("id", run.id);

    console.log(`[QuickBuild] Created training run ${trainingRun.id}`);

    // 5. Trigger real training via the ml-backend edge function (internal call)
    console.log("[QuickBuild] Invoking ml-backend for real training");
    try {
      const mlResp = await fetch(`${SUPABASE_URL}/functions/v1/ml-backend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          training_run_id: trainingRun.id,
          ticker: upperSymbol,
          start_date: aiConfig.training_date_range.start,
          end_date: aiConfig.training_date_range.end,
          horizon: aiConfig.horizon,
          theta: aiConfig.theta,
          indicators: indicatorsWithCustom,
          hyperparameters: aiConfig.hyperparameters,
        }),
      });
      if (!mlResp.ok) {
        const errText = await mlResp.text();
        console.error("[QuickBuild] ml-backend error:", errText);
        throw new Error(`ml-backend returned ${mlResp.status}`);
      }
    } catch (e: any) {
      console.error("[QuickBuild] Failed to trigger ml-backend:", e.message);
      await supabase.from("quick_build_runs").update({ status: "failed", error_message: `Training failed: ${e.message}` }).eq("id", run.id);
      throw e;
    }

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        training_run_id: trainingRun.id,
        message: "Quick Build started",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[QuickBuild] Error:", err);
    return new Response(JSON.stringify({ error: "An error occurred during Quick Build" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Simulation removed — all training uses real ml-backend pipeline
