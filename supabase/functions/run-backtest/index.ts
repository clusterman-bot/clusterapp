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
  rsiOverbought: number,
  compiledCustomIndicators?: Array<{ fn: Function; weight: number }>
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

  // Custom indicators (pre-compiled functions passed in)
  const compiledCustom = (compiledCustomIndicators || []) as Array<{ fn: Function; weight: number }>;
  for (const ci of compiledCustom) {
    try {
      const rawResult = ci.fn(barsUpToBar);
      if (typeof rawResult === 'number' && isFinite(rawResult)) {
        const signal = rawResult > 0 ? 1 : rawResult < 0 ? -1 : 0;
        votes.push(signal * ci.weight);
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
      timeframe = '1Day',
      chunk_mode = false,
      carry_over = null,
    } = body;

    // Map timeframe to annualization factor and warm-up bars
    const timeframeConfig: Record<string, { annualization: number; warmup: number; alpacaTimeframe: string }> = {
      '1Min':  { annualization: 252 * 6.5 * 60, warmup: 200, alpacaTimeframe: '1Min', signalEvery: 2 },
      '5Min':  { annualization: 252 * 6.5 * 12, warmup: 200, alpacaTimeframe: '5Min', signalEvery: 2 },
      '15Min': { annualization: 252 * 6.5 * 4,  warmup: 200, alpacaTimeframe: '15Min', signalEvery: 1 },
      '1Hour': { annualization: 252 * 6.5,       warmup: 100, alpacaTimeframe: '1Hour', signalEvery: 1 },
      '1Day':  { annualization: 252,              warmup: 50,  alpacaTimeframe: '1Day', signalEvery: 1 },
    };
    const tfConfig = timeframeConfig[timeframe] || timeframeConfig['1Day'];

    if (!symbol || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'symbol, start_date, and end_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[Backtest] Starting for ${symbol} from ${start_date} to ${end_date}, timeframe=${timeframe}, capital=$${initial_capital}`);

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

    // Known crypto tickers — auto-append /USD if bare symbol provided
    const KNOWN_CRYPTO = new Set(['BTC','ETH','SOL','DOGE','AVAX','MATIC',
      'LINK','UNI','AAVE','DOT','ADA','XRP','LTC','SHIB','ALGO','ATOM',
      'FIL','NEAR','APE','ARB','OP','CRV','MKR','SUSHI','PEPE','BCH']);

    let normalizedSymbol = symbol.toUpperCase();
    if (!normalizedSymbol.includes('/') && KNOWN_CRYPTO.has(normalizedSymbol)) {
      normalizedSymbol = `${normalizedSymbol}/USD`;
      console.log(`[Backtest] Auto-detected crypto symbol, normalized to ${normalizedSymbol}`);
    }

    // Fetch historical bars with pagination
    const isCrypto = normalizedSymbol.includes('/');
    let bars: any[] = [];
    const MAX_BARS = 25000;

    if (isCrypto) {
      let pageToken: string | null = null;
      let page = 0;
      while (bars.length < MAX_BARS) {
        const params = new URLSearchParams({
          timeframe: tfConfig.alpacaTimeframe,
          start: start_date,
          end: end_date,
          limit: '10000',
          sort: 'asc',
        });
        if (pageToken) params.set('page_token', pageToken);
        // Don't let URLSearchParams encode the / in crypto symbols like SOL/USD
        const cryptoUrl = `https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(normalizedSymbol).replace('%2F', '/')}&${params}`;
        console.log(`[Backtest] Crypto URL: ${cryptoUrl}`);
        const resp = await fetch(cryptoUrl, { headers: alpacaHeaders });
        if (!resp.ok) {
          const err = await resp.text();
          console.error('[Backtest] Crypto bars error:', err);
          if (bars.length === 0) {
            return new Response(JSON.stringify({ error: 'Failed to fetch historical data from Alpaca' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          break;
        }
        const data = await resp.json();
        console.log(`[Backtest] Crypto response keys: ${JSON.stringify(Object.keys(data))}, bars keys: ${JSON.stringify(Object.keys(data.bars || {}))}`);
        const symbolBars = data.bars?.[normalizedSymbol] || data.bars?.[symbol.toUpperCase()] || [];
        bars.push(...symbolBars.map((b: any) => ({ date: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v })));
        page++;
        console.log(`[Backtest] Crypto page ${page}: fetched ${symbolBars.length} bars, total=${bars.length}`);
        pageToken = data.next_page_token || null;
        if (!pageToken || symbolBars.length === 0) break;
      }
    } else {
      let pageToken: string | null = null;
      let page = 0;
      while (bars.length < MAX_BARS) {
        const params = new URLSearchParams({
          timeframe: tfConfig.alpacaTimeframe,
          start: start_date,
          end: end_date,
          limit: '10000',
          adjustment: 'raw',
          feed: 'iex',
          sort: 'asc',
        });
        if (pageToken) params.set('page_token', pageToken);
        const resp = await fetch(`https://data.alpaca.markets/v2/stocks/${normalizedSymbol}/bars?${params}`, { headers: alpacaHeaders });
        if (!resp.ok) {
          const err = await resp.text();
          console.error('[Backtest] Stock bars error:', err);
          if (bars.length === 0) {
            return new Response(JSON.stringify({ error: 'Failed to fetch historical data from Alpaca' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          break;
        }
        const data = await resp.json();
        const pageBars = (data.bars || []).map((b: any) => ({ date: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
        bars.push(...pageBars);
        page++;
        console.log(`[Backtest] Stock page ${page}: fetched ${pageBars.length} bars, total=${bars.length}`);
        pageToken = data.next_page_token || null;
        if (!pageToken || pageBars.length === 0) break;
      }
    }

    if (bars.length >= MAX_BARS) {
      bars = bars.slice(0, MAX_BARS);
      console.log(`[Backtest] Hit ${MAX_BARS} bar cap, proceeding with partial data`);
    }

    console.log(`[Backtest] Fetched ${bars.length} bars for ${normalizedSymbol}`);

    if (bars.length < 10) {
      // In chunk mode, 0 bars on the final chunk is normal (e.g. today's date with no market data yet)
      if (chunk_mode) {
        return new Response(JSON.stringify({
          skip: true,
          trades: [],
          raw_equity_curve: [],
          raw_daily_returns: [],
          bars_count: 0,
          carry_over: carry_over || { cash: initial_capital, position: 0, entry_price: 0 },
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: `Insufficient data: only ${bars.length} bars found for ${normalizedSymbol} in the selected date range. Try an earlier end date or a different timeframe.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== TRADE SIMULATION ====================
    // Pre-compute all closes once to avoid repeated .map() calls
    const allCloses = bars.map((b: any) => b.close);
    const INDICATOR_WINDOW = 200; // max lookback needed for any indicator

    // Initialize from carry_over if provided (chunked backtesting)
    let cash = carry_over ? carry_over.cash : initial_capital;
    let position = carry_over ? carry_over.position : 0;
    let entryPrice = carry_over ? carry_over.entryPrice : 0;
    const effectiveInitialCapital = carry_over ? (carry_over.cash + carry_over.position * (bars[0]?.close || 0)) : initial_capital;
    const trades: any[] = [];
    const rawEquityCurve: { date: string; value: number }[] = [];
    const dailyReturns: number[] = [];
    let prevEquity = effectiveInitialCapital;

    // Pre-compile custom indicator functions once (avoid new Function() per bar)
    const compiledCustom: Array<{ fn: Function; weight: number }> = [];
    const customIndicators = (indicators?.custom || []) as Array<any>;
    for (const ci of customIndicators) {
      if (!ci.enabled || !ci.code) continue;
      try {
        const fn = new Function('bars', ci.code);
        compiledCustom.push({ fn, weight: Math.max(0.1, Math.min(5.0, ci.weight ?? 1.0)) });
      } catch (_) { /* skip bad custom indicator */ }
    }

    const warmup = Math.min(tfConfig.warmup, Math.floor(bars.length * 0.1));
    const startIdx = Math.max(warmup, 50);
    for (let i = startIdx; i < bars.length; i++) { // start after warm-up period
      // Use sliding window instead of slicing from 0 every time
      const windowStart = Math.max(0, i + 1 - INDICATOR_WINDOW);
      const closesWindow = allCloses.slice(windowStart, i + 1);
      const barsWindow = bars.slice(windowStart, i + 1);
      const bar = bars[i];
      const price = bar.close;

      // Calculate equity
      const equity = cash + position * price;
      const dailyReturn = prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0;
      dailyReturns.push(dailyReturn);
      prevEquity = equity;

      rawEquityCurve.push({ date: bar.date, value: parseFloat(equity.toFixed(2)) });

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

      // Only evaluate expensive indicators every N bars (stop-loss/take-profit still checked every bar above)
      const signalEvery = tfConfig.signalEvery || 1;
      if ((i - startIdx) % signalEvery !== 0) continue;

      // Generate composite signal
      const compositeScore = generateSignalForBar(closesWindow, barsWindow, indicators, rsi_oversold, rsi_overbought, compiledCustom);

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

    // In chunk_mode, DON'T close remaining position — carry it to next chunk
    if (!chunk_mode && position > 0 && bars.length > 0) {
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

    // Closed trades only
    const closedTrades = trades.filter(t => t.side === 'sell');

    // In chunk_mode, return raw data + carry_over state for stitching
    if (chunk_mode) {
      const lastPrice = bars.length > 0 ? bars[bars.length - 1].close : 0;
      const finalEquityChunk = cash + position * lastPrice;
      console.log(`[Backtest] Chunk complete: ${closedTrades.length} trades, ${bars.length} bars, equity=$${finalEquityChunk.toFixed(2)}`);
      return new Response(JSON.stringify({
        success: true,
        trades: closedTrades,
        bars_count: bars.length,
        raw_equity_curve: rawEquityCurve,
        raw_daily_returns: dailyReturns,
        carry_over: { cash, position, entryPrice },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== METRICS (non-chunk mode) ====================
    const finalEquity = cash;
    const totalReturn = ((finalEquity - initial_capital) / initial_capital) * 100;

    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    let peak = initial_capital;
    let maxDrawdown = 0;
    for (const point of rawEquityCurve) {
      if (point.value > peak) peak = point.value;
      const dd = ((peak - point.value) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const MAX_CURVE_POINTS = 500;
    let equityCurve = rawEquityCurve;
    if (rawEquityCurve.length > MAX_CURVE_POINTS) {
      const step = Math.ceil(rawEquityCurve.length / MAX_CURVE_POINTS);
      equityCurve = rawEquityCurve.filter((_, idx) => idx % step === 0 || idx === rawEquityCurve.length - 1);
    }

    const annFactor = tfConfig.annualization;
    const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const stdDev = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1))
      : 0;
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(annFactor) : 0;

    const downsideReturns = dailyReturns.filter(r => r < 0);
    const downsideDev = downsideReturns.length > 1
      ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
      : 0;
    const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(annFactor) : 0;

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
