

# Remove Fake Data from Trade Page

## Overview
Strip out all randomly generated/fake data components from the stock detail page, keeping only the candlestick chart (even though its data is generated) and the quick trade panel (which executes real orders via Alpaca).

## What Gets Removed

- **Ticker Tape** (`TickerTape`) -- scrolling banner with fake prices
- **Technical Indicators** (`TechnicalIndicators`) -- random RSI, MACD, buy/sell signals
- **Order Book** (`OrderBook`) -- fake bid/ask depth data
- **Market Stats** (`MarketStats`) -- random P/E, EPS, beta, volume comparisons

## What Stays

- **Advanced Chart** (`AdvancedChart`) -- the candlestick/area/line chart with timeframes and indicator overlays (SMA, EMA, Bollinger Bands, RSI, Volume)
- **Quick Trade Panel** (`QuickTradePanel`) -- real order placement via Alpaca
- **Stock header** -- symbol, name, sector badge, watchlist button, trading mode toggle

## Changes

### `src/pages/StockDetail.tsx`
- Remove imports for `TickerTape`, `TechnicalIndicators`, `OrderBook`, `MarketStats`
- Remove the `<TickerTape />` below the nav
- Change the layout from a 4-column grid to a simpler 3+1 layout:
  - Left (3 cols): Chart only (no Order Book or Market Stats below it)
  - Right (1 col): QuickTradePanel only (no TechnicalIndicators below it)

The result is a clean, focused stock detail page with just the chart and the trade panel -- similar to Robinhood's stock view.

