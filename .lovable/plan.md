
## How the Trading Pipeline Currently Works (and What's Broken)

### The Full Flow (When Working Correctly)

```text
1. User posts automation to marketplace
   → model created in DB (configuration JSONB has indicators + source_symbol)

2. Owner "deploys" the model
   → deployed_models row created with status = 'running'

3. run-automations edge function runs (triggered every 1 min via cron OR manually)
   → Fetches all deployed_models WHERE status = 'running'
   → For each: reads models.ticker + models.indicators_config
   → Fetches live Alpaca bars for that ticker
   → Runs indicator calculations → generates BUY/SELL/HOLD
   → Inserts row into model_signals
   → If BUY/SELL: executes trade on owner's Alpaca + all subscribers' Alpaca

4. Signals appear in ModelDetail page
5. Metrics (win_rate, total_return) update after each trade cycle
```

### Three Root Causes of "0 Signals"

**Problem 1 — `models.ticker` is NULL for all marketplace models (most critical)**

When a user posts from `PostToMarketplaceDialog`, the `source_symbol` (e.g. `AAPL`) is stored inside `configuration.source_symbol` as JSON — but the `models.ticker` column is never set. 

In `run-automations` line 536: `if (!model || !model.ticker) { ... continue; }` — every single model is skipped because `ticker` is always `null`.

**Fix:** Set `ticker: symbol` in the `useCreateModel` call inside `PostToMarketplaceDialog`.

**Problem 2 — `models.indicators_config` is NULL (secondary blocker)**

The indicators are stored inside `configuration.indicators` (JSONB), but `run-automations` reads `model.indicators_config` (a separate column). Since `indicators_config` is never set during marketplace posting, all signals default to HOLD even if `ticker` were fixed.

**Fix:** Also set `indicators_config` to the indicators object when creating the model.

**Problem 3 — No deploy step exists in the UI for marketplace models**

After posting to the marketplace, the model is never "deployed" — there's no entry in `deployed_models` with `status = 'running'`. The `run-automations` function only processes deployed models. The current ModelDetail page has Pause/Resume controls but no Deploy button. The owner must explicitly deploy before trading starts.

**Fix:** Add a "Deploy" button to the ModelDetail page (for owners), using the existing `useDeployModel()` hook. Show the current deployment status clearly.

**Problem 4 — `run-automations` has no scheduler (manual trigger only)**

The function exists and is correctly written, but there is no cron job calling it. It only runs if manually invoked. This means even with all the above fixed, trading won't happen automatically without a scheduler.

**Fix:** Add a note in the UI that trading runs on a 1-minute cycle, and add a "Run Now" button for owners to manually trigger a signal cycle during testing. We can also expose a simple way to call `run-automations` from the deployed model panel.

---

## Implementation Plan

### Files to Change

**1. `src/components/automation/PostToMarketplaceDialog.tsx`**

In `createModel.mutateAsync(...)`, add two fields to the top-level object (not inside `configuration`):
- `ticker: symbol` — fills the `models.ticker` column so `run-automations` can find the stock
- `indicators_config` — copy of the indicators object so `run-automations` can read signal logic

```typescript
await createModel.mutateAsync({
  name: name.trim(),
  ticker: symbol,                    // ← ADD THIS
  indicators_config: {               // ← ADD THIS
    ...indicatorsSource,
    custom: customArr,
  },
  // ... rest unchanged
});
```

**2. `src/hooks/useModels.tsx`**

Update `useCreateModel` mutation to pass `ticker` and `indicators_config` through to the Supabase insert. Currently these fields are not in the insert payload.

```typescript
const { data, error } = await supabase.from('models').insert({
  name: model.name,
  ticker: model.ticker,              // ← ADD
  indicators_config: model.indicators_config, // ← ADD
  // ... rest unchanged
});
```

Also update the `mutationFn` type signature to accept `ticker?: string` and `indicators_config?: Json`.

**3. `src/pages/ModelDetail.tsx`**

Add a "Deploy / Stop" section for model owners, using the existing `useDeployModel`, `useStopModel`, and `useDeployedModel` hooks from `useDeployedModels.tsx`. The deploy section shows:
- Current deployment status badge (Running / Stopped / Not deployed)
- A "Deploy" button → calls `useDeployModel()` to create a `deployed_models` row with `status = 'running'`
- A "Stop" button → calls `useStopModel()` to set status to `'stopped'`
- Last signal timestamp when running
- A "Generate Signal Now" test button that calls `run-automations` manually

This gives owners complete visibility and control over whether their model is actively trading.

### Technical Details

- `run-automations` is already fully implemented and correct — the only blockers are the missing `ticker` and `indicators_config` columns and the missing `deployed_models` row
- The `useDeployModel` and `useStopModel` hooks already exist in `src/hooks/useDeployedModels.tsx` — we just need to wire them into the ModelDetail UI
- No DB schema changes needed — both `ticker` and `indicators_config` columns exist on the `models` table
- The `run-automations` cron gap is a separate concern — we'll add a visible "manual trigger" button for owners

### Summary of Changes

| File | Change |
|---|---|
| `src/components/automation/PostToMarketplaceDialog.tsx` | Pass `ticker` and `indicators_config` when creating model |
| `src/hooks/useModels.tsx` | Accept and insert `ticker` + `indicators_config` |
| `src/pages/ModelDetail.tsx` | Add Deploy/Stop controls + deployment status for owners |
