
## Problem: Model Metrics Are Always NULL

### What the Data Shows

All public models have `total_return = null`, `sharpe_ratio = null`, `max_drawdown = null`, `win_rate = null`. No backtests exist. No signals exist. This is confirmed by querying the database directly.

### Why Metrics Are Never Populated

There are two separate gaps:

**Gap 1 — Backtest results never sync to the `models` row**

When a backtest completes (either via `run-automations` or `ml-backend`), the results are stored in the `backtests` table (columns: `total_return`, `sharpe_ratio`, `max_drawdown`, `win_rate`, `total_trades`). But nothing ever reads those results and writes them back into the `models` table. The `models.total_return` etc. columns are set once at creation and never updated.

**Gap 2 — Live signal performance is never aggregated**

When the automation runs and executes BUY/SELL signals via Alpaca, trades are logged in `subscriber_trades`. But nothing computes win rate, total return, or drawdown from those live trades and writes them back to `models.*`. The `run-automations` function only updates `deployed_models.total_signals` and `deployed_models.total_trades` — it never touches `models.*`.

### The Fix: Two Parts

**Part 1 — Sync best backtest metrics to the model when a backtest completes**

In `ModelDetail.tsx`, when `useBacktests()` returns data, if the latest completed backtest has results but the `model.*` metrics are still null, we trigger a model update to sync the values. This is the safest approach — it happens client-side when a model owner or viewer loads the detail page. We also add a dedicated "Sync from backtest" action.

More robustly: add a Postgres database trigger (via migration) on the `backtests` table — when `status` changes to `'completed'` and `total_return IS NOT NULL`, automatically update the parent `models` row with the best backtest's metrics.

**Part 2 — Compute live performance metrics from model_signals + subscriber_trades in `run-automations`**

After the signal generation loop, update the `models` row with aggregated stats from `model_signals`:
- `total_return`: computed from executed subscriber_trades pnl relative to total allocation
- `win_rate`: ratio of profitable closed trades to total closed trades  
- `sharpe_ratio`: computed from per-trade returns
- `max_drawdown`: max peak-to-trough in cumulative pnl

### Implementation Plan

#### Step 1 — Database Trigger: Backtest → Model Sync (Migration)

Create a Postgres trigger that fires `AFTER UPDATE` on `backtests` when `status = 'completed'`. It writes the best completed backtest's metrics into the parent `models` row:

```sql
CREATE OR REPLACE FUNCTION public.sync_model_metrics_from_backtest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.total_return IS NOT NULL THEN
    UPDATE public.models
    SET
      total_return   = NEW.total_return,
      sharpe_ratio   = NEW.sharpe_ratio,
      max_drawdown   = NEW.max_drawdown,
      win_rate       = NEW.win_rate,
      updated_at     = NOW()
    WHERE id = NEW.model_id
      -- Only update if this backtest is better (higher return) or metrics are null
      AND (total_return IS NULL OR NEW.total_return > total_return);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_backtest_completed
  AFTER UPDATE ON public.backtests
  FOR EACH ROW EXECUTE FUNCTION public.sync_model_metrics_from_backtest();
```

This means: the moment a backtest finishes and its `status` is set to `'completed'`, the model's displayed metrics update automatically.

#### Step 2 — Live Metrics Aggregation in `run-automations`

After executing trades for a model, compute and write live metrics back to the `models` table. The `run-automations` edge function will:

1. Query `model_signals` for this model filtered to `status = 'executed'`
2. Compute:
   - **Total signals**: count
   - **Buy/Sell ratio**: for display
   - **Win rate**: from `subscriber_trades` where `pnl > 0` / total closed trades
   - **Total return** (approximate): sum of `subscriber_trades.pnl` / sum of `allocations.allocated_amount`
3. Write back to `models` via `supabaseAdmin.from('models').update({...}).eq('id', model.id)`

This keeps metrics fresh on every automation cycle (every 1 minute when deployed).

#### Step 3 — ModelDetail UI: Show Real Signal Stats

Currently `ModelDetail.tsx` counts signals from only the last 10 (`recentSignals`). Fix it to:
- Use `signals` (all 50 fetched) for buy/sell counts
- Show `signals.length` as "Total Signals" stat card (sourced from `useModelSignals`)
- Show executed vs pending breakdown
- Display "No backtest run yet" clearly when equity curve is empty, with a prompt for owners to run one

#### Step 4 — ModelDetail UI: Explicit "Metrics from backtest" Label

When metrics exist and a completed backtest exists, label the Performance section with:
`"Based on backtest: [start_date] → [end_date]"`

When metrics are null (new model, no backtest yet), show placeholder `—` values (already done) plus a clear note: *"Run a backtest to see performance metrics"* for owners, or *"Performance data not yet available"* for visitors.

### Files Changed

1. **Database migration** — new trigger `on_backtest_completed` that auto-syncs backtest results to `models` columns
2. **`supabase/functions/run-automations/index.ts`** — after trade execution loop, compute and write live win_rate and signal count back to `models`
3. **`src/pages/ModelDetail.tsx`** — fix signal count display to use all signals (not just last 10), add context labels for where metrics come from, add "no metrics yet" callout

### What Will NOT Change

- The `models.*` schema (columns already exist)
- The `backtests` table (no schema change needed)
- The `ModelMarketplaceCard` component (it already reads from `models.*` correctly — once those are populated, cards will show real data automatically)
- The `Explore` page (same, reads from `models.*`)
- All RLS policies (the trigger runs as `SECURITY DEFINER` and writes via service role in the edge function)
