import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, automation_id } = await req.json();

    if (!automation_id) {
      return new Response(JSON.stringify({ error: 'automation_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the automation
    const { data: automation, error: autoErr } = await supabaseAdmin
      .from('stock_automations')
      .select('*')
      .eq('id', automation_id)
      .single();

    if (autoErr || !automation) {
      return new Response(JSON.stringify({ error: 'Automation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== CHECK-HEALTH ====================
    if (action === 'check-health') {
      const { data: signals } = await supabaseAdmin
        .from('automation_signals')
        .select('signal_type, trade_executed, created_at, price_at_signal, executed_price')
        .eq('automation_id', automation_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!signals || signals.length < 5) {
        return new Response(JSON.stringify({
          breached: false,
          reason: 'insufficient_data',
          metrics: { win_rate: null, drawdown: null, consecutive_losses: 0, total_signals: signals?.length || 0 },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Calculate win rate from executed trades
      const executedTrades = signals.filter((s: any) => s.trade_executed && s.executed_price && s.price_at_signal);
      const buySignals = executedTrades.filter((s: any) => s.signal_type === 'BUY');
      const sellSignals = executedTrades.filter((s: any) => s.signal_type === 'SELL');

      // Pair buy/sell to compute wins
      let wins = 0, losses = 0;
      const pairs = Math.min(buySignals.length, sellSignals.length);
      for (let i = 0; i < pairs; i++) {
        const buyPrice = buySignals[i].executed_price || buySignals[i].price_at_signal;
        const sellPrice = sellSignals[i].executed_price || sellSignals[i].price_at_signal;
        if (sellPrice > buyPrice) wins++;
        else losses++;
      }
      const totalPairs = wins + losses;
      const winRate = totalPairs > 0 ? wins / totalPairs : null;

      // Consecutive losses (most recent first)
      let consecutiveLosses = 0;
      for (let i = 0; i < Math.min(buySignals.length, sellSignals.length); i++) {
        const buyPrice = buySignals[i].executed_price || buySignals[i].price_at_signal;
        const sellPrice = sellSignals[i].executed_price || sellSignals[i].price_at_signal;
        if (sellPrice < buyPrice) consecutiveLosses++;
        else break;
      }

      // Simple drawdown from equity curve approximation
      let equity = 10000;
      let peak = equity;
      let maxDrawdown = 0;
      for (let i = pairs - 1; i >= 0; i--) {
        const buyPrice = buySignals[i].executed_price || buySignals[i].price_at_signal;
        const sellPrice = sellSignals[i].executed_price || sellSignals[i].price_at_signal;
        const pnlPct = (sellPrice - buyPrice) / buyPrice;
        equity *= (1 + pnlPct);
        if (equity > peak) peak = equity;
        const dd = ((peak - equity) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      const metrics = {
        win_rate: winRate,
        drawdown: parseFloat(maxDrawdown.toFixed(2)),
        consecutive_losses: consecutiveLosses,
        total_signals: signals.length,
        total_pairs: totalPairs,
      };

      // Check thresholds
      const minWinRate = automation.min_win_rate ?? 0.40;
      const maxDrawdownThreshold = automation.max_drawdown_threshold ?? 15;
      const maxConsecutiveLosses = automation.max_consecutive_losses ?? 5;

      let breached = false;
      let triggerReason = '';

      if (winRate !== null && winRate < minWinRate) {
        breached = true;
        triggerReason = `win_rate_below_${(minWinRate * 100).toFixed(0)}`;
      } else if (maxDrawdown > maxDrawdownThreshold) {
        breached = true;
        triggerReason = `max_drawdown_exceeded_${maxDrawdownThreshold}`;
      } else if (consecutiveLosses >= maxConsecutiveLosses) {
        breached = true;
        triggerReason = `consecutive_losses_${consecutiveLosses}`;
      }

      return new Response(JSON.stringify({ breached, triggerReason, metrics }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== OPTIMIZE-PARAMS ====================
    if (action === 'optimize-params') {
      const { trigger_reason, old_metrics } = await req.json().catch(() => ({}));

      // Generate parameter variations
      const baseConfig = {
        rsi_oversold: automation.rsi_oversold ?? 30,
        rsi_overbought: automation.rsi_overbought ?? 70,
        theta: automation.theta ?? 0.01,
        stop_loss_percent: automation.stop_loss_percent ?? 5,
        take_profit_percent: automation.take_profit_percent ?? 15,
        position_size_percent: automation.position_size_percent ?? 10,
      };

      const variations = [baseConfig]; // include baseline
      const adjustments = [
        { rsi_oversold: -5 }, { rsi_oversold: 5 },
        { rsi_overbought: -5 }, { rsi_overbought: 5 },
        { theta: -0.005 }, { theta: 0.005 },
        { stop_loss_percent: -2 }, { stop_loss_percent: 2 },
        { take_profit_percent: -3 }, { take_profit_percent: 3 },
      ];

      for (const adj of adjustments) {
        const variant = { ...baseConfig };
        for (const [key, delta] of Object.entries(adj)) {
          (variant as any)[key] = Math.max(0.001, (variant as any)[key] + delta);
        }
        // Clamp
        variant.rsi_oversold = Math.max(10, Math.min(50, variant.rsi_oversold));
        variant.rsi_overbought = Math.max(50, Math.min(90, variant.rsi_overbought));
        variant.theta = Math.max(0.005, Math.min(0.1, variant.theta));
        variant.stop_loss_percent = Math.max(1, Math.min(50, variant.stop_loss_percent));
        variant.take_profit_percent = Math.max(1, Math.min(100, variant.take_profit_percent));
        variations.push(variant);
      }

      // Run quick backtests for each variation (last 30 days, 5Min)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const endDate = now.toISOString().slice(0, 10);

      // We need a user brokerage account to fetch data
      const { data: brokerageAccount } = await supabaseAdmin
        .from('user_brokerage_accounts')
        .select('*')
        .eq('user_id', automation.user_id)
        .eq('broker_name', 'alpaca')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!brokerageAccount) {
        return new Response(JSON.stringify({ improved: false, reason: 'no_brokerage_account' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Call run-backtest for each variation (sequentially to avoid rate limits)
      const results: Array<{ config: any; sharpe: number }> = [];

      for (const variant of variations) {
        try {
          // Create a temporary auth context using service key
          const backtestResp = await fetch(`${supabaseUrl}/functions/v1/run-backtest`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              symbol: automation.symbol,
              indicators: automation.indicators,
              rsi_oversold: variant.rsi_oversold,
              rsi_overbought: variant.rsi_overbought,
              theta: variant.theta,
              position_size_percent: variant.position_size_percent,
              stop_loss_percent: variant.stop_loss_percent,
              take_profit_percent: variant.take_profit_percent,
              start_date: startDate,
              end_date: endDate,
              initial_capital: 10000,
              timeframe: '5Min',
              model_id: null,
            }),
          });

          if (backtestResp.ok) {
            const btResult = await backtestResp.json();
            if (btResult.sharpe_ratio !== undefined) {
              results.push({ config: variant, sharpe: btResult.sharpe_ratio || 0 });
            }
          }
        } catch (e) {
          console.error(`[BotOptimizer] Backtest variation failed:`, e);
        }
        // Brief delay between backtests
        await new Promise(r => setTimeout(r, 500));
      }

      if (results.length < 2) {
        return new Response(JSON.stringify({ improved: false, reason: 'insufficient_backtest_results' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Sort by Sharpe, pick best
      results.sort((a, b) => b.sharpe - a.sharpe);
      const best = results[0];
      const baseline = results.find(r => r.config === baseConfig) || results[results.length - 1];

      // Only apply if >10% improvement
      const improvement = baseline.sharpe > 0
        ? (best.sharpe - baseline.sharpe) / baseline.sharpe
        : best.sharpe > baseline.sharpe ? 1 : 0;

      if (improvement > 0.10 && best.config !== baseConfig) {
        return new Response(JSON.stringify({
          improved: true,
          old_config: baseConfig,
          new_config: best.config,
          old_sharpe: baseline.sharpe,
          new_sharpe: best.sharpe,
          improvement_pct: parseFloat((improvement * 100).toFixed(1)),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ improved: false, reason: 'no_significant_improvement', best_sharpe: best.sharpe, baseline_sharpe: baseline.sharpe }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== AI-REWRITE ====================
    if (action === 'ai-rewrite') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ improved: false, reason: 'no_ai_key' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get recent signals for context
      const { data: recentSignals } = await supabaseAdmin
        .from('automation_signals')
        .select('signal_type, confidence, price_at_signal, executed_price, trade_executed, created_at')
        .eq('automation_id', automation_id)
        .order('created_at', { ascending: false })
        .limit(50);

      const tradeHistory = (recentSignals || []).map((s: any) => ({
        type: s.signal_type,
        confidence: s.confidence,
        price: s.price_at_signal,
        executed: s.trade_executed,
        time: s.created_at,
      }));

      const currentConfig = {
        symbol: automation.symbol,
        indicators: automation.indicators,
        rsi_oversold: automation.rsi_oversold,
        rsi_overbought: automation.rsi_overbought,
        theta: automation.theta,
        stop_loss_percent: automation.stop_loss_percent,
        take_profit_percent: automation.take_profit_percent,
        position_size_percent: automation.position_size_percent,
        horizon_minutes: automation.horizon_minutes,
      };

      const prompt = `This trading strategy for ${automation.symbol} has been underperforming. 
Here's its recent trade history (most recent first): ${JSON.stringify(tradeHistory.slice(0, 20))}
Current config: ${JSON.stringify(currentConfig)}
Generation: ${automation.optimization_generation || 0}

Generate an improved strategy for ${automation.symbol} that addresses the weaknesses shown in the trade history. 
Focus on adjusting indicators, thresholds, and risk parameters to improve the Sharpe ratio.`;

      const STRATEGY_TOOL = {
        type: "function",
        function: {
          name: "generate_strategy",
          description: "Generate improved trading automation configuration.",
          parameters: {
            type: "object",
            properties: {
              symbol: { type: "string" },
              strategy_summary: { type: "string" },
              indicators: {
                type: "object",
                properties: {
                  rsi: { type: "object", properties: { enabled: { type: "boolean" }, periods: { type: "array", items: { type: "integer" } } }, required: ["enabled", "periods"] },
                  sma: { type: "object", properties: { enabled: { type: "boolean" }, windows: { type: "array", items: { type: "integer" } } }, required: ["enabled", "windows"] },
                  ema: { type: "object", properties: { enabled: { type: "boolean" }, windows: { type: "array", items: { type: "integer" } } }, required: ["enabled", "windows"] },
                  bollinger: { type: "object", properties: { enabled: { type: "boolean" }, window: { type: "integer" }, std: { type: "number" } }, required: ["enabled", "window", "std"] },
                  sma_deviation: { type: "object", properties: { enabled: { type: "boolean" }, window: { type: "integer" } }, required: ["enabled", "window"] },
                },
                required: ["rsi", "sma", "ema", "bollinger", "sma_deviation"],
              },
              rsi_oversold: { type: "number" },
              rsi_overbought: { type: "number" },
              theta: { type: "number" },
              stop_loss_percent: { type: "number" },
              take_profit_percent: { type: "number" },
              position_size_percent: { type: "number" },
              horizon_minutes: { type: "integer" },
            },
            required: ["symbol", "indicators", "rsi_oversold", "rsi_overbought", "theta", "stop_loss_percent", "take_profit_percent"],
            additionalProperties: false,
          },
        },
      };

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a trading strategy optimizer. Analyze the underperforming strategy and generate an improved configuration." },
            { role: "user", content: prompt },
          ],
          tools: [STRATEGY_TOOL],
          tool_choice: { type: "function", function: { name: "generate_strategy" } },
        }),
      });

      if (!aiResp.ok) {
        console.error(`[BotOptimizer] AI gateway error: ${aiResp.status}`);
        return new Response(JSON.stringify({ improved: false, reason: 'ai_error' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== 'generate_strategy') {
        return new Response(JSON.stringify({ improved: false, reason: 'ai_no_strategy' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newConfig = JSON.parse(toolCall.function.arguments);

      // Validate AI output by running a quick backtest
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

        const btResp = await fetch(`${supabaseUrl}/functions/v1/run-backtest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            symbol: automation.symbol,
            indicators: newConfig.indicators,
            rsi_oversold: newConfig.rsi_oversold,
            rsi_overbought: newConfig.rsi_overbought,
            theta: newConfig.theta ?? automation.theta,
            position_size_percent: newConfig.position_size_percent ?? automation.position_size_percent,
            stop_loss_percent: newConfig.stop_loss_percent,
            take_profit_percent: newConfig.take_profit_percent,
            start_date: thirtyDaysAgo.toISOString().slice(0, 10),
            end_date: now.toISOString().slice(0, 10),
            initial_capital: 10000,
            timeframe: '5Min',
            model_id: null,
          }),
        });

        if (btResp.ok) {
          const btResult = await btResp.json();
          return new Response(JSON.stringify({
            improved: true,
            new_config: newConfig,
            new_metrics: {
              sharpe_ratio: btResult.sharpe_ratio,
              total_return: btResult.total_return,
              win_rate: btResult.win_rate,
              max_drawdown: btResult.max_drawdown,
            },
            strategy_summary: newConfig.strategy_summary,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (e) {
        console.error('[BotOptimizer] AI rewrite backtest failed:', e);
      }

      // Return the AI config even without backtest validation
      return new Response(JSON.stringify({
        improved: true,
        new_config: newConfig,
        strategy_summary: newConfig.strategy_summary,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== APPLY ====================
    if (action === 'apply') {
      const body = await req.json().catch(() => ({}));
      const { new_config, trigger_reason, stage, old_metrics, new_metrics } = body;

      if (!new_config) {
        return new Response(JSON.stringify({ error: 'new_config required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Cap generation at 50
      const currentGen = automation.optimization_generation ?? 0;
      if (currentGen >= 50) {
        return new Response(JSON.stringify({ applied: false, reason: 'generation_cap_reached' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Snapshot old config
      const oldConfig = {
        indicators: automation.indicators,
        rsi_oversold: automation.rsi_oversold,
        rsi_overbought: automation.rsi_overbought,
        theta: automation.theta,
        stop_loss_percent: automation.stop_loss_percent,
        take_profit_percent: automation.take_profit_percent,
        position_size_percent: automation.position_size_percent,
        horizon_minutes: automation.horizon_minutes,
      };

      // Update the automation
      const updatePayload: any = {
        last_optimization_at: new Date().toISOString(),
        optimization_generation: currentGen + 1,
      };
      if (new_config.indicators) updatePayload.indicators = new_config.indicators;
      if (new_config.rsi_oversold !== undefined) updatePayload.rsi_oversold = new_config.rsi_oversold;
      if (new_config.rsi_overbought !== undefined) updatePayload.rsi_overbought = new_config.rsi_overbought;
      if (new_config.theta !== undefined) updatePayload.theta = new_config.theta;
      if (new_config.stop_loss_percent !== undefined) updatePayload.stop_loss_percent = new_config.stop_loss_percent;
      if (new_config.take_profit_percent !== undefined) updatePayload.take_profit_percent = new_config.take_profit_percent;
      if (new_config.position_size_percent !== undefined) updatePayload.position_size_percent = new_config.position_size_percent;
      if (new_config.horizon_minutes !== undefined) updatePayload.horizon_minutes = new_config.horizon_minutes;

      const { error: updateErr } = await supabaseAdmin
        .from('stock_automations')
        .update(updatePayload)
        .eq('id', automation_id);

      if (updateErr) {
        console.error('[BotOptimizer] Failed to update automation:', updateErr);
        return new Response(JSON.stringify({ applied: false, error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Log the optimization
      await supabaseAdmin.from('bot_optimization_logs').insert({
        automation_id,
        user_id: automation.user_id,
        trigger_reason: trigger_reason || 'manual',
        stage: stage || 'parameter_optimization',
        old_config: oldConfig,
        new_config,
        old_metrics: old_metrics || null,
        new_metrics: new_metrics || null,
        status: 'applied',
      });

      console.log(`[BotOptimizer] Applied optimization gen ${currentGen + 1} for ${automation.symbol}`);

      return new Response(JSON.stringify({ applied: true, generation: currentGen + 1 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[BotOptimizer] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
