
## Fix: `config` Missing from Deployed Models Query

### Root Cause

In `supabase/functions/run-automations/index.ts`, the query that fetches deployed models at line 523 has an explicit column list that does **not** include `config`:

```typescript
.select(`
  id, model_id, user_id, status, total_signals, total_trades,
  models(id, name, ticker, horizon, theta, position_size_percent, max_exposure_percent, indicators_config)
`)
```

So when `executeModelTrades` reads `deployment.config?.owner_trades_too`, `deployment.config` is always `undefined`. The expression `undefined !== false` is `true`, so the owner is always included in the trade list regardless of what is saved in the database.

The toggle correctly saves `owner_trades_too: false` to the database — that part works. The engine just never reads it back because `config` isn't fetched.

### The Fix — 1 line change

Add `config` to the SELECT column list:

```typescript
// Before:
.select(`
  id, model_id, user_id, status, total_signals, total_trades,
  models(id, name, ticker, horizon, theta, position_size_percent, max_exposure_percent, indicators_config)
`)

// After:
.select(`
  id, model_id, user_id, status, total_signals, total_trades, config,
  models(id, name, ticker, horizon, theta, position_size_percent, max_exposure_percent, indicators_config)
`)
```

That is the only change needed. Everything else — the `executeModelTrades` logic, the UI toggle, the database save — is already correct. Once `config` is fetched, `deployment.config?.owner_trades_too !== false` will correctly evaluate to `false` when the toggle is off, and the owner will be excluded from the trade loop.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/run-automations/index.ts` | Add `config` to the deployed models SELECT column list (line ~527) |

After this fix and redeployment of the edge function, turning the toggle off will immediately stop owner trades on the next automation run.
