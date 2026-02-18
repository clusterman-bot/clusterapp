
## Root Cause Analysis: Why Nothing Is Connected

The database confirms **5 separate broken links** in the pipeline. Here is what the data shows:

### Broken Link 1 — Deployed models have no `ticker` or `indicators_config`

The two running models (`NVDA Automation Strategy`, `SPY Automation Strategy`) were deployed **before** the fix to `PostToMarketplaceDialog` was applied. Their `ticker` column is `NULL` and `indicators_config` is `NULL` in the `models` table. The `run-automations` function explicitly skips any model where `ticker` is null — confirmed by the logs showing `"has no ticker, skipping"`. Zero signals will ever be generated until this is fixed.

The data exists — both models have `configuration->>'source_symbol'` (NVDA, SPY) and indicators inside `configuration->'indicators'`. It just needs to be copied to the top-level columns.

**Fix:** A database migration that backfills `ticker` and `indicators_config` for all models where they are null but `configuration` has the data.

### Broken Link 2 — Subscribers have NO allocations

Every subscription row shows `allocation_id = NULL`. There is no allocation record in the `allocations` table for any subscriber. This means:
- When `run-automations` fetches subscribers via `subscriptions.select('*, allocations(*)')`, `sub.allocations` is always an empty array
- The trade execution code for subscribers does `trader.allocation = sub.allocations?.[0] || null`
- With `allocation = null`, the fund check is bypassed BUT the `allocation_id` written to `subscriber_trades` is also null
- More critically: the `max_exposure_percent` budget calculation falls back to zero, meaning the trade quantity math produces zero or 1 share with no meaningful budget constraint

The subscription flow never creates an `allocations` row. This needs to be created automatically when someone subscribes.

**Fix:** In `useSubscriptions.tsx`, after a successful subscribe, automatically insert an `allocations` row with `allocated_amount` set to the model's `min_allocation` (or a sensible default). Also ensure the UI provides a way for the subscriber to set their allocation amount.

### Broken Link 3 — Signals and trades don't appear in real-time on the Orders page

`model_signals` and `subscriber_trades` **are** in the `supabase_realtime` publication — good. However, `useTradeRealtimeUpdates()` and `useSignalRealtimeUpdates()` exist in `useDeployedModels.tsx` but are **never called** from `Orders.tsx`. The Orders page fetches data once on mount and never subscribes to live updates.

**Fix:** Call `useTradeRealtimeUpdates()` inside `Orders.tsx` so the Bot Trades tab auto-refreshes when new `subscriber_trades` rows arrive.

### Broken Link 4 — `model_signals` has no SELECT policy for subscribers

Looking at the RLS policies on `model_signals`:
- `Model owners can manage signals` — ALL operations for model owners ✓
- `Subscribers can view signals` — SELECT for active subscribers ✓ (this exists, confirmed from schema)

This is actually fine. The issue is just the missing ticker, not RLS.

### Broken Link 5 — Owner's own trades are NOT logged to `subscriber_trades`

In `run-automations`, the code only inserts into `subscriber_trades` for non-owners (`if (!trader.isOwner && trader.subscriptionId)`). The model owner's executed trades go to Alpaca's order history (fetchable via the `alpaca-trading` edge function) but are **never written to `subscriber_trades`**. This is intentional for the owner, but it means:

- Owner sees trades under "All Orders" tab (from Alpaca API) ✓
- Subscriber sees trades under "Bot Trades" tab (from `subscriber_trades`) — **only if allocation exists**
- There is no unified view

The current design is acceptable (owner = Alpaca orders, subscriber = Bot Trades tab), but the subscriber tab will remain empty until broken links 1, 2, and 3 are fixed.

---

## The Fix Plan

### Step 1 — Database migration: Backfill `ticker` and `indicators_config` for existing models

```sql
UPDATE public.models
SET 
  ticker = configuration->>'source_symbol',
  indicators_config = configuration->'indicators'
WHERE 
  ticker IS NULL 
  AND configuration->>'source_symbol' IS NOT NULL
  AND indicators_config IS NULL;
```

This immediately unblocks the deployed models. On the next `run-automations` call, they will generate signals.

### Step 2 — Auto-create allocation when subscribing

In `src/hooks/useSubscriptions.tsx`, after the subscription insert/upsert succeeds, insert an `allocations` row:

```typescript
// After successful subscribe:
await supabase.from('allocations').upsert({
  user_id: user.id,
  subscription_id: data.id,  // the new subscription id
  model_id: modelId,
  allocated_amount: modelMinAllocation,   // fetched from model
  current_value: modelMinAllocation,
  is_active: true,
}, { onConflict: 'subscription_id' });
```

We also need to fetch the model's `min_allocation` as part of the subscription flow. This needs to be passed in or fetched.

### Step 3 — Subscribe Orders page to real-time trade updates

In `src/pages/Orders.tsx`, import and call `useTradeRealtimeUpdates()`:

```typescript
import { useTradeRealtimeUpdates } from '@/hooks/useDeployedModels';

// Inside the component:
useTradeRealtimeUpdates(); // subscribes to subscriber_trades changes via Realtime
```

This ensures when `run-automations` inserts a new `subscriber_trades` row, the Bot Trades tab auto-refreshes without requiring a page reload.

### Step 4 — Also wire real-time updates on ModelDetail signals list

The `ModelDetail.tsx` already calls `useModelSignals()` but doesn't call `useSignalRealtimeUpdates()`. Add it so signals appear live on the model page:

```typescript
import { useSignalRealtimeUpdates } from '@/hooks/useDeployedModels';

// Inside ModelDetail:
useSignalRealtimeUpdates(id);
```

### Step 5 — Show subscriber allocation in the subscribe flow

Currently `ModelSubscribeButton.tsx` / subscription hooks don't ask for an allocation amount. The subscriber's allocation defaults to `min_allocation`. We should display the model's `min_allocation` and `max_allocation` in the subscribe dialog so the user understands how much of their capital will be committed.

---

## Files Changed

| File | Change |
|---|---|
| Database migration | Backfill `ticker` + `indicators_config` for existing null-ticker models |
| `src/hooks/useSubscriptions.tsx` | Auto-create `allocations` row on subscribe; handle reactivation allocation update |
| `src/pages/Orders.tsx` | Add `useTradeRealtimeUpdates()` hook call |
| `src/pages/ModelDetail.tsx` | Add `useSignalRealtimeUpdates(id)` hook call |
| `src/components/ModelSubscribeButton.tsx` | Show allocation amount in subscribe UI |

## What This Will Fix End-to-End

After these changes:
1. Model owner runs "Run Now" → `run-automations` fetches ticker (now populated) → generates signal → inserts `model_signals` row → model page shows signal in real-time (Step 4)
2. Signal is BUY/SELL → `run-automations` fetches subscribers → finds allocation (now created, Step 2) → executes on subscriber's Alpaca → inserts `subscriber_trades` row
3. Subscriber opens Orders → Bot Trades tab auto-refreshes via Realtime (Step 3) → sees the mirrored trade
4. Subscriber's portfolio reflects the trade value via the `allocations` table
