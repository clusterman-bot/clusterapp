import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a trading strategy configuration assistant. Users describe trading strategies in plain English, and you generate structured configuration for an automated trading system.

The system supports these technical indicators:
- RSI (Relative Strength Index): periods array (e.g. [14]), with oversold (10-50, default 30) and overbought (50-90, default 70) thresholds
- SMA (Simple Moving Average): windows array (e.g. [5, 20])
- EMA (Exponential Moving Average): windows array (e.g. [5, 20])
- Bollinger Bands: window (5-50, default 20), std deviations (1-4, default 2)
- SMA Deviation: window (5-50, default 20)

Risk management parameters:
- stop_loss_percent: 1-50 (default 5)
- take_profit_percent: 1-100 (default 15)
- position_size_percent: 1-100 (default 10)
- max_quantity: 1-1000 shares (default 10)
- theta: 0.01-0.10, the minimum composite score to trigger a trade (default 0.01)
- horizon_minutes: 1-60, bar timeframe for indicator calculation (default 5)
- allow_shorting: true/false (default false)

Always enable at least one indicator. Extract the ticker symbol from the user's prompt. If no ticker is mentioned, ask for one. Use the generate_strategy tool to return the configuration.`;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
      // AI responded with text instead of tool call - return the message
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

    return new Response(JSON.stringify({ type: "strategy", config }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-strategy-builder error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
