import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Sector-specific indicator configs tuned to each asset class
const SECTOR_INDICATORS: Record<string, any> = {
  tech_growth: {
    // Stable large-caps: longer SMAs for trend-following, moderate RSI
    rsi: { enabled: true, periods: [14, 21] },
    sma: { enabled: true, windows: [50, 200] },
    ema: { enabled: true, windows: [12, 26] },
    bollinger: { enabled: true, window: 20, std: 2 },
    sma_deviation: { enabled: true, window: 50 },
  },
  tech_momentum: {
    // High-volatility momentum: shorter windows, tighter signals
    rsi: { enabled: true, periods: [9, 14] },
    sma: { enabled: true, windows: [10, 30] },
    ema: { enabled: true, windows: [5, 13] },
    bollinger: { enabled: true, window: 15, std: 2.5 },
    sma_deviation: { enabled: true, window: 20 },
  },
  precious_metals: {
    // Commodities: wider Bollinger, longer trend windows, mean-reversion focus
    rsi: { enabled: true, periods: [14, 28] },
    sma: { enabled: true, windows: [20, 100] },
    ema: { enabled: false, windows: [12, 26] },
    bollinger: { enabled: true, window: 25, std: 1.8 },
    sma_deviation: { enabled: true, window: 30 },
  },
};

const SYSTEM_BOTS = [
  {
    name: 'System Bot: Tech Growth',
    sector: 'tech_growth',
    ticker_pool: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'AMD', 'CRM', 'AVGO', 'ORCL'],
    default_ticker: 'AAPL',
    description: 'Platform-managed bot focusing on established tech leaders. Auto-rotates tickers weekly and self-optimizes via continuous backtesting.',
    default_params: { theta: 0.008, stop_loss_percent: 4, take_profit_percent: 12, position_size_percent: 8 },
  },
  {
    name: 'System Bot: Tech Momentum',
    sector: 'tech_momentum',
    ticker_pool: ['TSLA', 'PLTR', 'SNOW', 'NET', 'CRWD', 'DDOG', 'MDB', 'ZS', 'PANW', 'UBER'],
    default_ticker: 'TSLA',
    description: 'Platform-managed bot trading high-momentum tech stocks. Weekly ticker rotation driven by AI analysis of sector performance.',
    default_params: { theta: 0.015, stop_loss_percent: 6, take_profit_percent: 20, position_size_percent: 12 },
  },
  {
    name: 'System Bot: Precious Metals',
    sector: 'precious_metals',
    ticker_pool: ['GLD', 'SLV', 'GDX', 'GOLD', 'NEM', 'AEM', 'WPM', 'FNV'],
    default_ticker: 'GLD',
    description: 'Platform-managed bot for precious metals ETFs and miners. Self-improving strategy with weekly rotation.',
    default_params: { theta: 0.005, stop_loss_percent: 3, take_profit_percent: 10, position_size_percent: 7 },
  },
];

// Build a rich knowledge context from platform data for AI optimization
function buildKnowledgeContext(
  tickerKnowledge: any,
  poolKnowledge: any[],
  recentOptLogs: any[],
  sectorStrategies: any[],
  sector: string,
): string {
  const parts: string[] = [];

  if (tickerKnowledge) {
    parts.push(`Current ticker knowledge: avg Sharpe ${tickerKnowledge.avg_sharpe ?? 'N/A'}, avg win rate ${tickerKnowledge.avg_win_rate ?? 'N/A'}, best indicator combo: ${JSON.stringify(tickerKnowledge.best_indicator_combo)}, best params: ${JSON.stringify(tickerKnowledge.best_params)}.`);
  }

  if (poolKnowledge.length > 0) {
    const poolSummary = poolKnowledge.map(pk => `${pk.symbol}: Sharpe=${pk.avg_sharpe ?? '?'}, WR=${pk.avg_win_rate ?? '?'}`).join('; ');
    parts.push(`Cross-asset pool knowledge: ${poolSummary}.`);
  }

  if (recentOptLogs.length > 0) {
    const logSummary = recentOptLogs.map((l, i) => `Opt#${i+1}(${l.stage}): Sharpe=${(l.new_metrics as any)?.sharpe ?? '?'}`).join('; ');
    parts.push(`Recent optimization history: ${logSummary}.`);
  }

  if (sectorStrategies.length > 0) {
    const bestStrats = sectorStrategies
      .filter(s => (s.outcome_metrics as any)?.sharpe_ratio)
      .sort((a, b) => ((b.outcome_metrics as any)?.sharpe_ratio || 0) - ((a.outcome_metrics as any)?.sharpe_ratio || 0))
      .slice(0, 5);
    if (bestStrats.length > 0) {
      const stratSummary = bestStrats.map(s => `${s.symbol}: indicators=${JSON.stringify(Object.keys(s.indicators_used || {}))}, Sharpe=${(s.outcome_metrics as any)?.sharpe_ratio}`).join('; ');
      parts.push(`Top-performing strategies in ${sector} pool: ${stratSummary}.`);
    }
  }

  return parts.join(' ') || 'No historical knowledge available.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    // For actions requiring auth, validate alpha role
    const authHeader = req.headers.get('Authorization');
    let callerUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
      if (!claimsErr && claimsData?.claims) {
        callerUserId = claimsData.claims.sub as string;
      }
    }

    // Find @Seif account
    const { data: seifProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', 'Seif')
      .single();

    if (!seifProfile) {
      return new Response(JSON.stringify({ error: '@Seif account not found' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const seifUserId = seifProfile.id;

    // ==================== BOOTSTRAP ====================
    if (action === 'bootstrap') {
      const results = [];

      for (const bot of SYSTEM_BOTS) {
        // Check if already exists
        const { data: existing } = await supabaseAdmin
          .from('system_bot_config')
          .select('id, model_id')
          .eq('sector', bot.sector)
          .maybeSingle();

        if (existing) {
          results.push({ sector: bot.sector, status: 'already_exists', model_id: existing.model_id });
          continue;
        }

        // Create model with sector-specific indicators & params
        const sectorIndicators = SECTOR_INDICATORS[bot.sector] || SECTOR_INDICATORS.tech_growth;
        const { data: model, error: modelErr } = await supabaseAdmin
          .from('models')
          .insert({
            name: bot.name,
            description: bot.description,
            user_id: seifUserId,
            model_type: 'no-code',
            status: 'published',
            is_public: true,
            is_system: true,
            ticker: bot.default_ticker,
            indicators_config: sectorIndicators,
            performance_fee_percent: 0,
            risk_level: bot.sector === 'tech_momentum' ? 'high' : 'medium',
            strategy_overview: bot.description,
            theta: bot.default_params.theta,
            stop_loss_percent: bot.default_params.stop_loss_percent,
            take_profit_percent: bot.default_params.take_profit_percent,
            position_size_percent: bot.default_params.position_size_percent,
          })
          .select('id')
          .single();

        if (modelErr) {
          console.error(`[SystemBots] Failed to create model for ${bot.sector}:`, modelErr);
          results.push({ sector: bot.sector, status: 'error', error: modelErr.message });
          continue;
        }

        // Create system_bot_config
        await supabaseAdmin.from('system_bot_config').insert({
          model_id: model.id,
          sector: bot.sector,
          ticker_pool: bot.ticker_pool,
          current_ticker: bot.default_ticker,
          is_active: true,
        });

        // Deploy the model
        await supabaseAdmin.from('deployed_models').insert({
          model_id: model.id,
          user_id: seifUserId,
          status: 'running',
          config: { owner_trades_too: false },
        });

        results.push({ sector: bot.sector, status: 'created', model_id: model.id });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== STATUS ====================
    if (action === 'status') {
      const { data: configs } = await supabaseAdmin
        .from('system_bot_config')
        .select('*');

      if (!configs || configs.length === 0) {
        return new Response(JSON.stringify({ bots: [], bootstrapped: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bots = [];
      for (const cfg of configs) {
        const { data: model } = await supabaseAdmin
          .from('models')
          .select('id, name, ticker, total_subscribers, total_return, sharpe_ratio, win_rate, max_drawdown, status, indicators_config, min_allocation, max_allocation, stop_loss_percent, take_profit_percent, position_size_percent, theta, max_exposure_percent, risk_level')
          .eq('id', cfg.model_id)
          .single();

        const { data: deployment } = await supabaseAdmin
          .from('deployed_models')
          .select('status, last_signal_at, total_signals, total_trades')
          .eq('model_id', cfg.model_id)
          .maybeSingle();

        // Fetch recent signals for this bot
        const { data: signals } = await supabaseAdmin
          .from('model_signals')
          .select('id, ticker, signal_type, confidence, price_at_signal, quantity, generated_at, status')
          .eq('model_id', cfg.model_id)
          .order('generated_at', { ascending: false })
          .limit(20);

        // Compute live metrics from signals if model metrics are null
        let computedMetrics: any = null;
        if (signals && signals.length > 0) {
          const totalSignals = signals.length;
          const buySignals = signals.filter((s: any) => s.signal_type === 'BUY').length;
          const sellSignals = signals.filter((s: any) => s.signal_type === 'SELL').length;
          const holdSignals = signals.filter((s: any) => s.signal_type === 'HOLD').length;
          
          // Compute a simple P&L from sequential buy/sell pairs
          const allSignals = await supabaseAdmin
            .from('model_signals')
            .select('signal_type, price_at_signal, generated_at')
            .eq('model_id', cfg.model_id)
            .neq('signal_type', 'HOLD')
            .order('generated_at', { ascending: true });
          
          let totalPnlPct = 0;
          let trades = 0;
          let wins = 0;
          let entryPrice: number | null = null;
          const pnls: number[] = [];
          
          for (const sig of (allSignals.data || [])) {
            if (sig.signal_type === 'BUY' && !entryPrice) {
              entryPrice = sig.price_at_signal;
            } else if (sig.signal_type === 'SELL' && entryPrice && sig.price_at_signal) {
              const pnlPct = ((sig.price_at_signal - entryPrice) / entryPrice) * 100;
              totalPnlPct += pnlPct;
              pnls.push(pnlPct);
              trades++;
              if (pnlPct > 0) wins++;
              entryPrice = null;
            }
          }
          
          const winRate = trades > 0 ? wins / trades : null;
          const avgReturn = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : null;
          const stdDev = pnls.length > 1 ? Math.sqrt(pnls.reduce((sum, p) => sum + Math.pow(p - (avgReturn || 0), 2), 0) / (pnls.length - 1)) : null;
          const sharpe = stdDev && stdDev > 0 && avgReturn !== null ? avgReturn / stdDev : null;
          const maxDD = pnls.length > 0 ? Math.min(...pnls) : null;

          computedMetrics = {
            total_return: totalPnlPct,
            sharpe_ratio: sharpe,
            win_rate: winRate,
            max_drawdown: maxDD,
            total_signals: totalSignals,
            buy_signals: buySignals,
            sell_signals: sellSignals,
            hold_signals: holdSignals,
            completed_trades: trades,
          };
        }

        bots.push({
          config: cfg,
          model,
          deployment,
          signals: signals || [],
          computedMetrics,
        });
      }

      return new Response(JSON.stringify({ bots, bootstrapped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== ROTATE-TICKERS ====================
    if (action === 'rotate-tickers') {
      const { data: configs } = await supabaseAdmin
        .from('system_bot_config')
        .select('*')
        .eq('is_active', true);

      if (!configs || configs.length === 0) {
        return new Response(JSON.stringify({ rotated: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      const rotated = [];

      for (const cfg of configs) {
        const lastRotation = cfg.last_rotation_at ? new Date(cfg.last_rotation_at) : new Date(0);
        const daysSinceRotation = (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24);

        // Force rotation if called manually (body.force) or interval elapsed
        if (!body.force && daysSinceRotation < cfg.rotation_interval_days) continue;

        let newTicker = cfg.current_ticker;

        if (LOVABLE_API_KEY && cfg.ticker_pool.length > 1) {
          // Fetch platform knowledge for candidates
          let knowledgeContext = '';
          try {
            const pkResp = await fetch(`${supabaseUrl}/functions/v1/strategy-knowledge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ action: 'query', symbol: cfg.current_ticker }),
            });
            if (pkResp.ok) {
              const pkData = await pkResp.json();
              if (pkData.summary) {
                knowledgeContext = `Current ticker ${cfg.current_ticker} knowledge: Sharpe ${pkData.summary.avg_sharpe}, Win Rate ${pkData.summary.avg_win_rate}.`;
              }
            }
          } catch (_) {}

          try {
            const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-3-flash-preview',
                messages: [
                  { role: 'system', content: 'You are a stock rotation advisor. Pick the single best ticker from the pool for the upcoming week. Return ONLY the ticker symbol.' },
                  { role: 'user', content: `Sector: ${cfg.sector}. Current ticker: ${cfg.current_ticker}. Pool: ${cfg.ticker_pool.join(', ')}. ${knowledgeContext} Pick a different ticker than the current one for diversification. Return only the ticker symbol.` },
                ],
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const suggested = aiData.choices?.[0]?.message?.content?.trim().toUpperCase();
              if (suggested && cfg.ticker_pool.includes(suggested)) {
                newTicker = suggested;
              } else {
                // Fallback: random pick excluding current
                const others = cfg.ticker_pool.filter((t: string) => t !== cfg.current_ticker);
                newTicker = others[Math.floor(Math.random() * others.length)];
              }
            }
          } catch (e) {
            console.warn('[SystemBots] AI rotation failed, using random:', e);
            const others = cfg.ticker_pool.filter((t: string) => t !== cfg.current_ticker);
            newTicker = others[Math.floor(Math.random() * others.length)];
          }
        } else {
          const others = cfg.ticker_pool.filter((t: string) => t !== cfg.current_ticker);
          newTicker = others[Math.floor(Math.random() * others.length)] || cfg.current_ticker;
        }

        // Update model ticker
        await supabaseAdmin.from('models').update({ ticker: newTicker }).eq('id', cfg.model_id);
        // Update config
        await supabaseAdmin.from('system_bot_config').update({
          current_ticker: newTicker,
          last_rotation_at: new Date().toISOString(),
        }).eq('id', cfg.id);

        rotated.push({ sector: cfg.sector, old_ticker: cfg.current_ticker, new_ticker: newTicker });
      }

      return new Response(JSON.stringify({ rotated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== OPTIMIZE ====================
    if (action === 'optimize') {
      const { data: configs } = await supabaseAdmin
        .from('system_bot_config')
        .select('*')
        .eq('is_active', true);

      if (!configs || configs.length === 0) {
        return new Response(JSON.stringify({ optimized: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const optimized = [];

      for (const cfg of configs) {
        // Get model's current config
        const { data: model } = await supabaseAdmin
          .from('models')
          .select('id, ticker, indicators_config')
          .eq('id', cfg.model_id)
          .single();

        if (!model) continue;

        const ticker = model.ticker || cfg.current_ticker;
        const indicators = model.indicators_config || SECTOR_INDICATORS[cfg.sector] || SECTOR_INDICATORS.tech_growth;

        // ---- Gather historical knowledge from ALL platform bots ----
        // 1. Strategy knowledge for this specific ticker
        let tickerKnowledge: any = null;
        try {
          const { data: ks } = await supabaseAdmin
            .from('knowledge_summaries')
            .select('*')
            .eq('symbol', ticker)
            .maybeSingle();
          tickerKnowledge = ks;
        } catch (_) {}

        // 2. Strategy knowledge for all tickers in the pool (cross-learning)
        let poolKnowledge: any[] = [];
        try {
          const { data: pks } = await supabaseAdmin
            .from('knowledge_summaries')
            .select('*')
            .in('symbol', cfg.ticker_pool);
          poolKnowledge = pks || [];
        } catch (_) {}

        // 3. Recent optimization logs for this bot (learn from own history)
        let recentOptLogs: any[] = [];
        try {
          const { data: logs } = await supabaseAdmin
            .from('bot_optimization_logs')
            .select('new_config, new_metrics, stage')
            .eq('model_id', cfg.model_id)
            .order('created_at', { ascending: false })
            .limit(5);
          recentOptLogs = logs || [];
        } catch (_) {}

        // 4. Best-performing strategies across all symbols in this sector's pool
        let sectorStrategies: any[] = [];
        try {
          const { data: sk } = await supabaseAdmin
            .from('strategy_knowledge')
            .select('indicators_used, outcome_metrics, risk_params, symbol')
            .in('symbol', cfg.ticker_pool)
            .order('created_at', { ascending: false })
            .limit(20);
          sectorStrategies = sk || [];
        } catch (_) {}

        // Build knowledge context string for AI
        const knowledgeContext = buildKnowledgeContext(tickerKnowledge, poolKnowledge, recentOptLogs, sectorStrategies, cfg.sector);

        // Run parameter sweep via bot-optimizer pattern
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

        // Use sector-specific base config informed by knowledge
        const sectorDefaults = SYSTEM_BOTS.find(b => b.sector === cfg.sector)?.default_params || { theta: 0.01, stop_loss_percent: 5, take_profit_percent: 15, position_size_percent: 10 };
        const baseConfig = {
          rsi_oversold: cfg.sector === 'tech_momentum' ? 25 : 30,
          rsi_overbought: cfg.sector === 'tech_momentum' ? 75 : 70,
          theta: sectorDefaults.theta,
          stop_loss_percent: sectorDefaults.stop_loss_percent,
          take_profit_percent: sectorDefaults.take_profit_percent,
          position_size_percent: sectorDefaults.position_size_percent,
        };

        const variations = [baseConfig];
        const adjustments = [
          { rsi_oversold: -5 }, { rsi_oversold: 5 },
          { rsi_overbought: -5 }, { rsi_overbought: 5 },
          { theta: -0.005 }, { theta: 0.005 },
          { stop_loss_percent: -2 }, { stop_loss_percent: 2 },
        ];

        for (const adj of adjustments) {
          const variant = { ...baseConfig };
          for (const [key, delta] of Object.entries(adj)) {
            (variant as any)[key] = Math.max(0.001, (variant as any)[key] + delta);
          }
          variant.rsi_oversold = Math.max(10, Math.min(50, variant.rsi_oversold));
          variant.rsi_overbought = Math.max(50, Math.min(90, variant.rsi_overbought));
          variant.theta = Math.max(0.005, Math.min(0.1, variant.theta));
          variant.stop_loss_percent = Math.max(1, Math.min(50, variant.stop_loss_percent));
          variant.take_profit_percent = Math.max(1, Math.min(100, variant.take_profit_percent));
          variations.push(variant);
        }

        // --- Phase 1: Parameter sweep with CURRENT indicators ---
        const runBacktest = async (variantConfig: any, indicatorSet: any) => {
          try {
            const btResp = await fetch(`${supabaseUrl}/functions/v1/run-backtest`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                symbol: ticker,
                indicators: indicatorSet,
                ...variantConfig,
                start_date: thirtyDaysAgo.toISOString().slice(0, 10),
                end_date: now.toISOString().slice(0, 10),
                initial_capital: 10000,
                timeframe: '5Min',
                model_id: null,
              }),
            });
            if (btResp.ok) {
              const btResult = await btResp.json();
              if (btResult.sharpe_ratio !== undefined) {
                return {
                  config: variantConfig,
                  indicators: indicatorSet,
                  sharpe: btResult.sharpe_ratio || 0,
                  total_return: btResult.total_return || 0,
                  win_rate: btResult.win_rate || 0,
                  max_drawdown: btResult.max_drawdown || 0,
                };
              }
            }
          } catch (e) {
            console.error(`[SystemBots] Backtest variation failed:`, e);
          }
          return null;
        };

        const results: Array<{ config: any; indicators: any; sharpe: number; total_return: number; win_rate: number; max_drawdown: number }> = [];

        for (const variant of variations) {
          const r = await runBacktest(variant, indicators);
          if (r) results.push(r);
          await new Promise(r => setTimeout(r, 300));
        }

        // --- Phase 2: Ask AI for NEW indicator configuration (native + custom) ---
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        let aiIndicators: any = null;
        const currentBestSharpe = results.length > 0 ? Math.max(...results.map(r => r.sharpe)) : 0;

        if (LOVABLE_API_KEY) {
          try {
            const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  {
                    role: 'system',
                    content: `You are a quantitative trading system optimizer for the ${cfg.sector.replace('_', ' ')} sector. You must output a COMPLETE indicator configuration as a single JSON object. This includes BOTH native indicators and optional custom JavaScript indicators. Native indicators available: rsi, sma, ema, bollinger, sma_deviation, volatility. Each native indicator has: enabled (bool), and params like periods/windows/window/std. Custom indicators go in a "custom" array, each with: name, code (JS function "(bars) => { ... }" returning number: +buy/-sell/0neutral), weight (0.5-2.0), enabled (bool). The output must be a single JSON object. No markdown. No explanation.`,
                  },
                  {
                    role: 'user',
                    content: `Ticker: ${ticker}. Sector: ${cfg.sector}.
Current indicators config: ${JSON.stringify(indicators)}
Current best Sharpe from param sweep: ${currentBestSharpe.toFixed(4)}.

PLATFORM INTELLIGENCE:
${knowledgeContext}

Design an IMPROVED indicator configuration for ${ticker}. You may:
- Change native indicator params (windows, periods, std, enable/disable)
- Add 1-3 custom JS indicators for patterns native ones miss
- Sector focus: ${cfg.sector === 'tech_growth' ? 'institutional accumulation, earnings momentum, sector rotation' : cfg.sector === 'tech_momentum' ? 'gap-and-go, volume spikes, momentum exhaustion, breakout detection' : 'safe-haven flows, inverse equity correlation, volatility regime shifts'}

Return the FULL indicators_config JSON object.`,
                  },
                ],
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const content = aiData.choices?.[0]?.message?.content?.trim();
              if (content) {
                try {
                  const cleaned = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                  const parsed = JSON.parse(cleaned);
                  // Validate it has at least one enabled indicator
                  const hasEnabled = Object.entries(parsed).some(([k, v]: any) => k !== 'custom' && v?.enabled);
                  if (hasEnabled) {
                    aiIndicators = parsed;
                    console.log(`[SystemBots] AI proposed new indicator config for ${cfg.sector}/${ticker}`);
                  }
                } catch (parseErr) {
                  console.warn(`[SystemBots] Failed to parse AI indicators:`, parseErr);
                }
              }
            }
          } catch (aiErr) {
            console.warn(`[SystemBots] AI indicator generation failed:`, aiErr);
          }
        }

        // --- Phase 3: Backtest AI indicators with best param config ---
        if (aiIndicators) {
          const bestParamConfig = results.length > 0
            ? results.sort((a, b) => b.sharpe - a.sharpe)[0].config
            : baseConfig;

          const aiResult = await runBacktest(bestParamConfig, aiIndicators);
          if (aiResult) {
            results.push(aiResult);
            console.log(`[SystemBots] AI indicators Sharpe: ${aiResult.sharpe.toFixed(4)} vs current best: ${currentBestSharpe.toFixed(4)}`);
          }
        }

        // --- Phase 4: Pick winner and apply ---
        if (results.length >= 1) {
          results.sort((a, b) => b.sharpe - a.sharpe);
          const best = results[0];

          // Apply best config + indicators to model, including metrics
          await supabaseAdmin.from('models').update({
            indicators_config: best.indicators,
            theta: best.config.theta,
            stop_loss_percent: best.config.stop_loss_percent,
            take_profit_percent: best.config.take_profit_percent,
            position_size_percent: best.config.position_size_percent,
            // Update metrics from backtest
            total_return: best.total_return,
            sharpe_ratio: best.sharpe,
            win_rate: best.win_rate,
            max_drawdown: best.max_drawdown,
          }).eq('id', cfg.model_id);

          await supabaseAdmin.from('system_bot_config').update({
            last_optimization_at: new Date().toISOString(),
            optimization_generation: cfg.optimization_generation + 1,
          }).eq('id', cfg.id);

          // Log
          const usedAiIndicators = best.indicators !== indicators;
          await supabaseAdmin.from('bot_optimization_logs').insert({
            model_id: cfg.model_id,
            user_id: seifUserId,
            stage: usedAiIndicators ? 'ai_indicator_evolution' : 'param_sweep',
            status: 'applied',
            trigger_reason: 'scheduled_optimization',
            old_config: { params: baseConfig, indicators_summary: Object.keys(indicators).filter(k => k !== 'custom' && indicators[k]?.enabled) },
            new_config: { params: best.config, indicators_summary: Object.keys(best.indicators).filter(k => k !== 'custom' && best.indicators[k]?.enabled), custom_count: (best.indicators.custom || []).length },
            old_metrics: { sharpe: currentBestSharpe },
            new_metrics: { sharpe: best.sharpe, total_return: best.total_return, win_rate: best.win_rate, max_drawdown: best.max_drawdown },
          });

          optimized.push({
            sector: cfg.sector,
            best_sharpe: best.sharpe,
            total_return: best.total_return,
            used_ai_indicators: usedAiIndicators,
            generation: cfg.optimization_generation + 1,
            custom_indicators: (best.indicators.custom || []).length,
          });
        } else {
          optimized.push({ sector: cfg.sector, status: 'insufficient_data' });
        }
      }

      return new Response(JSON.stringify({ optimized }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== UPDATE-CONFIG ====================
    if (action === 'update-config') {
      // Verify alpha
      if (!callerUserId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerUserId)
        .maybeSingle();

      if (roleData?.role !== 'alpha') {
        return new Response(JSON.stringify({ error: 'Alpha role required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { config_id, updates, model_updates } = body;

      if (updates && config_id) {
        const allowedFields: Record<string, boolean> = {
          ticker_pool: true, rotation_interval_days: true, is_active: true,
        };
        const safeUpdates: Record<string, any> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (allowedFields[k]) safeUpdates[k] = v;
        }

        if (Object.keys(safeUpdates).length > 0) {
          await supabaseAdmin.from('system_bot_config').update(safeUpdates).eq('id', config_id);
        }
      }

      if (model_updates && body.model_id) {
        const allowedModelFields: Record<string, boolean> = {
          name: true, description: true, min_allocation: true, max_allocation: true,
          stop_loss_percent: true, take_profit_percent: true, position_size_percent: true,
          theta: true, max_exposure_percent: true, risk_level: true, indicators_config: true,
        };
        const safeModelUpdates: Record<string, any> = {};
        for (const [k, v] of Object.entries(model_updates)) {
          if (allowedModelFields[k]) safeModelUpdates[k] = v;
        }

        if (Object.keys(safeModelUpdates).length > 0) {
          await supabaseAdmin.from('models').update(safeModelUpdates).eq('id', body.model_id);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[SystemBots] Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
