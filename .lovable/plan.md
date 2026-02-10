

# Show Real-Time Stock Prices in Trade Panel

## Problem
The stock price displayed in the Quick Trade panel and chart comes from the local database's `current_price` column, which is static/stale data. For symbols fetched via Alpaca fallback, the quote is live, but for the 15 database stocks (AAPL, TSLA, etc.), the price shown is whatever was last saved -- not the current market price.

## Solution
Always fetch a live Alpaca quote for every symbol on the StockDetail page, regardless of whether the stock exists in the local database. Use the live quote price as the authoritative price for the trade panel and chart.

## Changes

### 1. `src/pages/StockDetail.tsx`
- Always call `useAlpacaQuote(symbol)` (not conditionally based on `!dbStock`)
- Use the Alpaca quote price as `currentPrice` when available, falling back to the DB price only if the quote hasn't loaded yet
- This ensures the Quick Trade panel, chart, and order summary all reflect the real market price

### 2. What stays the same
- The `QuickTradePanel` and `AdvancedChart` components don't need changes -- they already accept `currentPrice` as a prop
- The Alpaca quote hook already auto-refreshes every 10 seconds, so the price will stay current

### Result
- All stock prices shown on the detail page will be live market prices from Alpaca
- The "Estimated Cost" in the trade panel will be accurate
- Prices refresh automatically every 10 seconds

