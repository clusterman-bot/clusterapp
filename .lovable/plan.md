

## Plan: System Bots — Platform-Managed Auto-Trading Strategies

Three platform-managed bots that auto-generate strategies, continuously self-improve via backtesting, swap tickers weekly, and are published as community models under the @Seif account. Alpha users get full management controls.

### Architecture

```text
  ┌──────────────────────────────────────────────────────────┐
  │  system-bots edge function (new)                         │
  │  Called on schedule (daily) + on-demand by Alpha         │
  │                                                          │
  │  1. Bootstrap: Create 3 models owned by @Seif            │
  │     - "System Bot: Tech Growth" (tech stock)             │
  │     - "System Bot: Tech Momentum" (tech stock)           │
  │     - "System Bot: Precious Metals" (GLD/SLV/etc.)       │
  │                                                          │
  │  2. Weekly Ticker Rotation:                              │
  │     AI picks best stock for each sector using            │
  │     platform knowledge + recent performance              │
  │                                                          │
  │  3. Strategy Optimization:                               │
  │     Runs backtests → picks best indicator setup           │
  │     Uses same self-improve pipeline (bot-optimizer)       │
  │                                                          │
  │  4. All data fetched via @Seif's Alpaca credentials      │
  │                                                          │
  │  5. Models published as is_public=true, is_system=true   │
  │     so they appear in the marketplace with a badge       │
  └──────────────────────────────────────────────────────────┘
```

### Database Changes

**Add `is_system` column to `models` table:**
- `is_system boolean NOT NULL DEFAULT false`
- Identifies system-managed bots vs. user-created ones

**Add `system_bot_config` table:**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| model_id | uuid | FK → models.id |
| sector | text | "tech" or "precious_metals" |
| ticker_pool | text[] | Candidate tickers for weekly rotation (e.g., AAPL, MSFT, NVDA, GOOGL, META for tech) |
| current_ticker | text | Currently active ticker |
| last_rotation_at | timestamptz | When ticker was last swapped |
| last_optimization_at | timestamptz | When strategy was last optimized |
| optimization_generation | int | Counter |
| rotation_interval_days | int | Default 7 |
| is_active | boolean | Master on/off |
| created_at | timestamptz | |

RLS: Alpha users can SELECT and UPDATE. Service role can do everything.

### Edge Function: `supabase/functions/system-bots/index.ts`

Actions:
- **`bootstrap`**: Creates the 3 system bot models under @Seif's user_id if they don't exist. Sets `is_system=true`, `is_public=true`, `model_type='system'`. Creates `system_bot_config` entries with appropriate ticker pools. Deploys them via `deployed_models`.
- **`rotate-tickers`**: For each system bot, checks if `rotation_interval_days` have passed. If so, uses AI (Lovable AI gateway) to pick the best ticker from the pool based on recent market conditions and platform knowledge. Updates `models.ticker` and `system_bot_config.current_ticker`.
- **`optimize`**: For each system bot, runs the same optimization pipeline as user bots: backtest current config → parameter sweep → AI rewrite if needed. Updates indicators_config and risk params. All data pulled via @Seif's Alpaca credentials.
- **`status`**: Returns current state of all 3 system bots (for Alpha dashboard display).
- **`update-config`**: Alpha can rename bots, change ticker pools, toggle active state, adjust rotation interval.

### Scheduler

Add a cron job that calls `system-bots` daily:
1. Check if any bot needs ticker rotation (weekly check)
2. Run optimization on all 3 bots (continuous improvement)
3. The existing `run-automations` cron already handles signal generation + trade mirroring for deployed models — system bots just ride that pipeline since they're regular deployed models.

### Frontend Changes

**`src/components/community/ModelMarketplaceCard.tsx`** — Show a "System Bot" badge (e.g., a robot icon + "System") when `model.is_system === true`. Style it distinctively so users can identify platform-managed bots.

**`src/pages/ModelDetail.tsx`** — Display "System Bot" label, show that it auto-rotates tickers weekly and self-improves. Hide "Edit" buttons for non-Alpha users.

**`src/pages/AlphaDashboard.tsx`** — Add a "System Bots" tab with:
- Status cards for each bot (current ticker, last rotation, last optimization, subscriber count, performance metrics)
- Rename capability
- Toggle active/inactive
- Edit ticker pool
- Manual "Rotate Now" and "Optimize Now" buttons
- View full signal/trade history

**`src/hooks/useSystemBots.tsx`** (new) — Hooks for fetching system bot config, triggering actions (rotate, optimize, bootstrap), and updating config.

### Data Flow

1. **Bootstrap** (one-time): Alpha triggers or auto-runs on first deploy → creates 3 models + configs + deployments
2. **Every minute** (existing cron): `run-automations` picks up deployed system bot models, generates signals, mirrors trades to subscribers — no changes needed
3. **Daily** (new cron): `system-bots` checks rotation schedule and runs optimization
4. **Weekly**: AI selects new tickers for each bot based on sector performance
5. **On underperformance**: Same self-improve pipeline triggers (health check → param optimization → AI rewrite)

### Ticker Pools (defaults)

- **Tech Growth**: AAPL, MSFT, NVDA, GOOGL, META, AMZN, AMD, CRM, AVGO, ORCL
- **Tech Momentum**: TSLA, PLTR, SNOW, NET, CRWD, DDOG, MDB, ZS, PANW, UBER
- **Precious Metals**: GLD, SLV, GDX, GOLD, NEM, AEM, WPM, FNV

### Security

- System bots are owned by @Seif's real account — uses their Alpaca credentials for data + owner trades
- `is_system` column prevents regular users from creating system bots (checked in edge function)
- Only Alpha role can manage system bot config (RLS + edge function auth check)
- Subscribers interact with system bots exactly like any other model — same subscription, allocation, trade mirroring flow

