

## Plan: Self-Improving Trading Bot

A closed-loop system where the bot monitors its own performance and, when metrics degrade past thresholds, automatically optimizes its parameters and — if that fails — rewrites the entire strategy using AI.

### Architecture

```text
Every 1-minute run-automations cycle:
                                          
  ┌─────────────────────────┐             
  │  Run normal signals     │             
  │  (existing logic)       │             
  └──────────┬──────────────┘             
             │                            
             ▼                            
  ┌─────────────────────────┐             
  │  Check performance      │  NEW        
  │  thresholds             │             
  │  (win_rate, drawdown,   │             
  │   consecutive losses)   │             
  └──────────┬──────────────┘             
             │ threshold breached?        
             ▼                            
  ┌─────────────────────────┐             
  │  STAGE 1: Parameter     │  NEW        
  │  Optimization           │             
  │  - Run mini backtests   │             
  │    with param variations│             
  │  - Pick best config     │             
  │  - Hot-swap on bot      │             
  └──────────┬──────────────┘             
             │ still degraded?            
             ▼                            
  ┌─────────────────────────┐             
  │  STAGE 2: AI Strategy   │  NEW        
  │  Rewrite                │             
  │  - Feed trade history   │             
  │    + market context to  │             
  │    Lovable AI           │             
  │  - Generate new config  │             
  │  - Backtest & validate  │             
  │  - Hot-swap if better   │             
  └─────────────────────────┘             
```

### Database Changes

**New table: `bot_optimization_logs`**
Tracks every self-improvement attempt so users can see what the bot changed and why.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| automation_id | uuid | FK → stock_automations (nullable) |
| model_id | uuid | FK → models (nullable) |
| user_id | uuid | Owner |
| trigger_reason | text | e.g. "win_rate_below_40", "max_drawdown_exceeded", "consecutive_losses_5" |
| stage | text | "parameter_optimization" or "ai_rewrite" |
| old_config | jsonb | Snapshot of config before change |
| new_config | jsonb | The optimized/rewritten config |
| old_metrics | jsonb | { win_rate, drawdown, consecutive_losses } at trigger time |
| new_metrics | jsonb | Backtest results of the new config (if validated) |
| status | text | "pending", "applied", "rejected", "failed" |
| created_at | timestamptz | |

RLS: Users can view their own optimization logs.

**New columns on `stock_automations`:**
- `self_improve_enabled` boolean DEFAULT false — opt-in toggle
- `min_win_rate` numeric DEFAULT 0.40 — trigger if win rate drops below this
- `max_drawdown_threshold` numeric DEFAULT 15 — trigger if drawdown exceeds this %
- `max_consecutive_losses` integer DEFAULT 5 — trigger after N losses in a row
- `last_optimization_at` timestamptz — cooldown tracking (min 1 hour between attempts)
- `optimization_generation` integer DEFAULT 0 — tracks how many times the bot has self-improved

### Edge Function Changes

**1. New function: `supabase/functions/bot-optimizer/index.ts`**

A dedicated function called by `run-automations` when thresholds are breached. Keeps the main automation loop lean.

**Actions:**
- `check-health`: Analyzes recent signals from `automation_signals` for a given automation. Returns current metrics (win_rate, drawdown, consecutive_losses) and whether thresholds are breached.
- `optimize-params`: Generates 5-10 parameter variations (RSI thresholds ±5, SMA windows ±2, theta ±0.005, stop-loss/take-profit ±2%). Runs quick backtests (last 30 days, 5Min bars to keep it fast) for each variation using the existing run-backtest chunked engine. Picks the config with the best Sharpe ratio. Returns the winning config.
- `ai-rewrite`: Sends the bot's recent trade history, current config, and performance summary to Lovable AI (via `ai-strategy-builder` pattern) with a prompt like: "This trading strategy has been underperforming. Here's its recent history: [trades]. Current config: [config]. Win rate: X%, drawdown: Y%. Generate an improved strategy for [symbol] that addresses these weaknesses." Parses the AI response into a valid automation config. Runs a quick backtest to validate the new strategy beats the old one.
- `apply`: Hot-swaps the automation's config (indicators, thresholds, risk params) with the optimized one. Logs the change in `bot_optimization_logs`.

**2. Update `run-automations/index.ts`**

After processing each stock automation's signal, add a performance health check:
```
if (automation.self_improve_enabled) {
  // Cooldown: skip if optimized within last hour
  if (lastOptimizedMoreThan1HourAgo) {
    call bot-optimizer/check-health
    if (thresholds breached) {
      call bot-optimizer/optimize-params
      if (new config beats old) → apply
      else → call bot-optimizer/ai-rewrite
      if (ai config beats old) → apply
    }
  }
}
```

This runs inside the existing 1-minute cron, but with a 1-hour cooldown so it doesn't optimize on every tick.

**3. Frontend: `src/pages/StockAutomationConfig.tsx`**

Add a "Self-Improving Bot" settings section (collapsed by default):
- Toggle: "Enable self-improvement"
- Threshold inputs: Min win rate %, Max drawdown %, Max consecutive losses
- Read-only "Generation" counter showing how many times the bot has self-improved
- Optimization history log (from `bot_optimization_logs`) showing what changed and when, with before/after configs

### How each stage works in detail

**Stage 1 — Parameter Optimization:**
- Takes current config as baseline
- Generates variations by adjusting numeric params within ±20% bounds
- For each variation, calls `run-backtest` with last 30 calendar days of data (uses existing chunked backtest, typically 1 chunk at 5Min)
- Ranks by Sharpe ratio; if best variation improves Sharpe by >10% over current, apply it
- Total time: ~5-10 seconds (5-10 quick backtests)

**Stage 2 — AI Strategy Rewrite:**
- Only triggered if Stage 1 didn't produce a meaningful improvement
- Sends to Lovable AI: recent 50 trades, current config, market conditions
- Uses the same `generate_strategy` tool schema from `ai-strategy-builder`
- Validates the AI output with a 30-day backtest
- Only applies if the new strategy's Sharpe > old strategy's Sharpe
- Logs the full rewrite in `bot_optimization_logs` for transparency

### What stays the same
- Normal signal generation and trade execution logic
- The 1-minute cron schedule
- All existing indicator logic
- Deployed model pipeline (this only applies to stock automations initially)
- User must explicitly opt in via the toggle

### Safety guardrails
- 1-hour cooldown between optimization attempts
- New config must beat old config in backtest before applying
- All changes logged with before/after snapshots
- Generation counter caps at 50 (prevents infinite rewrite loops)
- User can disable self-improvement at any time and manually revert via the log

