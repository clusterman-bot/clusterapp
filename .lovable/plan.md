

## Plan: Platform-Wide Strategy Knowledge Base

A shared learning system that captures insights from every bot built, optimized, or backtested on the platform and feeds that collective intelligence back into future AI strategy generation.

### Concept

Every time a user builds a bot (AI Bot Builder, Quick Build, or manual automation), the system anonymously logs what worked and what didn't — indicator combinations, parameter ranges, asset-specific patterns, backtest outcomes, and optimization results. When the next user asks AI to build a strategy, the system retrieves relevant historical knowledge and injects it into the AI prompt as context, making every new bot smarter than the last.

### Architecture

```text
Data Collection (passive, on every bot event):

  Bot Created / Config Changed / Backtest Completed / Optimization Applied
         │
         ▼
  ┌──────────────────────────┐
  │  strategy_knowledge      │  NEW TABLE
  │  (anonymized insights)   │
  │  - asset, indicators,    │
  │    params, outcomes,     │
  │    what improved/failed  │
  └──────────┬───────────────┘
             │
             ▼
Data Retrieval (active, on every AI call):

  User asks AI to build a bot for AAPL
         │
         ▼
  ┌──────────────────────────┐
  │  Query strategy_knowledge│
  │  for AAPL + similar      │
  │  assets, top performers  │
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────────┐
  │  Inject into AI system   │
  │  prompt as context       │
  │  "Platform data shows    │
  │   RSI(14)+EMA(12,26)     │
  │   had 62% win rate on    │
  │   AAPL over 47 bots..."  │
  └──────────────────────────┘
```

### Database Changes

**New table: `strategy_knowledge`**
Stores anonymized, aggregated insights from every bot interaction on the platform.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| symbol | text | Ticker the strategy targets |
| source_type | text | "ai_builder", "quick_build", "manual_automation", "optimization", "backtest" |
| indicators_used | jsonb | Which indicators were enabled and their params |
| risk_params | jsonb | { theta, stop_loss, take_profit, position_size, horizon } |
| custom_indicator_names | text[] | Names of any custom indicators used (no code stored for IP protection) |
| outcome_metrics | jsonb | { sharpe_ratio, win_rate, total_return, max_drawdown } — null if no backtest |
| optimization_delta | jsonb | If from optimization: { old_sharpe, new_sharpe, improvement_pct, stage } |
| tags | text[] | AI-derived tags like "momentum", "mean_reversion", "high_volatility" |
| created_at | timestamptz | |

RLS: No user_id column — this is fully anonymized. All authenticated users can SELECT. Only service role can INSERT (via edge functions).

**New table: `knowledge_summaries`**
Pre-computed per-symbol summaries refreshed periodically to keep AI prompt injection fast.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| symbol | text | UNIQUE — one summary per ticker |
| total_strategies | integer | How many bots have been built for this symbol |
| avg_sharpe | numeric | Average Sharpe across all strategies with outcomes |
| avg_win_rate | numeric | Average win rate |
| best_indicator_combo | jsonb | Most common indicator set among top-performing strategies |
| best_params | jsonb | Average params of top 20% strategies |
| common_pitfalls | text[] | AI-generated list of what tends to fail |
| summary_text | text | Pre-formatted text block ready for prompt injection |
| updated_at | timestamptz | |

RLS: All authenticated users can SELECT. Only service role can INSERT/UPDATE.

### Edge Function Changes

**1. New function: `supabase/functions/strategy-knowledge/index.ts`**

Actions:
- `ingest`: Called internally by other edge functions after bot creation, backtest completion, or optimization. Receives the anonymized data and inserts into `strategy_knowledge`. Also tags the entry using AI (quick classification call).
- `query`: Given a symbol, returns the `knowledge_summaries` row plus the top 10 most relevant recent entries from `strategy_knowledge`. Used by `ai-strategy-builder` and `quick-build` before calling AI.
- `refresh-summaries`: Recomputes `knowledge_summaries` for symbols that have new data. Can be called on a schedule or after N new entries.

**2. Update `supabase/functions/ai-strategy-builder/index.ts`**

Before calling the AI gateway, query `strategy-knowledge/query` for the target symbol. Append a "Platform Intelligence" section to the system prompt:

```
PLATFORM INTELLIGENCE for {SYMBOL}:
- {N} strategies have been built for this symbol on the platform
- Top-performing indicator combinations: {best_indicator_combo}
- Average Sharpe of successful strategies: {avg_sharpe}
- Common pitfalls to avoid: {common_pitfalls}
- Recent high-performing configs: {top_entries}

Use this data to inform your strategy generation. Prefer indicator
combinations and parameter ranges that have historically performed
well on this platform.
```

**3. Update `supabase/functions/quick-build/index.ts`**

Same pattern: before `aiAnalyze()`, fetch platform knowledge for the symbol and pass it as additional context in the AI prompt.

**4. Update `supabase/functions/bot-optimizer/index.ts`**

In the `ai-rewrite` action, include platform knowledge as additional context so the AI rewriter benefits from collective intelligence. Also, after a successful `apply`, call `strategy-knowledge/ingest` to log the optimization result.

**5. Update `supabase/functions/run-automations/index.ts`**

After deploying a new automation (first signal generation), call `strategy-knowledge/ingest` to log the initial configuration.

**6. Hook into backtest completion**

The existing `sync_model_metrics_from_backtest` trigger fires on backtest completion. Add a new edge function call (or extend the trigger) to ingest backtest results into `strategy_knowledge`.

### Frontend Changes

**`src/pages/AIBotBuilder.tsx`** — Add a small "Platform Intelligence" badge/indicator next to the chat that shows when platform knowledge is being used. When the AI response comes back, if platform data was consulted, show a subtle note like "Enhanced with insights from 47 strategies built for AAPL."

**New component: `src/components/PlatformInsights.tsx`** — A small card shown on the AI Bot Builder and Quick Build pages displaying aggregate stats for the selected symbol (e.g., "23 strategies built for TSLA, avg Sharpe: 1.2, most popular: RSI + MACD").

### Data Flow Summary

1. **Collection points** (passive — no user action needed):
   - AI Bot Builder deploys a strategy → ingest config + symbol
   - Quick Build completes → ingest AI analysis + training results
   - Backtest finishes → ingest outcome metrics
   - Bot optimizer applies changes → ingest old/new config + improvement delta
   - Manual automation created/updated → ingest indicator + risk config

2. **Consumption points** (active — enriches AI prompts):
   - AI Bot Builder chat → query before AI call
   - Quick Build analysis → query before AI call
   - Bot optimizer AI rewrite → query before AI call

### Privacy and Safety

- No user IDs stored in `strategy_knowledge` — fully anonymized
- No custom indicator code stored (only names) — protects intellectual property
- Only aggregate metrics, not individual trade data
- Service role only for writes — users cannot inject false data
- Knowledge summaries are read-only for users

### What stays the same

- All existing bot building, deployment, and trading logic
- User-facing workflows unchanged — intelligence is injected silently
- No new user-facing configuration required — it just works
- Existing AI prompts remain the foundation; platform knowledge is additive context

