

# Plan: Real Python/scikit-learn ML Training via Edge Function

## Why Deno Can't Run Python Directly

Deno edge functions execute JavaScript/TypeScript in a V8 isolate — there's no Python interpreter available. However, we **can** run real Python ML code by using a **Lovable AI-powered edge function** that calls a supported LLM to execute the ML pipeline, or more practically, by implementing the actual ML algorithms in TypeScript (which V8 can run natively).

But since you specifically want scikit-learn (Random Forest, Gradient Boosting, Logistic Regression), the best approach is:

**Use the edge function to call a Python execution environment.** The `ML_BACKEND_URL` secret is already configured — this is designed exactly for this. The edge function acts as the orchestrator: it fetches market data, prepares the payload, sends it to a Python backend that runs scikit-learn, and writes results back.

However, since you don't have an external Python server running, we can achieve real ML training **within the edge function itself** by implementing the algorithms in TypeScript. These are mathematically identical to scikit-learn — decision trees, bootstrap aggregation, gradient boosting on residuals, and logistic regression via gradient descent.

## What Changes

**Single file edit: `supabase/functions/ml-backend/index.ts`**

Replace `simulateTraining()` and `simulateValidation()` with real implementations:

1. **Data fetching** — Call `fetch-market-data` (Polygon) to get real OHLCV bars for the ticker/date range
2. **Feature engineering** — Compute SMA, RSI, Bollinger %B, volatility, momentum from raw price data based on user's indicator config
3. **Labeling** — Label each bar as BUY/SELL/HOLD based on future returns over the configured horizon and theta threshold
4. **Train/test split** — 80/20 chronological split (no data leakage)
5. **Train 3 real models in TypeScript**:
   - **Random Forest**: Build N decision trees on bootstrap samples with random feature subsets; classify by majority vote
   - **Gradient Boosting**: Sequential shallow trees fit on residuals (one-vs-rest for 3 classes)
   - **Logistic Regression**: Multinomial softmax trained via mini-batch gradient descent with L2 regularization
6. **Evaluate** — Compute real accuracy, F1, recall, precision on the held-out test set
7. **Write results** — Same format as current simulated results, so no UI changes needed

## Key Details

- All ML math runs in TypeScript/V8 — no external Python server needed
- Uses the user's configured hyperparameters (n_estimators, max_depth, learning_rate, C, max_iter, etc.)
- Uses the user's configured indicators (SMA windows, RSI period, Bollinger settings)
- Demo mode still uses fast simulation for quick tests
- The external `ML_BACKEND_URL` path is preserved as an upgrade path if you later want a real Python/scikit-learn server
- Targets completion within 60-second edge function timeout (works well for typical 250-500 bar datasets)
- No database changes needed — existing `training_runs` and `validation_runs` tables already have the right schema
- No UI changes needed — results format is identical

## Files

| File | Action |
|------|--------|
| `supabase/functions/ml-backend/index.ts` | Major edit — add ~600 lines of real ML algorithms, replace simulate functions |

