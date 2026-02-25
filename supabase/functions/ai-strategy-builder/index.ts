import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a trading strategy configuration assistant. Users describe trading strategies in plain English, and you generate structured configuration for an automated trading system.

The system has 5 BUILT-IN indicators (use these when the user requests them):
- RSI (Relative Strength Index): periods array (e.g. [14]), with oversold (10-50, default 30) and overbought (50-90, default 70) thresholds
- SMA (Simple Moving Average): windows array (e.g. [5, 20])
- EMA (Exponential Moving Average): windows array (e.g. [5, 20])
- Bollinger Bands: window (5-50, default 20), std deviations (1-4, default 2)
- SMA Deviation: window (5-50, default 20)

For ANY indicator NOT in the built-in list (e.g. MACD, VWAP, Stochastic, ATR, Williams %R, CCI, Ichimoku, Donchian, Keltner, MFI, OBV, etc.), you MUST generate a custom_indicators entry with executable JavaScript code.

CUSTOM INDICATOR RULES:
- The code field must be a complete self-contained JavaScript function: (bars) => number
- bars is an array of objects with fields: { o: number, h: number, l: number, c: number, v: number, t: string }
- The function must return: +1 (BUY signal), -1 (SELL signal), or 0 (NEUTRAL)
- No imports, no fetch, no external calls — pure computation only
- Return 0 if there is not enough data
- The code will be executed as: new Function('bars', code)(bars) — make sure code is the function BODY, not the full arrow function

Risk management parameters:
- stop_loss_percent: 1-50 (default 5)
- take_profit_percent: 1-100 (default 15)
- position_size_percent: 1-100 (default 10)
- max_quantity: 1-1000 shares (default 10)
- theta: 0.01-0.10, the minimum composite score to trigger a trade (default 0.01)
- horizon_minutes: 1-60, bar timeframe for indicator calculation (default 5)
- allow_shorting: true/false (default false)

Always enable at least one indicator (built-in or custom). Extract the ticker symbol from the user's prompt. If no ticker is mentioned, ask for one. Use the generate_strategy tool to return the configuration.

IMPORTANT: For custom indicators, the code field must be the FUNCTION BODY (what goes inside the function), NOT the arrow function syntax. For example, for MACD:
const closes = bars.map(b => b.c);
if (closes.length < 35) return 0;
const ema = (data, p) => { const k = 2/(p+1); let e = data.slice(0,p).reduce((a,b)=>a+b,0)/p; for(let i=p;i<data.length;i++) e=data[i]*k+e*(1-k); return e; };
const fast = ema(closes, 12); const slow = ema(closes, 26);
const prevFast = ema(closes.slice(0,-1), 12); const prevSlow = ema(closes.slice(0,-1), 26);
const macd = fast - slow; const prevMacd = prevFast - prevSlow;
const signal = ema([prevMacd, macd], 9);
if (macd > signal && prevMacd <= signal) return 1;
if (macd < signal && prevMacd >= signal) return -1;
return 0;`;

const STRATEGY_TOOL = {
  type: "function",
  function: {
    name: "generate_strategy",
    description: "Generate a complete trading automation configuration from the user's strategy description.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker symbol (e.g. AAPL, TSLA)" },
        strategy_summary: { type: "string", description: "Brief plain-English summary of the strategy" },
        indicators: {
          type: "object",
          properties: {
            rsi: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                periods: { type: "array", items: { type: "integer" } },
              },
              required: ["enabled", "periods"],
            },
            sma: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                windows: { type: "array", items: { type: "integer" } },
              },
              required: ["enabled", "windows"],
            },
            ema: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                windows: { type: "array", items: { type: "integer" } },
              },
              required: ["enabled", "windows"],
            },
            bollinger: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                window: { type: "integer" },
                std: { type: "number" },
              },
              required: ["enabled", "window", "std"],
            },
            sma_deviation: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                window: { type: "integer" },
              },
              required: ["enabled", "window"],
            },
          },
          required: ["rsi", "sma", "ema", "bollinger", "sma_deviation"],
        },
        custom_indicators: {
          type: "array",
          description: "AI-generated custom indicators for indicators not in the built-in list",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Display name of the indicator (e.g. MACD, VWAP)" },
              description: { type: "string", description: "What this indicator measures" },
              signal_logic: { type: "string", description: "Plain-English explanation of buy/sell logic" },
              code: { type: "string", description: "JavaScript function BODY (not arrow function). Receives 'bars' array. Must return +1, -1, or 0." },
              weight: { type: "number", description: "Relative weight in composite score (default 1.0)" },
              enabled: { type: "boolean" },
            },
            required: ["name", "description", "signal_logic", "code", "weight", "enabled"],
          },
        },
        rsi_oversold: { type: "number" },
        rsi_overbought: { type: "number" },
        horizon_minutes: { type: "integer" },
        theta: { type: "number" },
        position_size_percent: { type: "number" },
        max_quantity: { type: "integer" },
        stop_loss_percent: { type: "number" },
        take_profit_percent: { type: "number" },
        allow_shorting: { type: "boolean" },
      },
      required: ["symbol", "strategy_summary", "indicators", "rsi_oversold", "rsi_overbought", "horizon_minutes", "theta", "position_size_percent", "max_quantity", "stop_loss_percent", "take_profit_percent", "allow_shorting"],
      additionalProperties: false,
    },
  },
};

// Fetch platform intelligence for a symbol
async function fetchPlatformKnowledge(symbol: string): Promise<{ prompt_section: string; total: number } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return null;

    const resp = await fetch(`${supabaseUrl}/functions/v1/strategy-knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ action: "query", symbol: symbol.toUpperCase() }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || data.total_entries === 0) return null;

    const s = data.summary;
    const parts: string[] = [];
    parts.push(`\nPLATFORM INTELLIGENCE for ${symbol.toUpperCase()}:`);
    parts.push(`- ${data.total_entries} strategies have been built for this symbol on the platform`);
    if (s?.avg_sharpe != null) parts.push(`- Average Sharpe of successful strategies: ${s.avg_sharpe}`);
    if (s?.avg_win_rate != null) parts.push(`- Average win rate: ${(s.avg_win_rate * 100).toFixed(1)}%`);
    if (s?.best_indicator_combo) {
      const top = Object.entries(s.best_indicator_combo).sort(([,a]: any,[,b]: any) => b - a).slice(0,3).map(([k]) => k);
      parts.push(`- Top-performing indicator combinations: ${top.join(", ")}`);
    }
    if (s?.common_pitfalls?.length > 0) parts.push(`- Common pitfalls to avoid: ${s.common_pitfalls.join("; ")}`);
    if (data.top_entries?.length > 0) {
      const configs = data.top_entries.slice(0, 3).map((e: any) => JSON.stringify(e.risk_params)).join(", ");
      parts.push(`- Recent high-performing configs: ${configs}`);
    }
    parts.push(`\nUse this data to inform your strategy generation. Prefer indicator combinations and parameter ranges that have historically performed well on this platform.`);

    return { prompt_section: parts.join("\n"), total: data.total_entries };
  } catch (e) {
    console.error("[ai-strategy-builder] Platform knowledge fetch failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract symbol from user messages for platform knowledge lookup
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const symbolMatch = lastUserMsg.match(/\b([A-Z]{1,5})\b/);
    const detectedSymbol = symbolMatch?.[1];

    let systemPromptFinal = SYSTEM_PROMPT;
    let platformTotal = 0;
    if (detectedSymbol) {
      const knowledge = await fetchPlatformKnowledge(detectedSymbol);
      if (knowledge) {
        systemPromptFinal += "\n" + knowledge.prompt_section;
        platformTotal = knowledge.total;
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPromptFinal },
          ...messages,
        ],
        tools: [STRATEGY_TOOL],
        tool_choice: { type: "function", function: { name: "generate_strategy" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "generate_strategy") {
      const textContent = data.choices?.[0]?.message?.content || "I couldn't generate a strategy from that. Please describe your trading strategy including the stock ticker.";
      return new Response(JSON.stringify({ type: "message", content: textContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = JSON.parse(toolCall.function.arguments);

    // Validate
    config.symbol = (config.symbol || "").toUpperCase();
    if (!config.symbol) {
      return new Response(JSON.stringify({ type: "message", content: "Please specify a stock ticker symbol (e.g. AAPL, TSLA)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clamp values
    config.rsi_oversold = Math.max(10, Math.min(50, config.rsi_oversold ?? 30));
    config.rsi_overbought = Math.max(50, Math.min(90, config.rsi_overbought ?? 70));
    config.horizon_minutes = Math.max(1, Math.min(60, config.horizon_minutes ?? 5));
    config.theta = Math.max(0.01, Math.min(0.10, config.theta ?? 0.01));
    config.position_size_percent = Math.max(1, Math.min(100, config.position_size_percent ?? 10));
    config.max_quantity = Math.max(1, Math.min(1000, config.max_quantity ?? 10));
    config.stop_loss_percent = Math.max(1, Math.min(50, config.stop_loss_percent ?? 5));
    config.take_profit_percent = Math.max(1, Math.min(100, config.take_profit_percent ?? 15));

    // Normalize custom indicators
    if (config.custom_indicators && Array.isArray(config.custom_indicators)) {
      config.custom_indicators = config.custom_indicators.map((ci: any) => ({
        ...ci,
        weight: Math.max(0.1, Math.min(5.0, ci.weight ?? 1.0)),
        enabled: ci.enabled !== false,
      }));
    } else {
      config.custom_indicators = [];
    }

    // Ingest this strategy into the knowledge base (fire-and-forget)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/functions/v1/strategy-knowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            action: "ingest",
            symbol: config.symbol,
            source_type: "ai_builder",
            indicators_used: config.indicators,
            risk_params: {
              theta: config.theta,
              stop_loss: config.stop_loss_percent,
              take_profit: config.take_profit_percent,
              position_size: config.position_size_percent,
              horizon: config.horizon_minutes,
            },
            custom_indicator_names: (config.custom_indicators || []).map((ci: any) => ci.name),
          }),
        }).catch(() => {});
      }
    } catch {}

    return new Response(JSON.stringify({ type: "strategy", config, platform_strategies: platformTotal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-strategy-builder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
