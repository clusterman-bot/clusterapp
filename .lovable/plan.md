

# System Limitations Analysis & Fixes

After examining your backtest network requests and the edge function code, here's what's limiting your results:

## Key Limitations Found

### 1. IEX Feed (BIGGEST issue)
The backtest engine uses `feed: 'iex'` when fetching stock bars from Alpaca. IEX captures roughly 2-3% of total US equity market volume. For 1-minute bars, this means many minutes simply have **no bar at all** because no IEX trade occurred. Switching to `feed: 'sip'` (full consolidated tape) will dramatically increase bar count — from potentially a few hundred to ~23,000+ bars for a 60-day 1Min window on SPY.

### 2. Signal Sampling (signalEvery = 5 for 1Min)
On 1-minute timeframe, the engine only evaluates indicator signals every 5th bar as a performance optimization. This means 80% of bars are only checked for stop-loss/take-profit, but never generate new entry signals. This reduces trade count.

### 3. MAX_BARS = 25,000 per chunk
This is a safety cap. With SIP data it could be hit more easily on 60-day 1Min windows (~23,400 trading bars). The current 60-day chunk size is actually well-calibrated for this.

### 4. Chunk window = 60 days for 1Min
This is reasonable and doesn't need changing.

## Plan

**File: `supabase/functions/run-backtest/index.ts`**

| Change | Detail |
|--------|--------|
| Switch `feed` from `'iex'` to `'sip'` (line 364) | Full consolidated market data instead of partial IEX feed |
| Reduce `signalEvery` for 1Min from 5 to 2 (line 266) | Evaluate signals every 2nd bar instead of every 5th — more entry opportunities while still performant |
| Increase `MAX_BARS` from 25,000 to 50,000 (line 318) | Allow more data per chunk now that SIP provides denser bars |

These three changes should increase your bar count by 10-50x on stock tickers and result in significantly more trades. No frontend changes needed.

