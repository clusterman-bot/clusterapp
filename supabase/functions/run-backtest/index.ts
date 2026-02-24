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

function calculateBollingerBands(closes: number[], window: number, numStd: number) {
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

function generateSignalForBar(
  closesUpToBar: number[],
  barsUpToBar: any[],
  indicators: any,
  rsiOversold: number,
  rsiOverbought: number
): number {
  const votes: number[] = [];

  if (indicators?.rsi?.enabled) {
    for (const period of (indicators.rsi.periods || [14])) {
      const rsi = calculateRSI(closesUpToBar, period);
      if (rsi !== null) {
        if (rsi <= rsiOversold) votes.push(1);
        else if (rsi >= rsiOverbought) votes.push(-1);
        else votes.push(0);
      }
    }
  }

  if (indicators?.sma?.enabled) {
    for (const window of (indicators.sma.windows || [5, 20])) {
      const sma = calculateSMA(closesUpToBar, window);
      if (sma !== null) {
        const price = closesUpToBar[closesUpToBar.length - 1];
        if (price > sma * 1.001) votes.push(1);
        else if (price < sma * 0.999) votes.push(-1);
        else votes.push(0);
      }
    }
  }

  if (indicators?.ema?.enabled) {
    for (const window of (indicators.ema.windows || [5, 20])) {
      const ema = calculateEMA(closesUpToBar, window);
      if (ema !== null) {
        const price = closesUpToBar[closesUpToBar.length - 1];
        if (price > ema * 1.001) votes.push(1);
        else if (price < ema * 0.999) votes.push(-1);
        else votes.push(0);
      }
    }
  }

  if (indicators?.bollinger?.enabled) {
    const window = indicators.bollinger.window || 20;
    const std = indicators.bollinger.std || 2;
    const bb = calculateBollingerBands(closesUpToBar, window, std);
    if (bb !== null) {
      if (bb.percentB <= 0.05) votes.push(1);
      else if (bb.percentB >= 0.95) votes.push(-1);
      else votes.push(0);
    }
  }

  if (indicators?.sma_deviation?.enabled) {
    const window = indicators.sma_deviation.window || 20;
    const dev = calculateSMADeviation(closesUpToBar, window);
    if (dev !== null) {
      if (dev < -2) votes.push(1);
      else if (dev > 2) votes.push(-1);
      else votes.push(0);
    }
  }

  // Custom indicators
  const customIndicators = (indicators?.custom || []) as Array<any>;
  for (const ci of customIndicators) {
    if (!ci.enabled || !ci.code) continue;
    try {
      const fn = new Function('bars', ci.code);
      const rawResult = fn(barsUpToBar);
      if (typeof rawResult === 'number' && isFinite(rawResult)) {
        const signal = rawResult > 0 ? 1 : rawResult < 0 ? -1 : 0;
        const weight = Math.max(0.1, Math.min(5.0, ci.weight ?? 1.0));
        votes.push(signal * weight);
      }
    } catch (_) { /* skip bad custom indicator */ }
  }

  if (votes.length === 0) return 0;
  return votes.reduce((a, b) => a + b, 0) / votes.length;
}

// ==================== DECRYPTION (same as run-automations) ====================

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
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');

    if (!encryptionSecret) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      symbol,
      indicators,
      rsi_oversold = 30,
      rsi_overbought = 70,
      theta = 0.03,
      position_size_percent = 95,
      stop_loss_percent = 5,
      take_profit_percent = 10,
      start_date,
      end_date,
      initial_capital = 100000,
      model_id,
    } = body;

    if (!symbol || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'symbol, start_date, and end_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Backtest] Starting for ${symbol} from ${start_date} to ${end_date}, capital=$${initial_capital}`);

    // Get user's brokerage account
    const { data: brokerageAccount, error: accError } = await supabaseAdmin
      .from('user_brokerage_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('broker_name', 'alpaca')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (accError || !brokerageAccount) {
      return new Response(JSON.stringify({ error: 'No brokerage account connected. Please connect your Alpaca account first.', needsConnection: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const alpacaApiKey = await decryptKey(brokerageAccount.api_key_encrypted, encryptionSecret);
    const alpacaApiSecret = await decryptKey(brokerageAccount.api_secret_encrypted, encryptionSecret);
    const alpacaHeaders = {
      'APCA-API-KEY-ID': alpacaApiKey,
      'APCA-API-SECRET-KEY': alpacaApiSecret,
    };

    // Fetch historical bars
    const isCrypto = symbol.includes('/');
    let bars: any[] = [];

    if (isCrypto) {
      const params = new URLSearchParams({
        symbols: symbol.toUpperCase(),
        timeframe: '1Day',
        start: start_date,
        end: end_date,
        limit: '10000',
        sort: 'asc',
      });
      const resp = await fetch(`https://data.alpaca.markets/v1beta3/crypto/us/bars?${params}`, { headers: alpacaHeaders });
      if (!resp.ok) {
        const err = await resp.text();
        console.error('[Backtest] Crypto bars error:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch historical data from Alpaca' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const data = await resp.json();
      const symbolBars = data.bars?.[symbol.toUpperCase()] || [];
      bars = symbolBars.map((b: any) => ({ date: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
    } else {
      const params = new URLSearchParams({
        timeframe: '1Day',
        start: start_date,
        end: end_date,
        limit: '10000',
        adjustment: 'raw',
        feed: 'iex',
        sort: 'asc',
      });
      const resp = await fetch(`https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars?${params}`, { headers: alpacaHeaders });
      if (!resp.ok) {
        const err = await resp.text();
        console.error('[Backtest] Stock bars error:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch historical data from Alpaca' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const data = await resp.json();
      bars = (data.bars || []).map((b: any) => ({ date: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
    }

    console.log(`[Backtest] Fetched ${bars.length} bars for ${symbol}`);

    if (bars.length < 10) {
      return new Response(JSON.stringify({ error: `Insufficient data: only ${bars.length} bars found for ${symbol} in the selected date range.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== TRADE SIMULATION ====================
    let cash = initial_capital;
    let position = 0; // shares held
    let entryPrice = 0;
    const trades: any[] = [];
    const equityCurve: { date: string; value: number }[] = [];
    const dailyReturns: number[] = [];
    let prevEquity = initial_capital;

    for (let i = 50; i < bars.length; i++) { // start at 50 to warm up indicators
      const closesUpTo = bars.slice(0, i + 1).map((b: any) => b.close);
      const barsUpTo = bars.slice(0, i + 1);
      const bar = bars[i];
      const price = bar.close;

      // Calculate equity
      const equity = cash + position * price;
      const dailyReturn = prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0;
      dailyReturns.push(dailyReturn);
      prevEquity = equity;

      equityCurve.push({ date: bar.date, value: parseFloat(equity.toFixed(2)) });

      // Check stop-loss / take-profit if in position
      if (position > 0 && entryPrice > 0) {
        const pnlPct = ((price - entryPrice) / entryPrice) * 100;
        if (pnlPct <= -stop_loss_percent) {
          // Stop loss hit
          const pnl = (price - entryPrice) * position;
          trades.push({
            side: 'sell', ticker: symbol, quantity: position,
            entry_price: entryPrice, exit_price: price,
            entry_date: trades[trades.length - 1]?.entry_date || bar.date,
            exit_date: bar.date, pnl: parseFloat(pnl.toFixed(2)),
            pnl_percent: parseFloat(pnlPct.toFixed(2)), reason: 'stop_loss',
          });
          cash += position * price;
          position = 0;
          entryPrice = 0;
          continue;
        }
        if (pnlPct >= take_profit_percent) {
          // Take profit hit
          const pnl = (price - entryPrice) * position;
          trades.push({
            side: 'sell', ticker: symbol, quantity: position,
            entry_price: entryPrice, exit_price: price,
            entry_date: trades[trades.length - 1]?.entry_date || bar.date,
            exit_date: bar.date, pnl: parseFloat(pnl.toFixed(2)),
            pnl_percent: parseFloat(pnlPct.toFixed(2)), reason: 'take_profit',
          });
          cash += position * price;
          position = 0;
          entryPrice = 0;
          continue;
        }
      }

      // Generate composite signal
      const compositeScore = generateSignalForBar(closesUpTo, barsUpTo, indicators, rsi_oversold, rsi_overbought);

      // BUY signal
      if (compositeScore >= theta && position === 0) {
        const investAmount = cash * (position_size_percent / 100);
        const qty = Math.floor((investAmount / price) * 100) / 100; // 2 decimal places for fractional
        if (qty > 0 && investAmount > 0) {
          position = qty;
          entryPrice = price;
          cash -= qty * price;
          trades.push({
            side: 'buy', ticker: symbol, quantity: qty,
            entry_price: price, exit_price: null,
            entry_date: bar.date, exit_date: null,
            pnl: null, pnl_percent: null, reason: 'signal',
          });
        }
      }
      // SELL signal
      else if (compositeScore <= -theta && position > 0) {
        const pnl = (price - entryPrice) * position;
        const pnlPct = entryPrice > 0 ? ((price - entryPrice) / entryPrice) * 100 : 0;
        // Find the matching buy trade entry_date
        const lastBuyTrade = [...trades].reverse().find(t => t.side === 'buy' && !t.exit_date);
        trades.push({
          side: 'sell', ticker: symbol, quantity: position,
          entry_price: entryPrice, exit_price: price,
          entry_date: lastBuyTrade?.entry_date || bar.date,
          exit_date: bar.date, pnl: parseFloat(pnl.toFixed(2)),
          pnl_percent: parseFloat(pnlPct.toFixed(2)), reason: 'signal',
        });
        cash += position * price;
        position = 0;
        entryPrice = 0;
      }
    }

    // Close any remaining position at the last bar
    if (position > 0 && bars.length > 0) {
      const lastBar = bars[bars.length - 1];
      const pnl = (lastBar.close - entryPrice) * position;
      const pnlPct = entryPrice > 0 ? ((lastBar.close - entryPrice) / entryPrice) * 100 : 0;
      const lastBuyTrade = [...trades].reverse().find(t => t.side === 'buy' && !t.exit_date);
      trades.push({
        side: 'sell', ticker: symbol, quantity: position,
        entry_price: entryPrice, exit_price: lastBar.close,
        entry_date: lastBuyTrade?.entry_date || lastBar.date,
        exit_date: lastBar.date, pnl: parseFloat(pnl.toFixed(2)),
        pnl_percent: parseFloat(pnlPct.toFixed(2)), reason: 'end_of_period',
      });
      cash += position * lastBar.close;
      position = 0;
    }

    // ==================== METRICS ====================
    const finalEquity = cash;
    const totalReturn = ((finalEquity - initial_capital) / initial_capital) * 100;

    // Closed trades only
    const closedTrades = trades.filter(t => t.side === 'sell');
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    // Profit factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Max drawdown
    let peak = initial_capital;
    let maxDrawdown = 0;
    for (const point of equityCurve) {
      if (point.value > peak) peak = point.value;
      const dd = ((peak - point.value) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Sharpe & Sortino (annualized, assuming 252 trading days)
    const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const stdDev = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1))
      : 0;
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    const downsideReturns = dailyReturns.filter(r => r < 0);
    const downsideDev = downsideReturns.length > 1
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
      : 0;
    const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

    // CAGR
    const daysDiff = (new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 60 * 60 * 24);
    const years = daysDiff / 365.25;
    const cagr = years > 0 ? (Math.pow(finalEquity / initial_capital, 1 / years) - 1) * 100 : 0;

    const metrics = {
      total_return: parseFloat(totalReturn.toFixed(2)),
      sharpe_ratio: parseFloat(sharpeRatio.toFixed(2)),
      sortino_ratio: parseFloat(sortinoRatio.toFixed(2)),
      max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
      win_rate: parseFloat(winRate.toFixed(1)),
      profit_factor: profitFactor === Infinity ? 999 : parseFloat(profitFactor.toFixed(2)),
      cagr: parseFloat(cagr.toFixed(2)),
      total_trades: closedTrades.length,
      initial_capital,
      final_equity: parseFloat(finalEquity.toFixed(2)),
    };

    console.log(`[Backtest] Complete: ${closedTrades.length} trades, return=${metrics.total_return}%, sharpe=${metrics.sharpe_ratio}`);

    // Optionally save to DB if model_id provided
    if (model_id) {
      try {
        await supabaseAdmin.from('backtests').insert({
          model_id,
          user_id: userId,
          name: `Backtest ${symbol} ${start_date} to ${end_date}`,
          start_date,
          end_date,
          initial_capital,
          status: 'completed',
          total_return: metrics.total_return,
          sharpe_ratio: metrics.sharpe_ratio,
          sortino_ratio: metrics.sortino_ratio,
          max_drawdown: metrics.max_drawdown,
          win_rate: metrics.win_rate,
          profit_factor: metrics.profit_factor,
          cagr: metrics.cagr,
          total_trades: metrics.total_trades,
          equity_curve: equityCurve,
          completed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('[Backtest] Failed to save to DB:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      metrics,
      equity_curve: equityCurve,
      trades: closedTrades,
      bars_count: bars.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('[Backtest] Error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ error: 'An error occurred during backtesting' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
