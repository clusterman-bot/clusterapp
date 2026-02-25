import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // ==================== INGEST ====================
    if (action === "ingest") {
      const {
        symbol,
        source_type,
        indicators_used,
        risk_params,
        custom_indicator_names,
        outcome_metrics,
        optimization_delta,
        tags,
      } = body;

      if (!symbol || !source_type) {
        return new Response(
          JSON.stringify({ error: "symbol and source_type required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Auto-generate tags if not provided
      let finalTags = tags || [];
      if (finalTags.length === 0 && indicators_used) {
        // Simple tag derivation from indicators
        const ind = indicators_used;
        if (ind.rsi?.enabled) finalTags.push("momentum");
        if (ind.bollinger?.enabled) finalTags.push("volatility");
        if (ind.sma?.enabled || ind.ema?.enabled) finalTags.push("trend_following");
        if (ind.sma_deviation?.enabled) finalTags.push("mean_reversion");
        if (ind.custom?.length > 0 || (custom_indicator_names && custom_indicator_names.length > 0)) {
          finalTags.push("custom_indicators");
        }
      }

      const { error: insertErr } = await supabase.from("strategy_knowledge").insert({
        symbol: symbol.toUpperCase(),
        source_type,
        indicators_used: indicators_used || {},
        risk_params: risk_params || {},
        custom_indicator_names: custom_indicator_names || [],
        outcome_metrics: outcome_metrics || null,
        optimization_delta: optimization_delta || null,
        tags: finalTags,
      });

      if (insertErr) {
        console.error("[StrategyKnowledge] Insert error:", insertErr);
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if we should refresh summaries (every 10 new entries for this symbol)
      const { count } = await supabase
        .from("strategy_knowledge")
        .select("id", { count: "exact", head: true })
        .eq("symbol", symbol.toUpperCase());

      if (count && count % 10 === 0) {
        // Trigger summary refresh inline
        await refreshSummaryForSymbol(supabase, symbol.toUpperCase());
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== QUERY ====================
    if (action === "query") {
      const { symbol } = body;
      if (!symbol) {
        return new Response(
          JSON.stringify({ error: "symbol required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const upperSymbol = symbol.toUpperCase();

      // Get summary
      const { data: summary } = await supabase
        .from("knowledge_summaries")
        .select("*")
        .eq("symbol", upperSymbol)
        .single();

      // Get top 10 recent entries with outcome metrics, ordered by sharpe
      const { data: topEntries } = await supabase
        .from("strategy_knowledge")
        .select("*")
        .eq("symbol", upperSymbol)
        .not("outcome_metrics", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      // Get total count for this symbol
      const { count: totalCount } = await supabase
        .from("strategy_knowledge")
        .select("id", { count: "exact", head: true })
        .eq("symbol", upperSymbol);

      return new Response(
        JSON.stringify({
          symbol: upperSymbol,
          summary: summary || null,
          total_entries: totalCount || 0,
          top_entries: topEntries || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== REFRESH-SUMMARIES ====================
    if (action === "refresh-summaries") {
      const { symbol } = body;

      if (symbol) {
        await refreshSummaryForSymbol(supabase, symbol.toUpperCase());
      } else {
        // Refresh all symbols that have entries
        const { data: symbols } = await supabase
          .from("strategy_knowledge")
          .select("symbol")
          .limit(1000);

        const uniqueSymbols = [...new Set((symbols || []).map((s: any) => s.symbol))];
        for (const sym of uniqueSymbols) {
          await refreshSummaryForSymbol(supabase, sym);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[StrategyKnowledge] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function refreshSummaryForSymbol(supabase: any, symbol: string) {
  // Get all entries for this symbol
  const { data: entries, error } = await supabase
    .from("strategy_knowledge")
    .select("*")
    .eq("symbol", symbol)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !entries || entries.length === 0) return;

  const totalStrategies = entries.length;

  // Filter entries with outcome metrics
  const withOutcomes = entries.filter((e: any) => e.outcome_metrics);

  let avgSharpe: number | null = null;
  let avgWinRate: number | null = null;

  if (withOutcomes.length > 0) {
    const sharpes = withOutcomes
      .map((e: any) => e.outcome_metrics?.sharpe_ratio)
      .filter((v: any) => typeof v === "number");
    const winRates = withOutcomes
      .map((e: any) => e.outcome_metrics?.win_rate)
      .filter((v: any) => typeof v === "number");

    avgSharpe = sharpes.length > 0
      ? +(sharpes.reduce((a: number, b: number) => a + b, 0) / sharpes.length).toFixed(3)
      : null;
    avgWinRate = winRates.length > 0
      ? +(winRates.reduce((a: number, b: number) => a + b, 0) / winRates.length).toFixed(3)
      : null;
  }

  // Find most common indicator combination among top performers
  const topPerformers = withOutcomes
    .filter((e: any) => e.outcome_metrics?.sharpe_ratio != null)
    .sort((a: any, b: any) => (b.outcome_metrics.sharpe_ratio || 0) - (a.outcome_metrics.sharpe_ratio || 0))
    .slice(0, Math.max(1, Math.ceil(withOutcomes.length * 0.2)));

  let bestIndicatorCombo: any = null;
  let bestParams: any = null;

  if (topPerformers.length > 0) {
    // Count which indicators are most commonly enabled
    const indicatorCounts: Record<string, number> = {};
    for (const tp of topPerformers) {
      const ind = tp.indicators_used || {};
      for (const [key, val] of Object.entries(ind)) {
        if ((val as any)?.enabled) {
          indicatorCounts[key] = (indicatorCounts[key] || 0) + 1;
        }
      }
    }
    bestIndicatorCombo = indicatorCounts;

    // Average risk params from top performers
    const riskKeys = ["theta", "stop_loss", "take_profit", "position_size", "horizon"];
    const avgParams: Record<string, number> = {};
    for (const key of riskKeys) {
      const vals = topPerformers
        .map((tp: any) => tp.risk_params?.[key])
        .filter((v: any) => typeof v === "number");
      if (vals.length > 0) {
        avgParams[key] = +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(3);
      }
    }
    bestParams = Object.keys(avgParams).length > 0 ? avgParams : null;
  }

  // Collect common pitfalls (strategies with negative sharpe or low win rate)
  const poorPerformers = withOutcomes.filter(
    (e: any) =>
      (e.outcome_metrics?.sharpe_ratio != null && e.outcome_metrics.sharpe_ratio < 0) ||
      (e.outcome_metrics?.win_rate != null && e.outcome_metrics.win_rate < 0.35)
  );
  const commonPitfalls: string[] = [];
  if (poorPerformers.length > 0) {
    const poorIndicators: Record<string, number> = {};
    for (const pp of poorPerformers) {
      const ind = pp.indicators_used || {};
      for (const [key, val] of Object.entries(ind)) {
        if ((val as any)?.enabled) {
          poorIndicators[key] = (poorIndicators[key] || 0) + 1;
        }
      }
    }
    for (const [key, count] of Object.entries(poorIndicators)) {
      if (count >= 2) {
        commonPitfalls.push(`${key} alone often underperforms for ${symbol}`);
      }
    }
    if (poorPerformers.some((p: any) => p.risk_params?.stop_loss > 10)) {
      commonPitfalls.push("Wide stop losses (>10%) tend to underperform");
    }
  }

  // Build summary text for prompt injection
  const summaryParts: string[] = [];
  summaryParts.push(`${totalStrategies} strategies have been built for ${symbol} on the platform.`);
  if (avgSharpe !== null) summaryParts.push(`Average Sharpe ratio: ${avgSharpe}.`);
  if (avgWinRate !== null) summaryParts.push(`Average win rate: ${(avgWinRate * 100).toFixed(1)}%.`);
  if (bestIndicatorCombo) {
    const top3 = Object.entries(bestIndicatorCombo)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 3)
      .map(([k]) => k);
    summaryParts.push(`Top-performing indicators: ${top3.join(", ")}.`);
  }
  if (commonPitfalls.length > 0) {
    summaryParts.push(`Common pitfalls: ${commonPitfalls.join("; ")}.`);
  }

  const summaryText = summaryParts.join(" ");

  // Upsert the summary
  const { error: upsertErr } = await supabase
    .from("knowledge_summaries")
    .upsert(
      {
        symbol,
        total_strategies: totalStrategies,
        avg_sharpe: avgSharpe,
        avg_win_rate: avgWinRate,
        best_indicator_combo: bestIndicatorCombo,
        best_params: bestParams,
        common_pitfalls: commonPitfalls,
        summary_text: summaryText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "symbol" }
    );

  if (upsertErr) {
    console.error(`[StrategyKnowledge] Failed to upsert summary for ${symbol}:`, upsertErr);
  } else {
    console.log(`[StrategyKnowledge] Refreshed summary for ${symbol}: ${totalStrategies} strategies`);
  }
}
