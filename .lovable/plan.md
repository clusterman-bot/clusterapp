

## Plan: Add Backtesting to AI Bot Builder + Use Alpaca Historical Data

### Answering your question about data sources

Your existing Alpaca keys already support historical bar data for both stocks and crypto — the `get-bars` and `get-crypto-bars` endpoints are already implemented in the `alpaca-trading` edge function. No additional API key is needed. The backtest engine will use the same brokerage credentials the user has linked.

### What changes

Add a "Backtest" tab/button to the AI Bot Builder so users can run a historical simulation of the AI-generated strategy before deploying it. The backtest will fetch real OHLCV data from Alpaca (using the user's linked brokerage account), apply the strategy's indicator logic server-side, simulate trades, and return performance metrics (total return, Sharpe ratio, win rate, max drawdown, equity curve).

### Changes

**1. New edge function: `supabase/functions/run-backtest/index.ts`**

A self-contained backtesting engine that:
- Accepts a strategy config (indicators, thresholds, risk params, custom code) + date range + initial capital
- Fetches historical bars from Alpaca Data API (`get-bars` for stocks, `get-crypto-bars` for crypto) using the user's linked brokerage credentials
- Computes built-in indicator signals (RSI, SMA, EMA, Bollinger, SMA Deviation) from the OHLCV data
- Evaluates custom indicator code in a sandboxed `new Function()` call
- Produces a composite score per bar, applies theta threshold to generate BUY/SELL signals
- Simulates trades with position sizing, stop-loss, and take-profit
- Calculates metrics: total return, Sharpe ratio, Sortino ratio, max drawdown, win rate, profit factor, CAGR, equity curve
- Optionally saves results to the `backtests` + `trades` tables (linked to a model if one exists)
- Returns everything to the frontend for inline display

**2. Frontend: `src/pages/AIBotBuilder.tsx`**

- Add a "Backtest" button next to "Deploy Bot" in the action buttons area
- Add a "Backtest" tab alongside "Generated Config" and "Upload Model"
- Backtest tab contains:
  - Date range picker (start/end)
  - Initial capital input
  - "Run Backtest" button
  - Results display: key metrics cards (Total Return, Sharpe, Win Rate, Max Drawdown) + equity curve chart (using Recharts) + trade log table
- While running, show a progress indicator
- Results persist in the tab until a new strategy is generated

**3. Update `supabase/config.toml`**

- Add `[functions.run-backtest]` with `verify_jwt = false` (auth validated in code)

### Architecture flow

```text
AIBotBuilder (frontend)
  │
  ├─ User generates strategy via AI chat
  ├─ User clicks "Backtest"
  │     │
  │     ▼
  │   run-backtest edge function
  │     ├─ Fetches user's Alpaca credentials from user_brokerage_accounts
  │     ├─ Calls Alpaca Data API for historical bars
  │     ├─ Computes indicator signals (RSI, EMA, etc.)
  │     ├─ Evaluates custom indicator code
  │     ├─ Simulates trades (entries, exits, stop-loss, take-profit)
  │     ├─ Calculates performance metrics
  │     └─ Returns { metrics, equity_curve, trades }
  │
  └─ Displays results inline in Backtest tab
```

### Technical details

**Indicator computation (server-side):** The edge function will implement the same RSI/SMA/EMA/Bollinger/SMA Deviation calculations that `run-automations` uses, but applied to historical daily bars rather than live minute bars. Custom indicators receive the full bars array and return +1/-1/0 signals.

**Composite scoring:** Each enabled indicator produces a signal (-1, 0, +1). Signals are averaged (weighted for custom indicators). If the composite score exceeds `theta`, a BUY is triggered; below `-theta`, a SELL. This mirrors the live automation logic.

**Trade simulation:** Tracks a single position per asset. Applies `position_size_percent` to determine quantity. Monitors stop-loss and take-profit on each subsequent bar. Tracks entry/exit prices and PnL per trade.

**Data source:** Uses Alpaca's historical bars API — the same endpoint already working in the `alpaca-trading` function. No new API key needed. For users without a brokerage account linked, the function will return an error prompting them to connect one.

