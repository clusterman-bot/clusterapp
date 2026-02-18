
## "Owner Trades Too" Toggle — Implementation Plan

### What this changes

The `deployed_models` table has a `config` JSONB column that currently stores arbitrary deployment settings. We will store `owner_trades_too: boolean` in that column. When `false`, the `run-automations` engine will skip placing the real Alpaca order on the owner's account — but it still uses the owner's Alpaca credentials to fetch market data and calculate signals, then mirrors the trade only to subscribers.

---

### How the data flows today (what we're changing)

In `executeModelTrades()` in `run-automations/index.ts`, the `usersToTrade` array is always built like this:

```
[
  { userId: deployment.user_id, isOwner: true, ... },   // ← ALWAYS included
  ...subscribers
]
```

We need to conditionally exclude the owner from the execution loop (not from data fetching — that happens earlier and is separate).

---

### Technical changes — 4 files

**1. `supabase/functions/run-automations/index.ts`**

- In `executeModelTrades()`, accept the deployment's `config` object as a parameter.
- Read `config?.owner_trades_too` — default `true` if absent (backward compatible).
- When building `usersToTrade`, only include the owner entry if `owner_trades_too !== false`.
- At the call site (`line 658`), pass `deployment.config` through.

```typescript
// Modified usersToTrade construction:
const ownerTradesToo = deployment.config?.owner_trades_too !== false; // default true

const usersToTrade = [
  ...(ownerTradesToo
    ? [{ userId: deployment.user_id, subscriptionId: null, isOwner: true, allocation: null, fundWarningAlreadySent: false }]
    : []),
  ...(subscriptions || []).map((sub: any) => ({ ... })),
];
```

**2. `src/hooks/useDeployedModels.tsx`**

- Add a new `useUpdateDeploymentConfig` mutation that does a `supabase.from('deployed_models').update({ config: {...} }).eq('id', deploymentId)`.
- This is a simple targeted update hook for the deployment config.

**3. `src/pages/ModelDetail.tsx`**

- Import `useUpdateDeploymentConfig` from `useDeployedModels`.
- In the owner controls section (around line 274–367), add a toggle row below the existing Deploy/Stop buttons when `deployedModel` exists (whether running or stopped):

```
[Switch] Owner also trades
When off, the bot runs and mirrors trades to subscribers but skips placing 
orders on your own account.
```

- The switch reads `deployedModel?.config?.owner_trades_too !== false` (defaults to `true`).
- On change, calls `updateDeploymentConfig.mutateAsync({ id: deployedModel.id, config: { ...deployedModel.config, owner_trades_too: newValue } })`.
- Show the toggle only when `isOwner && deployedModel` (i.e. a deployment record exists).

**4. No database migration needed** — `config` is already a `JSONB` column on `deployed_models`, so it can hold arbitrary keys. No schema changes required.

---

### Backward compatibility

- Any existing deployment where `config` is `null` or doesn't have `owner_trades_too` will behave exactly as before (owner trades too). The default is `true`.
- The toggle simply flips the key inside the existing `config` object.

---

### Files changed

| File | Change |
|---|---|
| `supabase/functions/run-automations/index.ts` | Read `config.owner_trades_too` in `executeModelTrades`, conditionally exclude owner from trade execution |
| `src/hooks/useDeployedModels.tsx` | Add `useUpdateDeploymentConfig` mutation hook |
| `src/pages/ModelDetail.tsx` | Add Switch toggle in owner controls section; wire to the new mutation |

### What the owner sees after this change

In the Model Detail page, under the Deploy/Stop buttons, a new row appears:

```
[Switch ON/OFF]  "Also trade on my account"
                 "When off, subscribers mirror the model but no orders are 
                  placed on your own Alpaca account."
```

The switch is always visible once a deployment exists (running or stopped), so the owner can set their preference before or after deploying.
