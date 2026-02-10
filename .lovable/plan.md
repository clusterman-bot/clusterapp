

# Replace Simulated Chart Data with Real Alpaca Historical Bars

## Problem
The candlestick chart (`AdvancedChart`) uses a `generateOHLCData()` function that creates **random fake price movements**. Even though the current price now comes from a live Alpaca quote, the entire chart history (all the candles, volume bars, and technical indicators) is fabricated data.

## Solution
Fetch real historical bar data from Alpaca's Data API (`/v2/stocks/{symbol}/bars`) and feed it into the chart. Fall back to the current simulated data only if the API call fails or the user isn't logged in.

## Technical Details

### 1. Add a `get-bars` action to `supabase/functions/alpaca-trading/index.ts`
- New case `get-bars` in the switch statement
- Calls `https://data.alpaca.markets/v2/stocks/{symbol}/bars` with the user's Alpaca credentials
- Accepts parameters: `symbol`, `timeframe` (1Min, 5Min, 1Hour, 1Day), `start`, `end`, `limit`
- Maps Alpaca's timeframe naming:
  - 1D -> 1Min bars, 1W -> 15Min bars, 1M -> 1Day bars, 3M -> 1Day bars, 1Y -> 1Day bars
- Returns array of `{ timestamp, date, open, high, low, close, volume }`

### 2. Add `useAlpacaBars` hook in `src/hooks/useAlpaca.tsx`
- New React Query hook that calls the `get-bars` action
- Parameters: `symbol`, `timeframe` (maps UI timeframes like "1D", "1M" to Alpaca params)
- Calculates appropriate `start` date based on timeframe selection
- Stale time of 60 seconds to avoid excessive API calls
- Returns typed bar data array

### 3. Update `src/components/trade/AdvancedChart.tsx`
- Import and call `useAlpacaBars(symbol, timeframe)`
- When real data is available, use it directly instead of `generateOHLCData()`
- Calculate technical indicators (SMA, EMA, RSI, Bollinger Bands, MACD) from real bar data using the existing calculation logic
- Keep `generateOHLCData()` as a fallback for unauthenticated users or API failures
- Show a small indicator (e.g., "Live" badge or "Simulated" badge) so users know which data they're seeing

### 4. Timeframe-to-Alpaca mapping
```text
UI Timeframe -> Alpaca bar size   -> Start date offset
1D           -> 1Min              -> 1 day ago
1W           -> 15Min             -> 7 days ago
1M           -> 1Day              -> 30 days ago
3M           -> 1Day              -> 90 days ago
1Y           -> 1Day              -> 365 days ago
ALL          -> 1Day              -> 730 days ago (2 years, Alpaca free tier limit)
```

### Result
- Charts display real OHLC candles, volume, and computed indicators from actual market data
- Technical indicators (SMA, EMA, RSI, BB, MACD) are calculated from real prices
- A "Live" or "Simulated" badge tells the user what they're seeing
- Graceful fallback to simulated data if API is unavailable

