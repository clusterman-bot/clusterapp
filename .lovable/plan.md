

# Plan: Switch ML Backend Data Source from Polygon to Alpaca

## Problem
The `ml-backend` edge function fetches historical OHLCV data from Polygon.io, but you only have a free/delayed Polygon key. The rest of the platform already uses Alpaca's Data API for bars, which works reliably with your existing credentials.

## Change

**Single file: `supabase/functions/ml-backend/index.ts`**

Replace the `fetchMarketData()` function (~lines 412-437):
- Remove the Polygon API call
- Replace with a call to `https://data.alpaca.markets/v2/stocks/{ticker}/bars` using `ALPACA_API_KEY` and `ALPACA_API_SECRET` (already available as secrets)
- Map Alpaca's bar format (`{ t, o, h, l, c, v, vw }`) to the existing `Bar` interface (same field names the Polygon mapper already uses)
- Keep the simulated data fallback if neither key is available
- Remove the `POLYGON_API_KEY` import at the top (line 14) since it's no longer needed here

The Alpaca bars endpoint returns the same OHLCV data structure, so no changes needed anywhere else in the ML pipeline -- feature engineering, labeling, training, and validation all work identically.

## Technical Details

```text
Before:  Polygon.io → /v2/aggs/ticker/{sym}/range/1/day/{start}/{end}
After:   Alpaca     → /v2/stocks/{sym}/bars?timeframe=1Day&start={start}&end={end}&limit=1000
Auth:    APCA-API-KEY-ID + APCA-API-SECRET-KEY headers (same as alpaca-trading function)
```

No database changes. No UI changes. No new secrets needed.

