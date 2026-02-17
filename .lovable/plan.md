

# Automated Technical Indicator Trading Bot

## Overview
Build a per-stock automated trading system where retail users configure technical indicators (RSI, SMA, EMA, Bollinger Bands, SMA Deviation) per holding. The system monitors real Alpaca market data, computes indicators in real-time, generates BUY/SELL signals based on configurable thresholds, and executes trades automatically via the user's connected Alpaca account.

## What This Delivers
- Per-stock indicator configuration (RSI 7/14/21, SMA 5/20/50, EMA 5/20, Bollinger Bands, SMA Deviation)
- Adjustable horizon (e.g. 5 minutes) and theta (0.01-0.05) per stock
- Real indicator calculations from live Alpaca bar data -- no random numbers
- Automated trade execution through the existing Alpaca brokerage integration
- A monitoring dashboard showing active automations, signals, and trade history

---

## Technical Details

### 1. New Database Table: `stock_automations`

Stores per-user, per-stock indicator configurations and trading parameters.

```sql
CREATE TABLE public.stock_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  is_active boolean DEFAULT true,
  -- Indicator configs (JSONB for flexibility)
  indicators jsonb NOT NULL DEFAULT '{
    "rsi": {"enabled": false, "periods": [14]},
    "sma": {"enabled": false, "windows": [5, 20]},
    "ema": {"enabled": false, "windows": [5, 20]},
    "bollinger": {"enabled": false, "window": 20, "std": 2},
    "sma_deviation": {"enabled": false, "window": 20}
  }',
  -- Signal thresholds
  rsi_oversold numeric DEFAULT 30,
  rsi_overbought numeric DEFAULT 70,
  -- Trading parameters
  horizon_minutes integer DEFAULT 5,
  theta numeric DEFAULT 0.01,
  position_size_percent numeric DEFAULT 10,
  max_quantity integer DEFAULT 10,
  stop_loss_percent numeric DEFAULT 5,
  take_profit_percent numeric DEFAULT 15,
  -- State tracking
  last_checked_at timestamptz,
  last_signal_at timestamptz,
  total_signals integer DEFAULT 0,
  total_trades integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.stock_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automations"
  ON public.stock_automations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. New Database Table: `automation_signals`

Logs every signal the system generates so users can audit decisions.

```sql
CREATE TABLE public.automation_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.stock_automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  signal_type text NOT NULL, -- 'BUY', 'SELL', 'HOLD'
  confidence numeric,
  price_at_signal numeric,
  indicator_snapshot jsonb, -- exact indicator values at signal time
  trade_executed boolean DEFAULT false,
  alpaca_order_id text,
  executed_price numeric,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.automation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own signals"
  ON public.automation_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts signals"
  ON public.automation_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 3. New Edge Function: `stock-monitor`

A backend function that:
1. Fetches recent bars from Alpaca Data API for a given symbol
2. Computes all enabled indicators from real OHLC data (no random numbers)
3. Generates a composite signal based on indicator confluence
4. Executes trades via Alpaca if signal confidence exceeds theta
5. Logs everything to `automation_signals`

**Indicator calculations (all from real bar data):**
- **RSI**: Standard relative strength index using close prices
- **SMA**: Simple moving average over configured windows
- **EMA**: Exponential moving average over configured windows  
- **Bollinger Bands**: SMA +/- N standard deviations
- **SMA Deviation**: Percentage distance of current price from SMA

**Signal logic:**
- Each indicator votes BUY (+1), SELL (-1), or NEUTRAL (0)
- Composite score = weighted average of all votes
- If score > theta -> BUY; if score < -theta -> SELL; else HOLD
- Confidence = absolute value of composite score

**Trade execution:**
- Uses existing `alpaca-trading` credential decryption pattern
- Places market orders via Alpaca paper/live API
- Polls for fill status (reuses existing polling pattern)
- Records executed price and order ID in `automation_signals`

### 4. New Edge Function: `run-automations`

A coordinator function designed to be called via cron (every N minutes):
1. Queries all active `stock_automations`
2. For each, calls the `stock-monitor` logic
3. Rate-limits Alpaca API calls appropriately

Will be scheduled via `pg_cron` + `pg_net` to run every 5 minutes.

### 5. Frontend: Stock Automation Configuration Page

**New route**: `/trade/stocks/:symbol/automate`

**New component**: `src/components/trade/StockAutomationConfig.tsx`

UI sections:
- **Indicator Selection Panel**: Toggle RSI/SMA/EMA/Bollinger/SMA Deviation on/off with configurable parameters (periods, windows, std deviations)
- **Signal Thresholds**: RSI oversold/overbought levels, theta slider (0.01-0.05)
- **Trading Parameters**: Horizon (minutes), position size %, max quantity, stop loss %, take profit %
- **Status Panel**: Active/paused toggle, last checked time, signal count, trade count
- **Signal History**: Table of recent signals with indicator snapshots, showing exactly why each trade was made

### 6. Frontend: Hook `useStockAutomations`

**New file**: `src/hooks/useStockAutomations.tsx`

- `useStockAutomation(symbol)` - fetch config for a specific stock
- `useMyAutomations()` - list all active automations
- `useUpsertAutomation()` - create/update automation config
- `useToggleAutomation()` - activate/deactivate
- `useDeleteAutomation()` - remove automation
- `useAutomationSignals(automationId)` - fetch signal history

### 7. Frontend: Automations Dashboard

**New component in Trade page or as a tab**: Shows all active automations across stocks with:
- Symbol, indicator summary, last signal, trade count
- Quick toggle on/off
- Link to configure each automation

### 8. Integration Points

- **StockDetail page**: Add "Automate" button next to the trade panel, linking to the automation config
- **Trade page**: Add an "Automations" tab or section showing all active monitors
- **App.tsx**: Add route for `/trade/stocks/:symbol/automate`

### 9. Cron Job Setup

SQL to schedule the monitor (run via Cloud SQL, not migration):
```sql
SELECT cron.schedule(
  'run-stock-automations',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://pfszkghqoxybhbaouliw.supabase.co/functions/v1/run-automations',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

## Implementation Order

1. Create database tables (`stock_automations`, `automation_signals`) with RLS
2. Build `stock-monitor` edge function with real indicator math and trade execution
3. Build `run-automations` edge function as the cron coordinator
4. Create `useStockAutomations` hook
5. Build `StockAutomationConfig` UI component
6. Add routes, navigation buttons, and automations dashboard
7. Set up cron job for automated monitoring
8. End-to-end testing

