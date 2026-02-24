

## Why You're Only Getting ~27 Trades

The low trade count is caused by three compounding factors in the current backtest engine:

### Root Causes

**1. Daily bars only (~250 bars/year)**
The engine hardcodes `timeframe: '1Day'` when fetching from Alpaca. Over a 1-year period, that's only ~250 data points. With 50 bars consumed for indicator warm-up, only ~200 bars are evaluated for signals. Compare this to 15-minute bars which would give ~6,500 bars per year.

**2. Single position at a time**
The simulation only allows one open position. While a trade is active (waiting for stop-loss, take-profit, or sell signal), all new buy signals are ignored. A trade held for 20 days means 20 days of missed opportunities.

**3. Composite scoring requires consensus**
All enabled indicators (RSI, EMA, Bollinger, etc.) are averaged into a single score. The score must exceed `theta` (e.g., 0.05) to trigger a trade. When indicators disagree, the average stays near zero and no trade fires. This is by design for live trading safety, but kills trade frequency in backtests.

### Plan: Add Intraday Timeframe Support

The highest-impact fix is letting users select the bar timeframe. Switching from daily to 15-minute bars increases data points from ~250/year to ~6,500/year, dramatically increasing trade opportunities.

**1. Edge function `supabase/functions/run-backtest/index.ts`**
- Accept a new `timeframe` parameter (default `'1Day'`, options: `'1Min'`, `'5Min'`, `'15Min'`, `'1Hour'`, `'1Day'`)
- Pass it to the Alpaca bars API call instead of hardcoded `'1Day'`
- Adjust Sharpe/Sortino annualization factor based on timeframe (252 for daily, 252*6.5*4 for 15min, etc.)
- Reduce warm-up window proportionally for intraday (e.g., start at bar 50 for daily, bar 200 for 15min to cover equivalent indicator warm-up)
- Note: Alpaca free tier limits intraday data to the last 5-7 years for stocks; crypto has broader availability

**2. Frontend `src/components/backtest/BacktestPanel.tsx`**
- Add a "Timeframe" dropdown selector with options: 1 Min, 5 Min, 15 Min, 1 Hour, 1 Day
- Pass the selected timeframe to the edge function call
- Show bar count in results (already returned as `bars_count`)
- Default to `'1Day'` for backward compatibility

**3. No database changes needed**

### Technical Details

- Alpaca's bars endpoint supports these timeframes natively via the `timeframe` query parameter
- Intraday data returns significantly more bars: a 1-year range at 15Min resolution yields ~6,500 bars for stocks (6.5 hours * 4 bars/hour * 252 trading days)
- The warm-up period (currently fixed at 50 bars) should scale: 50 for daily, but the longest indicator window (e.g., EMA 48) determines the real minimum
- Annualization factor for Sharpe ratio changes: daily uses sqrt(252), hourly uses sqrt(252*6.5), 15-min uses sqrt(252*6.5*4)

### Expected Impact

With 15-minute bars over 1 year, users should see hundreds to thousands of signal evaluations and significantly more trades, matching the volume expected from platforms like QuantConnect.

