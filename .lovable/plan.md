

# Plan: Remove Simulated Fallbacks, Add F1/Precision to Results, Fix Model Visibility

## Three Changes

### 1. Remove simulated data fallback — retry Alpaca instead

**`supabase/functions/ml-backend/index.ts`** (~lines 414-443):
- Remove `generateSimulatedBars` function entirely
- In `fetchMarketData()`: if no Alpaca credentials, throw an error instead of falling back to simulation
- If Alpaca returns no bars or fails, retry up to 3 times with a 2-second delay between attempts
- After 3 failures, throw a clear error ("Failed to fetch live market data from Alpaca after 3 attempts") instead of falling back to simulated data
- Remove `simulateTrainingDemo` function (lines 657-669) — no more demo mode path

**`supabase/functions/quick-build/index.ts`** (~lines 25-86):
- Same treatment: replace `fetchMarketData` to use Alpaca (currently uses Polygon with simulated fallback)
- Use `ALPACA_API_KEY` / `ALPACA_API_SECRET` from env (already available)
- Retry up to 3 times on failure, then throw error — no simulated data
- Remove `generateSimulatedData` function
- Remove `simulateTrainingAndValidation` function (lines 536-662) — instead, always invoke the real `ml-backend` training pipeline via internal edge function call
- Update the quick-build flow (lines 482-515) to always call `ml-backend` for real training instead of falling back to simulation

### 2. Include F1 score and precision in all training/backtest results

**`supabase/functions/ml-backend/index.ts`**:
- Results already include `accuracy`, `f1`, `recall` — add `precision` to the results object stored in `training_runs` (it's already computed in `computeMetrics`, just not saved in the results dict at line 541)

**`src/components/stock/QuickBuildPanel.tsx`** (ModelComparisonTable):
- Add a "Precision" column to the table alongside Accuracy, F1, Recall

**`src/components/backtest/BacktestResults.tsx`**:
- Backtest metrics already show Sharpe, Sortino, Profit Factor, CAGR, Win Rate, Max Drawdown, Total Return — these are trading metrics, not ML metrics. No F1/precision needed here since backtesting tests trade performance, not classification.

**`src/components/ml/TrainingProgress.tsx`** (if it displays training results):
- Ensure F1 and precision are shown when training results are displayed

### 3. PostToMarketplace: default `is_public` to false (owner-only)

**`src/components/automation/PostToMarketplaceDialog.tsx`**:
- Change the default `isPublic` state to `false` so when a user posts/publishes a model, it defaults to private (visible only to the owner)
- The toggle to make it public still exists, but the default is now "private"

## Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/ml-backend/index.ts` | Remove simulated fallback, add retry logic, add precision to results |
| `supabase/functions/quick-build/index.ts` | Switch to Alpaca, remove all simulation functions, always use real ml-backend |
| `src/components/stock/QuickBuildPanel.tsx` | Add Precision column to ModelComparisonTable |
| `src/components/automation/PostToMarketplaceDialog.tsx` | Default `isPublic` to `false` |

No database changes needed.

