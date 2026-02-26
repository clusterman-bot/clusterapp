import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== INDICATOR CALCULATIONS ====================

function calculateSMA(closes: number[], window: number): number | null {
  if (closes.length < window) return null;
  const slice = closes.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / window;
}

function calculateEMA(closes: number[], window: number): number | null {
  if (closes.length < window) return null;
  const k = 2 / (window + 1);
  let ema = closes.slice(0, window).reduce((a, b) => a + b, 0) / window;
  for (let i = window; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  const recent = changes.slice(-period);
  let avgGain = 0, avgLoss = 0;
  for (const c of recent) {
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateBollingerBands(closes: number[], window: number, numStd: number): { upper: number; middle: number; lower: number; percentB: number } | null {
  const sma = calculateSMA(closes, window);
  if (sma === null || closes.length < window) return null;
  const slice = closes.slice(-window);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / window;
  const std = Math.sqrt(variance);
  const upper = sma + numStd * std;
  const lower = sma - numStd * std;
  const currentPrice = closes[closes.length - 1];
  const percentB = (upper - lower) !== 0 ? (currentPrice - lower) / (upper - lower) : 0.5;
  return { upper, middle: sma, lower, percentB };
}

function calculateSMADeviation(closes: number[], window: number): number | null {
  const sma = calculateSMA(closes, window);
  if (sma === null || sma === 0) return null;
  const currentPrice = closes[closes.length - 1];
  return ((currentPrice - sma) / sma) * 100;
}

function generateSignals(
  closes: number[],
  bars: any[],
  indicators: any,
  rsiOversold = 30,
  rsiOverbought = 70
): { votes: any[]; compositeScore: number } {
  const votes: any[] = [];

  if (indicators?.rsi?.enabled) {
    for (const period of (indicators.rsi.periods || [14])) {
      const rsi = calculateRSI(closes, period);
      if (rsi !== null) {
        let signal = 0;
        let reason = `RSI(${period}) = ${rsi.toFixed(2)} - Neutral`;
        if (rsi <= rsiOversold) { signal = 1; reason = `RSI(${period}) = ${rsi.toFixed(2)} <= ${rsiOversold} (Oversold → BUY)`; }
        else if (rsi >= rsiOverbought) { signal = -1; reason = `RSI(${period}) = ${rsi.toFixed(2)} >= ${rsiOverbought} (Overbought → SELL)`; }
        votes.push({ indicator: `RSI_${period}`, signal, value: rsi, reason });
      }
    }
  }

  if (indicators?.sma?.enabled) {
    const windows = indicators.sma.windows || [5, 20];
    for (const window of windows) {
      const sma = calculateSMA(closes, window);
      if (sma !== null) {
        const currentPrice = closes[closes.length - 1];
        const priceDiffPct = ((currentPrice - sma) / sma) * 100;
        let signal = 0;
        let reason = `SMA(${window}) = ${sma.toFixed(2)}, Price = ${currentPrice.toFixed(2)} - Neutral`;
        if (currentPrice > sma * 1.001) { signal = 1; reason = `Price ${currentPrice.toFixed(2)} > SMA(${window}) ${sma.toFixed(2)} (${priceDiffPct.toFixed(2)}% above → BUY)`; }
        else if (currentPrice < sma * 0.999) { signal = -1; reason = `Price ${currentPrice.toFixed(2)} < SMA(${window}) ${sma.toFixed(2)} (${priceDiffPct.toFixed(2)}% below → SELL)`; }
        votes.push({ indicator: `SMA_${window}`, signal, value: sma, reason });
      }
    }
  }

  if (indicators?.ema?.enabled) {
    const windows = indicators.ema.windows || [5, 20];
    for (const window of windows) {
      const ema = calculateEMA(closes, window);
      if (ema !== null) {
        const currentPrice = closes[closes.length - 1];
        let signal = 0;
        let reason = `EMA(${window}) = ${ema.toFixed(2)} - Neutral`;
        if (currentPrice > ema * 1.001) { signal = 1; reason = `Price ${currentPrice.toFixed(2)} > EMA(${window}) ${ema.toFixed(2)} → BUY`; }
        else if (currentPrice < ema * 0.999) { signal = -1; reason = `Price ${currentPrice.toFixed(2)} < EMA(${window}) ${ema.toFixed(2)} → SELL`; }
        votes.push({ indicator: `EMA_${window}`, signal, value: ema, reason });
      }
    }
  }

  if (indicators?.bollinger?.enabled) {
    const window = indicators.bollinger.window || 20;
    const std = indicators.bollinger.std || 2;
    const bb = calculateBollingerBands(closes, window, std);
    if (bb !== null) {
      let signal = 0;
      let reason = `BB %B = ${bb.percentB.toFixed(3)} - Neutral`;
      if (bb.percentB <= 0.05) { signal = 1; reason = `BB %B = ${bb.percentB.toFixed(3)} (at lower band → BUY)`; }
      else if (bb.percentB >= 0.95) { signal = -1; reason = `BB %B = ${bb.percentB.toFixed(3)} (at upper band → SELL)`; }
      votes.push({ indicator: 'BOLLINGER', signal, value: { upper: bb.upper, middle: bb.middle, lower: bb.lower, percentB: bb.percentB }, reason });
    }
  }

  if (indicators?.sma_deviation?.enabled) {
    const window = indicators.sma_deviation.window || 20;
    const dev = calculateSMADeviation(closes, window);
    if (dev !== null) {
      let signal = 0;
      let reason = `SMA Deviation(${window}) = ${dev.toFixed(3)}% - Neutral`;
      if (dev < -2) { signal = 1; reason = `SMA Deviation = ${dev.toFixed(3)}% (significantly below SMA → BUY)`; }
      else if (dev > 2) { signal = -1; reason = `SMA Deviation = ${dev.toFixed(3)}% (significantly above SMA → SELL)`; }
      votes.push({ indicator: `SMA_DEV_${window}`, signal, value: dev, reason });
    }
  }

  // Custom indicators
  const customIndicators = (indicators?.custom || []) as Array<any>;
  for (const ci of customIndicators) {
    if (!ci.enabled || !ci.code) continue;
    try {
      const fn = new Function('bars', ci.code);
      const rawResult = fn(bars);
      let signal = 0;
      if (typeof rawResult === 'number' && isFinite(rawResult)) {
        signal = rawResult > 0 ? 1 : rawResult < 0 ? -1 : 0;
      }
      const weight = Math.max(0.1, Math.min(5.0, ci.weight ?? 1.0));
      const weightedSignal = signal * weight;
      const reason = signal === 1 ? `${ci.name}: BUY` : signal === -1 ? `${ci.name}: SELL` : `${ci.name}: NEUTRAL`;
      votes.push({ indicator: `CUSTOM_${ci.name}`, signal: weightedSignal, value: signal, reason });
    } catch (_) { /* ignore bad custom indicator */ }
  }

  const totalVotes = votes.length;
  const compositeScore = totalVotes > 0 ? votes.reduce((sum, v) => sum + v.signal, 0) / totalVotes : 0;
  return { votes, compositeScore };
}

// ==================== DECRYPTION ====================

function decryptKeyXOR(encrypted: string, secret: string): string {
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret.padEnd(encryptedBytes.length, secret));
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ secretBytes[i % secretBytes.length];
  }
  return new TextDecoder().decode(decrypted);
}

async function deriveKey(secret: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptKeyAES(encrypted: string, secret: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const saltArray = combined.slice(0, 16);
  const ivArray = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const key = await deriveKey(secret, saltArray.buffer as ArrayBuffer);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivArray }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function isValidApiKey(value: string): boolean {
  if (!value || value.length < 10) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

async function decryptKey(encrypted: string, secret: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  if (combined.length >= 44) {
    try {
      const decrypted = await decryptKeyAES(encrypted, secret);
      if (isValidApiKey(decrypted.trim())) return decrypted.trim();
    } catch (_) { /* fall through */ }
  }
  try {
    const decrypted = decryptKeyXOR(encrypted, secret);
    if (isValidApiKey(decrypted.trim())) return decrypted.trim();
  } catch (_) { /* fall through */ }
  throw new Error('CREDENTIALS_INVALID');
}

// ==================== TRADE MIRRORING ====================

async function executeModelTrades(
  supabaseAdmin: any,
  deployment: any,
  model: any,
  signal: any,
  encryptionSecret: string,
  resendApiKey: string | undefined
) {
  const side = signal.signal_type === 'BUY' ? 'buy' : 'sell';
  const maxExposurePct = model.max_exposure_percent ?? 20;

  console.log(`[RunAutomations] Executing ${side} trade for model ${model.id} (${model.ticker}), signal ${signal.id}`);

  // Get all active subscribers with their allocations
  const { data: subscriptions, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('*, allocations(*)')
    .eq('model_id', model.id)
    .eq('status', 'active');

  if (subError) {
    console.error('[RunAutomations] Error fetching subscribers:', subError);
  }

  // Respect the owner_trades_too config flag (default true for backward compat)
  const ownerTradesToo = deployment.config?.owner_trades_too !== false;

  const usersToTrade = [
    ...(ownerTradesToo
      ? [{ userId: deployment.user_id, subscriptionId: null, isOwner: true, allocation: null, fundWarningAlreadySent: false }]
      : []),
    ...(subscriptions || []).map((sub: any) => ({
      userId: sub.subscriber_id,
      subscriptionId: sub.id,
      isOwner: false,
      allocation: sub.allocations?.[0] || null,
      fundWarningAlreadySent: sub.funds_warning_sent ?? false,
    })),
  ];

  for (const trader of usersToTrade) {
    try {
      // Get user's brokerage accounts – prefer live, fall back to paper
      const { data: brokerageAccounts, error: accError } = await supabaseAdmin
        .from('user_brokerage_accounts')
        .select('*')
        .eq('user_id', trader.userId)
        .eq('broker_name', 'alpaca')
        .eq('is_active', true);

      const brokerageAccount = brokerageAccounts?.find((a: any) => a.account_type === 'live')
        || brokerageAccounts?.[0]
        || null;

      if (accError || !brokerageAccount) {
        console.log(`[RunAutomations] No active brokerage account for user ${trader.userId}, skipping`);
        if (!trader.isOwner && trader.subscriptionId) {
          await supabaseAdmin.from('subscriber_trades').insert({
            subscription_id: trader.subscriptionId,
            signal_id: signal.id,
            user_id: trader.userId,
            ticker: signal.ticker,
            side,
            quantity: signal.quantity,
            status: 'failed',
            error_message: 'No active brokerage account connected',
          });
        }
        continue;
      }

      const alpacaApiKey = await decryptKey(brokerageAccount.api_key_encrypted, encryptionSecret);
      const alpacaApiSecret = await decryptKey(brokerageAccount.api_secret_encrypted, encryptionSecret);
      const isLive = brokerageAccount.account_type === 'live';
      const alpacaBase = isLive ? 'https://api.alpaca.markets' : 'https://paper-api.alpaca.markets';
      const alpacaHeaders = {
        'APCA-API-KEY-ID': alpacaApiKey,
        'APCA-API-SECRET-KEY': alpacaApiSecret,
      };

      let tradeQty = signal.quantity;

      // For subscribers: enforce allocation budget + buying power check
      if (!trader.isOwner && trader.allocation) {
        const allocationBudget = trader.allocation.current_value ?? 0;
        const maxTradeValue = (maxExposurePct / 100) * allocationBudget;

        const acctResp = await fetch(`${alpacaBase}/v2/account`, { headers: alpacaHeaders });
        if (acctResp.ok) {
          const acctData = await acctResp.json();
          const buyingPower = parseFloat(acctData.buying_power ?? '0');

          if (side === 'buy' && buyingPower < maxTradeValue) {
            console.log(`[RunAutomations] Insufficient funds for subscriber ${trader.userId}`);

            await supabaseAdmin.from('subscriber_trades').insert({
              subscription_id: trader.subscriptionId,
              signal_id: signal.id,
              user_id: trader.userId,
              ticker: signal.ticker,
              side,
              quantity: tradeQty,
              status: 'blocked_insufficient_funds',
              error_message: `Insufficient funds. Buying power: $${buyingPower.toFixed(2)}, required: $${maxTradeValue.toFixed(2)}`,
              allocation_id: trader.allocation?.id || null,
            });

            if (!trader.fundWarningAlreadySent && resendApiKey) {
              const { data: userResp } = await supabaseAdmin.auth.admin.getUserById(trader.userId);
              const email = userResp?.user?.email;
              if (email) {
                await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    from: 'Cluster <noreply@clusterapp.lovable.app>',
                    to: [email],
                    subject: `Action needed: Insufficient funds to mirror ${model.name}`,
                    html: `
                      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
                        <h2 style="color: #dc2626;">Trade Blocked — Insufficient Funds</h2>
                        <p>A trade signal was generated by <strong>${model.name}</strong> that you're subscribed to, but your Alpaca account does not have enough buying power to execute it.</p>
                        <ul>
                          <li><strong>Signal:</strong> ${side.toUpperCase()} ${signal.ticker}</li>
                          <li><strong>Buying power available:</strong> $${buyingPower.toFixed(2)}</li>
                          <li><strong>Required:</strong> $${maxTradeValue.toFixed(2)}</li>
                        </ul>
                        <p>To continue mirroring this model's trades, please add more funds to your Alpaca account.</p>
                        <p style="color: #6b7280; font-size: 12px;">This is a one-time notification.</p>
                      </div>
                    `,
                  }),
                });
                await supabaseAdmin.from('subscriptions').update({ funds_warning_sent: true }).eq('id', trader.subscriptionId);
              }
            }
            continue;
          }

          // Proportional qty based on allocation + buying power (fractional)
          if (signal.price_at_signal && signal.price_at_signal > 0) {
            const maxAffordableQty = parseFloat((Math.min(maxTradeValue, buyingPower) / signal.price_at_signal).toFixed(2));
            tradeQty = Math.max(0.01, Math.min(signal.quantity, maxAffordableQty));
          }
        }
      }

      // Check if asset supports fractional trading
      let assetFractionable = false;
      try {
        const assetResp = await fetch(`${alpacaBase}/v2/assets/${encodeURIComponent(signal.ticker)}`, {
          headers: alpacaHeaders,
        });
        if (assetResp.ok) {
          const assetData = await assetResp.json();
          assetFractionable = assetData.fractionable === true;
        }
      } catch (e) {
        console.log(`[RunAutomations] Could not check fractionable for ${signal.ticker}`);
      }

      // Round to whole shares if not fractionable
      if (!assetFractionable && tradeQty < 1) {
        tradeQty = 1;
      } else if (!assetFractionable) {
        tradeQty = Math.floor(tradeQty);
      }

      // Place order via Alpaca
      const orderPayload: Record<string, any> = {
        symbol: signal.ticker,
        side,
        type: 'market',
        time_in_force: 'day',
      };

      if (assetFractionable && tradeQty % 1 !== 0) {
        orderPayload.notional = parseFloat((tradeQty * (signal.price_at_signal || 100)).toFixed(2));
      } else {
        orderPayload.qty = tradeQty;
      }

      const orderResp = await fetch(`${alpacaBase}/v2/orders`, {
        method: 'POST',
        headers: { ...alpacaHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      const orderResult = await orderResp.json();
      console.log(`[RunAutomations] Order for user ${trader.userId}: ${orderResp.ok ? 'OK' : 'FAILED'}`, orderResult.id);

      // Reset funds_warning_sent on successful trade
      if (orderResp.ok && !trader.isOwner && trader.subscriptionId && trader.fundWarningAlreadySent) {
        await supabaseAdmin.from('subscriptions').update({ funds_warning_sent: false }).eq('id', trader.subscriptionId);
      }

      // Log subscriber trade (or owner's own trade so it appears in their history)
      if (!trader.isOwner && trader.subscriptionId) {
        await supabaseAdmin.from('subscriber_trades').insert({
          subscription_id: trader.subscriptionId,
          signal_id: signal.id,
          user_id: trader.userId,
          ticker: signal.ticker,
          side,
          quantity: tradeQty,
          status: orderResp.ok ? 'executed' : 'failed',
          alpaca_order_id: orderResult.id,
          executed_price: orderResult.filled_avg_price ? parseFloat(orderResult.filled_avg_price) : null,
          executed_at: orderResp.ok ? new Date().toISOString() : null,
          error_message: orderResp.ok ? null : orderResult.message,
          allocation_id: trader.allocation?.id || null,
        });
      }

      // Log trading activity
      await supabaseAdmin.from('trading_activity_logs').insert({
        user_id: trader.userId,
        brokerage_account_id: brokerageAccount.id,
        action_type: trader.isOwner ? 'bot_trade' : 'copy_trade',
        symbol: signal.ticker,
        quantity: tradeQty,
        side,
        order_type: 'market',
        status: orderResp.ok ? 'executed' : 'failed',
        metadata: {
          model_id: model.id,
          signal_id: signal.id,
          alpaca_order_id: orderResult.id,
        },
      });

    } catch (tradeError) {
      console.error(`[RunAutomations] Trade error for user ${trader.userId}:`, tradeError instanceof Error ? tradeError.message : tradeError);
    }
  }

  // Mark signal as executed
  await supabaseAdmin
    .from('model_signals')
    .update({ status: 'executed', executed_at: new Date().toISOString() })
    .eq('id', signal.id);

  // Update deployment trade count
  await supabaseAdmin
    .from('deployed_models')
    .update({ total_trades: (deployment.total_trades || 0) + 1 })
    .eq('id', deployment.id);
}

// ==================== MARKET HOURS ====================

function getSecondSundayOfMarch(year: number): Date {
  const march = new Date(Date.UTC(year, 2, 1));
  const dow = march.getUTCDay();
  const firstSunday = dow === 0 ? march : new Date(Date.UTC(year, 2, 7 - dow));
  return new Date(firstSunday.getTime() + 7 * 24 * 3600 * 1000);
}

function getFirstSundayOfNovember(year: number): Date {
  const nov = new Date(Date.UTC(year, 10, 1));
  const dow = nov.getUTCDay();
  return dow === 0 ? nov : new Date(Date.UTC(year, 10, 7 - dow));
}

function isMarketOpen(): boolean {
  const now = new Date();
  const year = now.getUTCFullYear();
  const dstStart = getSecondSundayOfMarch(year);
  const dstEnd = getFirstSundayOfNovember(year);
  const isDST = now >= dstStart && now < dstEnd;
  const offsetHours = isDST ? 4 : 5;
  const etMs = now.getTime() - offsetHours * 3600 * 1000;
  const et = new Date(etMs);
  const dayOfWeek = et.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const timeInMinutes = et.getUTCHours() * 60 + et.getUTCMinutes();
  return timeInMinutes >= 9 * 60 && timeInMinutes < 16 * 60;
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Authenticate: accept service role key or valid project JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[RunAutomations] Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');

    if (token === supabaseServiceKey) {
      console.log('[RunAutomations] Authenticated via service role key');
    } else {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.ref !== 'pfszkghqoxybhbaouliw' && payload.iss !== 'supabase') {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          console.log('[RunAutomations] Authenticated via project JWT (role:', payload.role, ')');
        } else {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── MARKET HOURS GUARD ──
    if (!isMarketOpen()) {
      console.log('[RunAutomations] Outside market hours (9AM–4PM ET, Mon–Fri), skipping all pipelines');
      return new Response(JSON.stringify({ message: 'Outside market hours' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[RunAutomations] Starting automation run...');

    // ── PIPELINE 1: Stock Automations ──
    const { data: automations, error: autoErr } = await supabaseAdmin
      .from('stock_automations')
      .select('id, symbol, user_id')
      .eq('is_active', true);

    if (autoErr) {
      console.error('[RunAutomations] Failed to fetch automations:', autoErr);
    }

    const automationResults = [];
    if (automations && automations.length > 0) {
      console.log(`[RunAutomations] Processing ${automations.length} stock automations`);
      for (const automation of automations) {
        try {
          const monitorUrl = `${supabaseUrl}/functions/v1/stock-monitor`;
          const response = await fetch(monitorUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ automationId: automation.id }),
          });
          const result = await response.json();
          automationResults.push({ automationId: automation.id, symbol: automation.symbol, ...result });
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`[RunAutomations] Error processing automation ${automation.symbol}:`, err);
          automationResults.push({ automationId: automation.id, symbol: automation.symbol, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      // ── SELF-IMPROVEMENT CHECK ──
      // Fetch full automation data for self-improve-enabled bots
      const { data: fullAutomations } = await supabaseAdmin
        .from('stock_automations')
        .select('id, symbol, user_id, self_improve_enabled, last_optimization_at, optimization_generation, min_win_rate, max_drawdown_threshold, max_consecutive_losses')
        .eq('is_active', true)
        .eq('self_improve_enabled', true);

      if (fullAutomations && fullAutomations.length > 0) {
        for (const auto of fullAutomations) {
          try {
            // Cooldown: skip if optimized within last hour
            const lastOpt = auto.last_optimization_at ? new Date(auto.last_optimization_at).getTime() : 0;
            const oneHourAgo = Date.now() - 3600 * 1000;
            if (lastOpt > oneHourAgo) {
              console.log(`[RunAutomations] Self-improve cooldown active for ${auto.symbol}, skipping`);
              continue;
            }

            // Generation cap
            if ((auto.optimization_generation ?? 0) >= 50) {
              console.log(`[RunAutomations] Generation cap reached for ${auto.symbol}, skipping`);
              continue;
            }

            const optimizerUrl = `${supabaseUrl}/functions/v1/bot-optimizer`;

            // Stage 1: Check health
            const healthResp = await fetch(optimizerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ action: 'check-health', automation_id: auto.id }),
            });
            const healthResult = await healthResp.json();

            if (!healthResult.breached) {
              console.log(`[RunAutomations] ${auto.symbol} health OK, no optimization needed`);
              continue;
            }

            console.log(`[RunAutomations] ${auto.symbol} threshold breached: ${healthResult.triggerReason}`);

            // Stage 2: Parameter optimization
            const paramResp = await fetch(optimizerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ action: 'optimize-params', automation_id: auto.id }),
            });
            const paramResult = await paramResp.json();

            if (paramResult.improved) {
              // Apply optimized params
              await fetch(optimizerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
                body: JSON.stringify({
                  action: 'apply',
                  automation_id: auto.id,
                  new_config: paramResult.new_config,
                  trigger_reason: healthResult.triggerReason,
                  stage: 'parameter_optimization',
                  old_metrics: healthResult.metrics,
                  new_metrics: { sharpe_ratio: paramResult.new_sharpe },
                }),
              });
              console.log(`[RunAutomations] ${auto.symbol} param optimization applied (Sharpe: ${paramResult.old_sharpe} → ${paramResult.new_sharpe})`);
              continue;
            }

            // Stage 3: AI rewrite (only if param optimization didn't help)
            console.log(`[RunAutomations] ${auto.symbol} param optimization insufficient, trying AI rewrite`);
            const aiResp = await fetch(optimizerUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ action: 'ai-rewrite', automation_id: auto.id }),
            });
            const aiResult = await aiResp.json();

            if (aiResult.improved) {
              await fetch(optimizerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
                body: JSON.stringify({
                  action: 'apply',
                  automation_id: auto.id,
                  new_config: aiResult.new_config,
                  trigger_reason: healthResult.triggerReason,
                  stage: 'ai_rewrite',
                  old_metrics: healthResult.metrics,
                  new_metrics: aiResult.new_metrics || null,
                }),
              });
              console.log(`[RunAutomations] ${auto.symbol} AI rewrite applied`);
            } else {
              // Log failed attempt
              console.log(`[RunAutomations] ${auto.symbol} AI rewrite did not improve, no changes applied`);
            }
          } catch (selfImproveErr) {
            console.error(`[RunAutomations] Self-improve error for ${auto.symbol}:`, selfImproveErr);
          }
        }
      }
    }

    // ── PIPELINE 2: Deployed Model Signal Generation + Trade Mirroring ──
    const { data: deployedModels, error: depErr } = await supabaseAdmin
      .from('deployed_models')
      .select(`
        id, model_id, user_id, status, total_signals, total_trades, config,
        models(id, name, ticker, horizon, theta, position_size_percent, max_exposure_percent, indicators_config)
      `)
      .eq('status', 'running');

    if (depErr) {
      console.error('[RunAutomations] Failed to fetch deployed models:', depErr);
    }

    const modelResults = [];
    if (deployedModels && deployedModels.length > 0) {
      console.log(`[RunAutomations] Processing ${deployedModels.length} deployed models`);

      for (const deployment of deployedModels) {
        const model = deployment.models as any;
        if (!model || !model.ticker) {
          console.log(`[RunAutomations] Model ${deployment.model_id} has no ticker, skipping`);
          modelResults.push({ deploymentId: deployment.id, error: 'No ticker configured' });
          continue;
        }

        try {
          // Fetch owner's brokerage accounts – prefer live, fall back to paper
          const { data: brokerageAccounts, error: brokerErr } = await supabaseAdmin
            .from('user_brokerage_accounts')
            .select('*')
            .eq('user_id', deployment.user_id)
            .eq('broker_name', 'alpaca')
            .eq('is_active', true);

          const brokerageAccount = brokerageAccounts?.find((a: any) => a.account_type === 'live')
            || brokerageAccounts?.[0]
            || null;

          if (brokerErr || !brokerageAccount) {
            console.log(`[RunAutomations] No active brokerage account for model owner ${deployment.user_id}, skipping`);
            modelResults.push({ deploymentId: deployment.id, modelId: model.id, ticker: model.ticker, error: 'No brokerage account' });
            continue;
          }

          const alpacaApiKey = await decryptKey(brokerageAccount.api_key_encrypted, encryptionSecret);
          const alpacaApiSecret = await decryptKey(brokerageAccount.api_secret_encrypted, encryptionSecret);
          const alpacaHeaders = {
            'APCA-API-KEY-ID': alpacaApiKey,
            'APCA-API-SECRET-KEY': alpacaApiSecret,
          };

          // Fetch last 100 1-minute bars from Alpaca
          const maxBars = 100;
          const now = new Date();
          const start = new Date(now.getTime() - maxBars * 60 * 1000);
          const barsUrl = `https://data.alpaca.markets/v2/stocks/${model.ticker}/bars?timeframe=1Min&start=${start.toISOString()}&limit=${maxBars}&sort=asc`;

          console.log(`[RunAutomations] Fetching bars for model ${model.id} (${model.ticker})`);
          const barsResponse = await fetch(barsUrl, { headers: alpacaHeaders });

          if (!barsResponse.ok) {
            const errText = await barsResponse.text();
            console.error(`[RunAutomations] Bars API error for ${model.ticker}:`, errText);
            modelResults.push({ deploymentId: deployment.id, modelId: model.id, ticker: model.ticker, error: 'Failed to fetch market data' });
            continue;
          }

          const barsData = await barsResponse.json();
          const bars = barsData.bars || [];

          if (bars.length < 5) {
            console.log(`[RunAutomations] Not enough bar data for ${model.ticker}: ${bars.length} bars`);
            modelResults.push({ deploymentId: deployment.id, modelId: model.id, ticker: model.ticker, signal: 'HOLD', reason: 'Insufficient data' });
            continue;
          }

          const closes: number[] = bars.map((b: any) => b.c);
          const currentPrice = closes[closes.length - 1];

          // Generate signal using model's indicators_config
          const indicators = model.indicators_config || {};
          const theta = model.theta ?? 0.01;
          const { votes, compositeScore } = generateSignals(closes, bars, indicators, 30, 70);

          let signalType = 'HOLD';
          if (compositeScore > theta) signalType = 'BUY';
          else if (compositeScore < -theta) signalType = 'SELL';

          const confidence = Math.abs(compositeScore);

          console.log(`[RunAutomations] Model ${model.id} (${model.ticker}): Score=${compositeScore.toFixed(4)}, Signal=${signalType}`);

          // Calculate quantity based on position_size_percent and current price
          const positionSizePct = model.position_size_percent ?? 10;
          // Estimate notional from buying power — use a default of 1 share if we can't determine
          let quantity = 1;
          try {
            const acctResp = await fetch(
              brokerageAccount.account_type === 'live'
                ? 'https://api.alpaca.markets/v2/account'
                : 'https://paper-api.alpaca.markets/v2/account',
              { headers: alpacaHeaders }
            );
            if (acctResp.ok) {
              const acctData = await acctResp.json();
              const buyingPower = parseFloat(acctData.buying_power ?? '0');
              const notional = (positionSizePct / 100) * buyingPower;
              quantity = Math.max(0.01, parseFloat((notional / currentPrice).toFixed(2)));
            }
          } catch (_) { /* use default qty 1 */ }

          // Write signal to model_signals
          const { data: signalRecord, error: signalErr } = await supabaseAdmin
            .from('model_signals')
            .insert({
              model_id: model.id,
              ticker: model.ticker,
              signal_type: signalType,
              confidence,
              price_at_signal: currentPrice,
              quantity,
              metadata: { votes, compositeScore, barsUsed: bars.length, timeframe: '1Min' },
              status: 'pending',
            })
            .select()
            .single();

          if (signalErr) {
            console.error('[RunAutomations] Failed to insert signal:', signalErr);
            modelResults.push({ deploymentId: deployment.id, modelId: model.id, ticker: model.ticker, error: 'Failed to write signal' });
            continue;
          }

          // Update deployment stats
          await supabaseAdmin
            .from('deployed_models')
            .update({
              last_signal_at: new Date().toISOString(),
              total_signals: (deployment.total_signals || 0) + 1,
            })
            .eq('id', deployment.id);

          // If BUY or SELL, mirror trades to owner + all subscribers
          if (signalType !== 'HOLD') {
            await executeModelTrades(supabaseAdmin, deployment, model, signalRecord, encryptionSecret, resendApiKey);
          }

          // ── Live Metrics Aggregation ──
          // Compute win_rate and total_return from subscriber_trades for this model
          try {
            const { data: closedTrades } = await supabaseAdmin
              .from('subscriber_trades')
              .select('pnl, status')
              .eq('status', 'executed')
              .in(
                'signal_id',
                // get all signal ids for this model
                (await supabaseAdmin
                  .from('model_signals')
                  .select('id')
                  .eq('model_id', model.id)
                ).data?.map((s: any) => s.id) ?? []
              );

            if (closedTrades && closedTrades.length > 0) {
              const winningTrades = closedTrades.filter((t: any) => (t.pnl ?? 0) > 0).length;
              const liveWinRate = winningTrades / closedTrades.length;

              // Total return: sum of pnl / total allocation for this model
              const { data: allocs } = await supabaseAdmin
                .from('allocations')
                .select('allocated_amount, total_pnl')
                .eq('model_id', model.id)
                .eq('is_active', true);

              const totalAllocated = allocs?.reduce((sum: number, a: any) => sum + (a.allocated_amount ?? 0), 0) ?? 0;
              const totalPnl = allocs?.reduce((sum: number, a: any) => sum + (a.total_pnl ?? 0), 0) ?? 0;
              const liveTotalReturn = totalAllocated > 0 ? totalPnl / totalAllocated : null;

              // Total signals for this model
              const { count: totalSignalCount } = await supabaseAdmin
                .from('model_signals')
                .select('id', { count: 'exact', head: true })
                .eq('model_id', model.id);

              const metricsUpdate: any = {
                win_rate: liveWinRate,
                updated_at: new Date().toISOString(),
              };
              if (liveTotalReturn !== null) {
                metricsUpdate.total_return = liveTotalReturn;
              }

              await supabaseAdmin
                .from('models')
                .update(metricsUpdate)
                .eq('id', model.id);

              console.log(`[RunAutomations] Updated live metrics for model ${model.id}: win_rate=${liveWinRate.toFixed(3)}, total_return=${liveTotalReturn}`);
            }
          } catch (metricsErr) {
            console.error(`[RunAutomations] Failed to compute live metrics for model ${model.id}:`, metricsErr);
          }

          modelResults.push({
            deploymentId: deployment.id,
            modelId: model.id,
            ticker: model.ticker,
            signal: signalType,
            confidence: confidence.toFixed(4),
          });

          // Small delay between models to avoid rate limiting
          await new Promise(r => setTimeout(r, 300));

        } catch (err) {
          console.error(`[RunAutomations] Error processing model ${model.id}:`, err instanceof Error ? err.message : err);
          modelResults.push({ deploymentId: deployment.id, modelId: model?.id, ticker: model?.ticker, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
    }

    console.log(`[RunAutomations] Completed. Stock automations: ${automationResults.length}, Models: ${modelResults.length}`);

    return new Response(JSON.stringify({
      processed_automations: automationResults.length,
      processed_models: modelResults.length,
      automation_results: automationResults,
      model_results: modelResults,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[RunAutomations] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
