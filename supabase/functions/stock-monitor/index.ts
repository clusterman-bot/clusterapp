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

// ==================== SIGNAL GENERATION ====================

interface IndicatorVote {
  indicator: string;
  signal: number; // +1 BUY, -1 SELL, 0 NEUTRAL
  value: number | Record<string, number>;
  reason: string;
}

function generateSignals(
  closes: number[],
  bars: any[],
  indicators: any,
  rsiOversold: number,
  rsiOverbought: number
): { votes: IndicatorVote[]; compositeScore: number } {
  const votes: IndicatorVote[] = [];

  // RSI signals
  if (indicators.rsi?.enabled) {
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

  // SMA signals (price crossover)
  if (indicators.sma?.enabled) {
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

  // EMA signals
  if (indicators.ema?.enabled) {
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

  // Bollinger Bands
  if (indicators.bollinger?.enabled) {
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

  // SMA Deviation
  if (indicators.sma_deviation?.enabled) {
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

  // Custom AI-generated indicators
  const customIndicators = (indicators.custom || []) as Array<{
    name: string;
    description: string;
    signal_logic: string;
    code: string;
    weight: number;
    enabled: boolean;
  }>;

  for (const ci of customIndicators) {
    if (!ci.enabled || !ci.code) continue;
    try {
      // Execute the custom indicator code in a sandboxed Function
      // The code is the function body, bars are passed as argument
      const fn = new Function('bars', ci.code);
      const rawResult = fn(bars);
      // Clamp to -1, 0, 1
      let signal = 0;
      if (typeof rawResult === 'number' && isFinite(rawResult)) {
        signal = rawResult > 0 ? 1 : rawResult < 0 ? -1 : 0;
      }
      const weight = Math.max(0.1, Math.min(5.0, ci.weight ?? 1.0));
      // Push weighted votes (a weight > 1 means it contributes more)
      const weightedSignal = signal * weight;
      const reason = signal === 1
        ? `${ci.name}: BUY — ${ci.signal_logic}`
        : signal === -1
          ? `${ci.name}: SELL — ${ci.signal_logic}`
          : `${ci.name}: NEUTRAL`;
      votes.push({ indicator: `CUSTOM_${ci.name.toUpperCase().replace(/\s+/g, '_')}`, signal: weightedSignal, value: signal, reason });
      console.log(`[StockMonitor] Custom indicator ${ci.name}: signal=${signal}, weighted=${weightedSignal}`);
    } catch (ciErr) {
      console.error(`[StockMonitor] Custom indicator "${ci.name}" threw an error:`, ciErr);
      // Skip this indicator — don't let one bad function block the rest
    }
  }

  const totalVotes = votes.length;
  const compositeScore = totalVotes > 0 ? votes.reduce((sum, v) => sum + v.signal, 0) / totalVotes : 0;

  return { votes, compositeScore };
}

// ==================== ENCRYPTION ====================

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

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET')!;

    // ==================== AUTHENTICATION ====================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === supabaseServiceKey;

    let authenticatedUserId: string | null = null;

    if (!isServiceRole) {
      // Validate user JWT
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: 'Invalid authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      authenticatedUserId = claimsData.user.id;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { automationId } = body;

    if (!automationId) {
      return new Response(JSON.stringify({ error: 'automationId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch the automation config
    const { data: automation, error: autoErr } = await supabaseAdmin
      .from('stock_automations')
      .select('*')
      .eq('id', automationId)
      .eq('is_active', true)
      .single();

    if (autoErr || !automation) {
      return new Response(JSON.stringify({ error: 'Automation not found or inactive' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If user JWT (not service role), verify they own this automation
    if (authenticatedUserId && automation.user_id !== authenticatedUserId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (autoErr || !automation) {
      return new Response(JSON.stringify({ error: 'Automation not found or inactive' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { user_id, symbol, indicators, rsi_oversold, rsi_overbought, theta, max_quantity, horizon_minutes, allow_shorting } = automation;

    console.log(`[StockMonitor] Processing ${symbol} for user ${user_id}, horizon=${horizon_minutes}min, theta=${theta}`);

    // Fetch user's brokerage credentials
    const { data: brokerageAccount, error: brokerErr } = await supabaseAdmin
      .from('user_brokerage_accounts')
      .select('*')
      .eq('user_id', user_id)
      .eq('broker_name', 'alpaca')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (brokerErr || !brokerageAccount) {
      console.error(`[StockMonitor] No brokerage account for user ${user_id}`);
      return new Response(JSON.stringify({ error: 'No brokerage account connected' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const alpacaApiKey = await decryptKey(brokerageAccount.api_key_encrypted, encryptionSecret);
    const alpacaApiSecret = await decryptKey(brokerageAccount.api_secret_encrypted, encryptionSecret);
    const isPaper = brokerageAccount.account_type === 'paper';
    const alpacaBaseUrl = isPaper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';

    const alpacaHeaders = {
      'APCA-API-KEY-ID': alpacaApiKey,
      'APCA-API-SECRET-KEY': alpacaApiSecret,
    };

    // Fetch bars from Alpaca Data API
    // Always use 1-minute bars for maximum granularity. The horizon_minutes parameter
    // defines how far into the future the signal predicts, not the bar timeframe.
    const maxBars = 100;
    const now = new Date();
    const start = new Date(now.getTime() - maxBars * 60 * 1000); // 100 minutes of 1-min bars
    const timeframe = '1Min';

    const barsUrl = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=${timeframe}&start=${start.toISOString()}&limit=${maxBars}&sort=asc`;
    console.log(`[StockMonitor] Fetching bars: ${barsUrl}`);

    const barsResponse = await fetch(barsUrl, { headers: alpacaHeaders });
    if (!barsResponse.ok) {
      const errText = await barsResponse.text();
      console.error(`[StockMonitor] Bars API error: ${errText}`);
      return new Response(JSON.stringify({ error: 'Failed to fetch market data' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const barsData = await barsResponse.json();
    const bars = barsData.bars || [];

    if (bars.length < 5) {
      console.log(`[StockMonitor] Not enough bar data for ${symbol}: ${bars.length} bars`);
      // Update last_checked_at
      await supabaseAdmin.from('stock_automations').update({ last_checked_at: new Date().toISOString() }).eq('id', automationId);
      return new Response(JSON.stringify({ signal: 'HOLD', reason: 'Insufficient data' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const closes: number[] = bars.map((b: any) => b.c);
    const currentPrice = closes[closes.length - 1];

    // Generate signals
    const { votes, compositeScore } = generateSignals(closes, bars, indicators, rsi_oversold, rsi_overbought);

    let signalType = 'HOLD';
    if (compositeScore > theta) signalType = 'BUY';
    else if (compositeScore < -theta) signalType = 'SELL';

    const confidence = Math.abs(compositeScore);

    console.log(`[StockMonitor] ${symbol}: Score=${compositeScore.toFixed(4)}, Signal=${signalType}, Confidence=${confidence.toFixed(4)}, Votes=${votes.length}`);

    // Log the signal
    const signalRecord: any = {
      automation_id: automationId,
      user_id,
      symbol,
      signal_type: signalType,
      confidence,
      price_at_signal: currentPrice,
      indicator_snapshot: { votes, compositeScore, barsUsed: bars.length, timeframe },
      trade_executed: false,
    };

    // Execute trade if signal is BUY or SELL
    if (signalType !== 'HOLD') {
      try {
        const side = signalType.toLowerCase();
        let qty = Math.min(max_quantity, Math.max(1, Math.floor(max_quantity * confidence)));

        // For SELL signals, check position unless shorting is allowed
        if (side === 'sell' && !allow_shorting) {
          try {
            const posResponse = await fetch(`${alpacaBaseUrl}/v2/positions/${symbol}`, { headers: alpacaHeaders });
            if (posResponse.status === 404 || !posResponse.ok) {
              console.log(`[StockMonitor] No position in ${symbol}, skipping SELL signal (shorting disabled)`);
              signalRecord.trade_executed = false;
              signalRecord.error_message = 'No position held — SELL skipped (shorting disabled)';
              const { error: insertErr } = await supabaseAdmin.from('automation_signals').insert(signalRecord);
              if (insertErr) console.error('[StockMonitor] Failed to insert signal:', insertErr);
              await supabaseAdmin.from('stock_automations').update({ last_checked_at: new Date().toISOString() }).eq('id', automationId);
              return new Response(JSON.stringify({ signal: signalType, traded: false, reason: 'No position held' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            const posData = await posResponse.json();
            const heldQty = parseFloat(posData.qty || '0');
            if (heldQty <= 0) {
              console.log(`[StockMonitor] Zero/short position in ${symbol}, skipping SELL (shorting disabled)`);
              signalRecord.error_message = 'Zero/short position — SELL skipped (shorting disabled)';
              const { error: insertErr } = await supabaseAdmin.from('automation_signals').insert(signalRecord);
              if (insertErr) console.error('[StockMonitor] Failed to insert signal:', insertErr);
              await supabaseAdmin.from('stock_automations').update({ last_checked_at: new Date().toISOString() }).eq('id', automationId);
              return new Response(JSON.stringify({ signal: signalType, traded: false, reason: 'Zero position' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
            // Don't sell more than we hold
            qty = Math.min(qty, Math.floor(heldQty));
            console.log(`[StockMonitor] Holding ${heldQty} shares of ${symbol}, will sell ${qty}`);
          } catch (posErr) {
            console.error(`[StockMonitor] Error checking position for ${symbol}:`, posErr);
            signalRecord.error_message = 'Failed to check position — SELL skipped';
            const { error: insertErr } = await supabaseAdmin.from('automation_signals').insert(signalRecord);
            if (insertErr) console.error('[StockMonitor] Failed to insert signal:', insertErr);
            await supabaseAdmin.from('stock_automations').update({ last_checked_at: new Date().toISOString() }).eq('id', automationId);
            return new Response(JSON.stringify({ signal: signalType, traded: false, reason: 'Position check failed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } else if (side === 'sell' && allow_shorting) {
          console.log(`[StockMonitor] Shorting allowed for ${symbol}, proceeding with SELL without position check`);
        }

        console.log(`[StockMonitor] Placing ${side} order: ${qty} shares of ${symbol} at ~${currentPrice}`);

        const orderResponse = await fetch(`${alpacaBaseUrl}/v2/orders`, {
          method: 'POST',
          headers: { ...alpacaHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol,
            qty: qty.toString(),
            side,
            type: 'market',
            time_in_force: 'day',
          }),
        });

        const orderData = await orderResponse.json();

        if (orderResponse.ok) {
          signalRecord.trade_executed = true;
          signalRecord.alpaca_order_id = orderData.id;

          // Poll for fill (up to 5 seconds)
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const statusRes = await fetch(`${alpacaBaseUrl}/v2/orders/${orderData.id}`, { headers: alpacaHeaders });
            const statusData = await statusRes.json();
            if (statusData.status === 'filled') {
              signalRecord.executed_price = parseFloat(statusData.filled_avg_price);
              break;
            }
          }

          console.log(`[StockMonitor] Order placed: ${orderData.id}, filled_price=${signalRecord.executed_price}`);
        } else {
          console.error(`[StockMonitor] Order failed:`, orderData);
          signalRecord.error_message = orderData.message || 'Order placement failed';
        }
      } catch (tradeErr) {
        console.error(`[StockMonitor] Trade execution error:`, tradeErr);
        signalRecord.error_message = tradeErr instanceof Error ? tradeErr.message : 'Trade execution error';
      }
    }

    // Insert signal record
    const { error: insertErr } = await supabaseAdmin.from('automation_signals').insert(signalRecord);
    if (insertErr) console.error('[StockMonitor] Failed to insert signal:', insertErr);

    // Update automation stats
    const updateData: any = {
      last_checked_at: new Date().toISOString(),
      total_signals: (automation.total_signals || 0) + 1,
    };
    if (signalType !== 'HOLD') {
      updateData.last_signal_at = new Date().toISOString();
    }
    if (signalRecord.trade_executed) {
      updateData.total_trades = (automation.total_trades || 0) + 1;
    }
    await supabaseAdmin.from('stock_automations').update(updateData).eq('id', automationId);

    return new Response(JSON.stringify({
      signal: signalType,
      confidence,
      price: currentPrice,
      votes,
      compositeScore,
      tradeExecuted: signalRecord.trade_executed,
      orderId: signalRecord.alpaca_order_id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[StockMonitor] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
