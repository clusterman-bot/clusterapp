
## The Real Problem: Two Separate Pipelines That Don't Talk to Each Other

After a full audit of the backend, here is the honest diagnosis:

### What Actually Exists

**Pipeline 1 — Stock Automations (WORKING)**

- A `pg_cron` job runs every minute, calls `run-automations`, which calls `stock-monitor` for each active automation.
- `stock-monitor` fetches real Alpaca bars, runs RSI/SMA/EMA/Bollinger indicators, generates a BUY/SELL/HOLD decision, places the Alpaca order for the **automation owner**, and logs it to `automation_signals`.
- This pipeline is fully functional for the automation owner only. It does not involve subscribers or `model_signals`.

**Pipeline 2 — Model Marketplace + Trade Mirroring (BROKEN — the missing link)**

- `trading-bot/deploy` marks a model as `status: running` in `deployed_models`. ✓
- `trading-bot/generate-signal` generates signals and calls `executeTradeForOwnerAndSubscribers`, which mirrors trades to all active subscribers. ✓
- **The problem: nothing ever calls `generate-signal` automatically.** The cron job only calls `run-automations → stock-monitor`, which handles `stock_automations` (the per-stock automations). It never touches `deployed_models`. There is no scheduler that loops over running models and calls `generate-signal`.

### The Missing Link Visualized

```text
CURRENT STATE:
pg_cron (every 1 min)
  └─► run-automations
        └─► stock-monitor (per automation)
              └─► places Alpaca order for owner ONLY
              └─► writes to automation_signals
              └─► NEVER writes to model_signals
              └─► NEVER notifies subscribers

model.deploy() → deployed_models (status=running)
trading-bot/generate-signal → [NEVER CALLED AUTOMATICALLY]

WHAT NEEDS TO HAPPEN:
pg_cron (every 1 min)
  └─► run-automations
        ├─► stock-monitor (existing — per-stock automations)
        └─► [NEW] model-signal-runner (per deployed running model)
              └─► fetches market data from Alpaca
              └─► generates BUY/SELL/HOLD signal
              └─► writes to model_signals
              └─► calls executeTradeForOwnerAndSubscribers
                    ├─► places Alpaca order for model OWNER
                    └─► for each active subscriber:
                          ├─► checks allocation budget + buying power
                          ├─► places proportional Alpaca order
                          ├─► writes to subscriber_trades
                          └─► sends one-time email if blocked
```

### The Fix: Wire Deployed Models into the Cron Loop

**Two things need to change:**

**1. Extend `run-automations` to also process deployed models**

The existing `run-automations` function loops over `stock_automations`. It needs a second loop that:
- Fetches all `deployed_models` where `status = 'running'`
- Joins to `models` to get `ticker`, `horizon`, `theta`, `max_quantity`, `position_size_percent`, `indicators_config`
- For each running model, fetches the last 100 bars from Alpaca (using the model owner's Alpaca credentials)
- Runs indicator logic to generate a signal
- Calls `trading-bot/generate-signal` with the result (which handles the full mirroring to subscribers)

**2. Update `trading-bot/generate-signal` to handle the model owner's Alpaca execution too**

Currently the `executeTradeForOwnerAndSubscribers` function places trades for both owner and subscribers, but the owner's Alpaca key comes from `user_brokerage_accounts` — this is correct and complete. No change needed here.

### Files to Change

| File | What Changes |
|---|---|
| `supabase/functions/run-automations/index.ts` | Add a second loop after the stock-automation loop that fetches all running deployed models, fetches market data from Alpaca for each, generates the signal internally (same indicator logic as stock-monitor), and calls `trading-bot/generate-signal` |

That is the only file that needs to change. The `trading-bot` mirroring logic is already correct and complete — it just never gets triggered automatically.

### How Signals Are Generated for Models

Models created via the AI Chat Builder have `indicators_config` in JSONB (same RSI/SMA/EMA structure) stored on the `models` table. The `run-automations` extension will:

1. Read `models.indicators_config`, `models.horizon`, `models.theta`, `models.ticker`
2. Fetch 100 bars from Alpaca (using the model owner's brokerage credentials, same as stock-monitor)
3. Run the same indicator voting logic that stock-monitor uses
4. If composite score exceeds theta → BUY; below -theta → SELL; else → HOLD
5. Call `trading-bot/generate-signal` with the result, which writes to `model_signals` and fans out to all subscribers

### What This Achieves

Once this is in place:
- Every minute the cron fires
- Every **deployed running model** is evaluated against live market data
- BUY/SELL signals automatically place Alpaca orders for the model owner
- The same signals are immediately mirrored to every active subscriber proportional to their allocation
- Insufficient-funds scenarios are caught and the subscriber is emailed once
- Everything is logged to `model_signals` and `subscriber_trades`

No additional cron jobs, no new database tables, no new edge functions needed — just one targeted extension to `run-automations`.
