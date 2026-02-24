

## Plan: Chunked Backtesting for 100k+ Bars

The approach is to split the work between the **frontend** (orchestrator) and the **edge function** (worker). The edge function stays lean and fast, while the frontend chains multiple calls and stitches results together.

### Architecture

```text
Frontend (BacktestPanel)                    Edge Function (run-backtest)
─────────────────────────────────────────   ────────────────────────────────
1. Calculate chunk date ranges              Unchanged core logic
   e.g. 3-month windows                    (25k bar cap stays)
                                            
2. Call run-backtest for chunk 1            NEW: Accept "chunk_mode" flag
   → get trades, equity, metrics              → returns partial results
                                               + final cash/position state
3. Call run-backtest for chunk 2            
   with carry_over state from chunk 1       Accept carry_over: {
   → get trades, equity, metrics              cash, position, entryPrice
                                            }
4. ... repeat for all chunks                

5. Stitch all results together:
   - Concatenate trades arrays
   - Concatenate equity curves
   - Recompute aggregate metrics
   (sharpe, sortino, drawdown, etc.)
```

### Changes

**1. Edge function `supabase/functions/run-backtest/index.ts`**

Add support for two new optional request fields:
- `carry_over`: `{ cash: number, position: number, entryPrice: number }` — lets the engine resume from where the previous chunk left off instead of starting fresh
- `chunk_mode`: `boolean` — when true, the response includes a `carry_over` object with the ending state (cash, position, entryPrice) so the next chunk can continue

When `carry_over` is provided, initialize `cash`, `position`, and `entryPrice` from it instead of from `initial_capital`. The rest of the simulation logic stays identical.

The response in chunk mode adds:
```json
{
  "carry_over": { "cash": 95230.50, "position": 12, "entryPrice": 402.30 },
  "raw_daily_returns": [0.001, -0.002, ...],
  "raw_equity_curve": [{ "date": "...", "value": ... }, ...]
}
```

The raw (un-downsampled) equity curve and daily returns are needed so the frontend can compute accurate aggregate Sharpe/Sortino/drawdown across all chunks.

**2. Frontend `src/components/backtest/BacktestPanel.tsx`**

Replace the single `supabase.functions.invoke('run-backtest', ...)` call with a chunking orchestrator:

- Split the user's date range into ~60-day windows (configurable, tuned so each chunk stays well under 25k bars at 1Min)
- Loop through chunks sequentially, passing `carry_over` from each response into the next request
- Show a progress bar: "Processing chunk 2 of 5..."
- After all chunks complete, stitch together:
  - **Trades**: concatenate all `trades` arrays
  - **Equity curve**: concatenate all `raw_equity_curve` arrays, then downsample to 500 points for display
  - **Metrics**: recompute from the full concatenated daily returns (Sharpe, Sortino, max drawdown, win rate, profit factor, CAGR, total return)
- Display results exactly as before — no UI layout changes needed, just the orchestration logic

**3. Chunk size calculation**

A helper function determines chunk window size based on timeframe:
- `1Min`: 60 calendar days per chunk (~23 trading days × 390 = ~9,000 bars, safely under 25k)
- `5Min`: 150 calendar days per chunk
- `15Min`: 300 calendar days per chunk  
- `1Hour` / `1Day`: entire range in one chunk (no splitting needed)

### What stays the same
- All indicator logic, signal generation, stop-loss/take-profit
- The 25k bar cap per call (proven to work within CPU limits)
- Equity curve downsampling (now done on the frontend after stitching)
- DB save logic (final aggregated result saved once after all chunks)

### Expected result
A 1-minute TSLA backtest from 01/06/2025 to 02/24/2026 would split into ~7 chunks of 60 days each, fetching ~9,000 bars per chunk for a total of ~63,000 bars processed. The user sees a progress indicator and gets full date-range coverage.

