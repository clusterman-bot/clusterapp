

## Plan: Two Features — Random Stock Marketing & Quick Build on Stock Detail

### Feature 1: Marketing Bot Random Stock Selection

**What changes**: The Instagram marketing bot will automatically pick a random stock ticker for each post and include a screenshot of that stock's page alongside the configured pages.

**Backend changes (edge function)**:
- Modify `supabase/functions/instagram-marketing-bot/index.ts`:
  - Before screenshotting pages, query the `stocks` table for a random stock using `SELECT symbol FROM stocks ORDER BY random() LIMIT 1`
  - Add the stock detail page (`/trade/stocks/{SYMBOL}`) to the pages list for that post
  - Include the stock symbol in the AI caption prompt so the caption references the featured stock
  - No database schema changes needed — the `pages_captured` log already stores the array of pages

### Feature 2: Quick Build — One-Click Intelligent Bot Builder on Stock Detail

**What it does**: A "Quick Build" button on the stock detail page that uses AI to analyze historical market data for that stock, determine optimal indicators and parameters, then automatically trains ML models (Random Forest, Gradient Boosting, Logistic Regression), validates them, and presents the full results with code visibility.

**New edge function: `supabase/functions/quick-build/index.ts`**

This function orchestrates the entire pipeline in one call:

1. **Fetch market data** — Pull 1 year of daily OHLCV data for the stock via Polygon (or the existing `fetch-market-data` logic)
2. **AI indicator analysis** — Send the raw price data summary (volatility, trend, mean-reversion characteristics) to Lovable AI (Gemini 3 Flash) and ask it to determine:
   - Which indicators to enable (SMA, RSI, Bollinger, EMA, SMA Deviation) and their optimal parameters
   - Optimal hyperparameters for RF, GB, and LR models
   - Appropriate training period (e.g., 80% of data) and validation period (remaining 20%)
   - Horizon and theta values
3. **Create training run** — Insert a `training_runs` record with the AI-determined config
4. **Execute training** — Forward to ML backend (or simulate) with all 3 models
5. **Execute validation** — Automatically trigger validation on the hold-out period once training completes
6. **Return results** — Stream progress updates; final response includes accuracy, F1, recall/precision for all 3 models, best model selection, and the full indicator configuration as viewable code

**Database changes**: 
- Add a `quick_build_runs` table to track the end-to-end pipeline:
  - `id`, `user_id`, `symbol`, `status` (analyzing/training/validating/completed/failed)
  - `ai_analysis` (JSONB — the AI's indicator recommendations with reasoning)
  - `training_run_id` (FK to training_runs)
  - `validation_run_id` (FK to validation_runs)  
  - `indicators_config` (JSONB — the determined indicators and params)
  - `hyperparameters` (JSONB)
  - `training_period`, `validation_period` (text, date ranges)
  - `created_at`, `completed_at`
  - RLS: users can only access their own runs

**Frontend changes**:

1. **`src/pages/StockDetail.tsx`** — Add a "Quick Build" button (with a Zap/lightning icon) next to the existing "Automate" button. Clicking opens the Quick Build panel/page.

2. **New component: `src/components/stock/QuickBuildPanel.tsx`**:
   - Single "Build Best Bot" button to kick off the pipeline
   - Progress stepper UI showing: Analyzing Data → Selecting Indicators → Training Models → Validating → Complete
   - Results display:
     - AI's reasoning for indicator selection (expandable)
     - Table comparing RF, GB, LR with accuracy, F1, recall scores
     - Best model highlighted with a badge
     - Full code/config visibility in a collapsible code block (JSON of indicators, hyperparameters, signal logic)
     - Signal distribution chart (BUY/SELL/HOLD pie chart)
   - "Deploy This Bot" button to create a `stock_automations` entry from the winning config
   - "View Full Code" toggle showing the complete configuration

3. **New hook: `src/hooks/useQuickBuild.tsx`**:
   - `useStartQuickBuild(symbol)` — mutation that calls the edge function
   - `useQuickBuildRun(id)` — query with polling (like `useTrainingRun`) 
   - `useQuickBuildRuns(symbol)` — list past quick builds for this stock

4. **New route** in `src/App.tsx`: No new route needed — the Quick Build panel renders inline on the stock detail page below the chart, or as a dialog/sheet.

### Technical Detail

**AI Analysis Prompt Strategy** (inside `quick-build` edge function):

The edge function will:
1. Fetch 1 year of OHLCV data via `fetch-market-data` logic (reused)
2. Compute summary statistics: avg daily return, volatility (std of returns), max drawdown, trend direction (SMA 50 vs SMA 200), mean-reversion score
3. Send these stats to Gemini 3 Flash with a structured tool call requesting:
   ```
   {
     indicators: { sma: { enabled, windows }, rsi: { enabled, period }, ... },
     hyperparameters: { random_forest: {...}, gradient_boosting: {...}, logistic_regression: {...} },
     training_date_range: { start, end },
     validation_date_range: { start, end },
     horizon: number,
     theta: number,
     reasoning: string
   }
   ```
4. Use the AI's output to create a training run via the existing `ml-backend/train` endpoint
5. Poll for training completion, then automatically trigger `ml-backend/validate`
6. Update the `quick_build_runs` record at each stage

**Data flow:**
```text
User clicks "Quick Build"
  → POST /quick-build { symbol }
  → Edge fn fetches 1yr OHLCV data
  → Computes data characteristics (volatility, trend, etc.)
  → Calls Lovable AI to determine optimal indicators + params
  → Creates training_run with AI config
  → Triggers ml-backend/train (all 3 models)
  → Polls/waits for completion
  → Triggers ml-backend/validate
  → Returns full results to client
```

The client polls `quick_build_runs` for status updates and renders the stepper accordingly. All training/validation results come from the existing `training_runs` and `validation_runs` tables — the quick build just orchestrates and links them.

