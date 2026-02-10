
# Fix "Stock Not Found" for Any Symbol

## Problem
The `StockDetail` page only looks up stocks from a local database table that has just 15 hardcoded symbols (AAPL, TSLA, etc.). Any symbol not in that list -- like QQQ, SLV, or thousands of others -- shows "Stock not found" even though the Trade page search (powered by Alpaca) finds them fine.

## Solution
Make the `StockDetail` page fall back to fetching stock info from Alpaca's quote API when the symbol isn't in the local database. This way any tradable symbol works.

## Technical Details

### 1. Update `src/pages/StockDetail.tsx`
- Import `useAlpacaQuote` from `useAlpaca`
- After `useStockBySymbol` returns no result, use `useAlpacaQuote(symbol)` as a fallback
- Build a compatible stock-like object from the Alpaca quote data (symbol, name from URL param, price from quote)
- The page will work for both local DB stocks AND any Alpaca-supported symbol
- Show "Stock not found" only if BOTH the local DB and Alpaca return nothing

### 2. Update `src/hooks/useAlpaca.tsx` -- Add asset info hook
- Add a new `useAlpacaAssetInfo` hook that fetches a single asset's metadata (name, exchange, tradable status) via the existing `alpaca-trading/search` endpoint with the exact symbol
- This provides the stock name and exchange info for symbols not in the local DB

### 3. Result
- Users can search for QQQ, SLV, or any of 10,000+ Alpaca-supported symbols
- The chart, trade panel, and watchlist all work for any symbol
- No database changes needed
