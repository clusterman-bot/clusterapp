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

        bots.push({
          config: cfg,
          model,
          deployment,
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

        const results: Array<{ config: any; sharpe: number }> = [];

        for (const variant of variations) {
          try {
            const btResp = await fetch(`${supabaseUrl}/functions/v1/run-backtest`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                symbol: ticker,
                indicators,
                ...variant,
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
                results.push({ config: variant, sharpe: btResult.sharpe_ratio || 0 });
              }
            }
          } catch (e) {
            console.error(`[SystemBots] Backtest variation failed:`, e);
          }
          await new Promise(r => setTimeout(r, 300));
        }

        if (results.length >= 2) {
          results.sort((a, b) => b.sharpe - a.sharpe);
          const best = results[0];

          // Try AI-generated custom indicators using full platform knowledge
          let updatedIndicators = { ...indicators };
          const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
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
                      content: `You are a quantitative trading indicator developer specializing in the ${cfg.sector.replace('_', ' ')} sector. Generate 1-3 custom JavaScript indicator functions specifically tailored for trading ${ticker}. Each function receives an array of OHLCV bars ({o, h, l, c, v, t}) and must return a number: positive for buy signal, negative for sell, 0 for neutral. Consider the sector characteristics: ${cfg.sector === 'tech_growth' ? 'stable large-caps with institutional flows, earnings-driven moves' : cfg.sector === 'tech_momentum' ? 'high-beta momentum stocks with rapid price swings, gap moves, retail sentiment' : 'commodities with macro sensitivity, inflation hedging, mean-reversion tendencies'}. Return ONLY valid JSON array of objects with fields: name (string), code (string - the JS function body as "(bars) => { ... }"), weight (number 0.5-2.0), enabled (boolean true). No markdown, no explanation.`,
                    },
                    {
                      role: 'user',
                      content: `Current native indicators: ${JSON.stringify(Object.keys(indicators).filter(k => k !== 'custom' && indicators[k]?.enabled))}. Current best Sharpe from param sweep: ${best.sharpe.toFixed(4)}.\n\nPLATFORM INTELLIGENCE:\n${knowledgeContext}\n\nGenerate complementary custom indicators that leverage the platform's historical knowledge and capture patterns specific to ${ticker} that the native indicators miss. Focus on sector-appropriate signals (e.g., ${cfg.sector === 'tech_momentum' ? 'gap-and-go, volume spikes, momentum exhaustion' : cfg.sector === 'precious_metals' ? 'safe-haven flow detection, inverse equity correlation, volatility regime' : 'institutional accumulation, earnings momentum, sector rotation'}).`,
                    },
                  ],
                }),
              });

              if (aiResp.ok) {
                const aiData = await aiResp.json();
                const content = aiData.choices?.[0]?.message?.content?.trim();
                if (content) {
                  try {
                    // Strip markdown code fences if present
                    const cleaned = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                    const customIndicators = JSON.parse(cleaned);
                    if (Array.isArray(customIndicators) && customIndicators.length > 0) {
                      updatedIndicators = {
                        ...indicators,
                        custom: customIndicators.map((ci: any) => ({
                          name: ci.name || 'Custom',
                          code: ci.code || '',
                          weight: Math.max(0.1, Math.min(5.0, ci.weight ?? 1.0)),
                          enabled: true,
                        })),
                      };
                      console.log(`[SystemBots] Generated ${customIndicators.length} custom indicators for ${cfg.sector}`);
                    }
                  } catch (parseErr) {
                    console.warn(`[SystemBots] Failed to parse AI custom indicators:`, parseErr);
                  }
                }
              }
            } catch (aiErr) {
              console.warn(`[SystemBots] AI indicator generation failed:`, aiErr);
            }
          }

          // Apply best config to model
          await supabaseAdmin.from('models').update({
            indicators_config: updatedIndicators,
            theta: best.config.theta,
            stop_loss_percent: best.config.stop_loss_percent,
            take_profit_percent: best.config.take_profit_percent,
            position_size_percent: best.config.position_size_percent,
          }).eq('id', cfg.model_id);

          await supabaseAdmin.from('system_bot_config').update({
            last_optimization_at: new Date().toISOString(),
            optimization_generation: cfg.optimization_generation + 1,
          }).eq('id', cfg.id);

          // Log
          await supabaseAdmin.from('bot_optimization_logs').insert({
            model_id: cfg.model_id,
            user_id: seifUserId,
            stage: 'param_sweep_with_custom_indicators',
            status: 'applied',
            trigger_reason: 'scheduled_optimization',
            old_config: baseConfig,
            new_config: { ...best.config, custom_indicators: updatedIndicators.custom || [] },
            new_metrics: { sharpe: best.sharpe },
          });

          optimized.push({ sector: cfg.sector, best_sharpe: best.sharpe, generation: cfg.optimization_generation + 1, custom_indicators: (updatedIndicators.custom || []).length });
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
