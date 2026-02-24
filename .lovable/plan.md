

## Root Cause: Alpaca's 10,000-bar limit without pagination

The problem is clear. At **1-minute resolution**, TSLA generates ~390 bars per trading day (6.5 hours × 60 minutes). With `limit: '10000'` hardcoded in the Alpaca API call, the engine fetches at most **10,000 bars**, which covers only ~25.6 trading days (about 5 weeks). That's why your data stops at 02-13-2025 — it ran out of bars, not out of date range.

The Alpaca bars API supports **pagination** via a `next_page_token` in the response, but the current code makes a single request and stops.

### Math breakdown
- Your range: 01/06/2025 → 02/24/2026 (~290 trading days)
- At 1Min: 290 × 390 = **~113,000 bars** needed
- Current fetch: **10,000 bars** (only ~25 days worth)

### Plan: Add pagination loop to fetch all bars

**1. Edge function `supabase/functions/run-backtest/index.ts`**

Replace the single-fetch logic (for both stocks and crypto) with a **pagination loop** that:
- Makes repeated requests using Alpaca's `next_page_token`
- Accumulates bars across pages until all data in the date range is retrieved
- Caps at a reasonable maximum (e.g., 50,000–100,000 bars) to stay within edge function compute limits
- Logs progress so you can see how many pages were fetched

The stock bars endpoint returns a `next_page_token` field in the response JSON when more data is available. The loop continues fetching with that token appended as a query parameter until it's `null` or the cap is reached.

**2. Performance guard rails**

Since fetching 100,000+ 1-minute bars is feasible but heavy:
- Set a max bar cap (~50,000) to prevent timeouts — this covers ~128 trading days at 1Min, or the full range at coarser timeframes
- If the cap is hit, log a warning and proceed with partial data, noting in the response how much of the date range was covered
- The existing sliding-window optimization and equity curve downsampling already handle large datasets efficiently

**3. No frontend changes needed**

The UI already displays `bars_count` in the results. Users will see a much higher bar count and fuller date coverage automatically.

### Technical details

Alpaca pagination pattern:
```text
GET /v2/stocks/TSLA/bars?start=...&end=...&limit=10000&sort=asc
→ response: { bars: [...], next_page_token: "abc123" }

GET /v2/stocks/TSLA/bars?start=...&end=...&limit=10000&sort=asc&page_token=abc123
→ response: { bars: [...], next_page_token: "def456" }

... repeat until next_page_token is null
```

The same pattern applies to the crypto bars endpoint (`/v1beta3/crypto/us/bars`), using `next_page_token` in the response.

### Expected result

With pagination, a 1-minute backtest from 01/06/2025 to 02/24/2026 should fetch **50,000+ bars** (capped for safety) covering several months of data instead of just 25 days, producing significantly more trades across the full date range.

