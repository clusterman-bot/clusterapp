

## Root Cause: Crypto symbols missing the `/USD` suffix

The edge function determines whether to use the crypto or stock endpoint with this check:

```typescript
const isCrypto = symbol.includes('/');
```

When you type "SOL" in the AI builder, the symbol is sent as `SOL` — which doesn't contain `/`, so the engine hits Alpaca's **stock** bars endpoint. Alpaca has no stock ticker called "SOL", hence **0 bars**.

For crypto, Alpaca requires the format `SOL/USD`, `BTC/USD`, `ETH/USD`, etc. The logs confirm this:
```
[Backtest] Fetched 0 bars for SOL
[Backtest] Stock page 1: fetched 0 bars, total=0
```

### Fix: Auto-detect crypto symbols in the edge function

**File: `supabase/functions/run-backtest/index.ts`**

Add a known-crypto detection list so that bare symbols like `SOL`, `BTC`, `ETH`, `DOGE` etc. are automatically converted to `SOL/USD` format before the API call. This avoids requiring users to type the full pair.

1. Define a set of common crypto symbols:
   ```
   const KNOWN_CRYPTO = new Set(['BTC','ETH','SOL','DOGE','AVAX','MATIC',
     'LINK','UNI','AAVE','DOT','ADA','XRP','LTC','SHIB','ALGO','ATOM',
     'FIL','NEAR','APE','ARB','OP','CRV','MKR','SUSHI','PEPE','BCH']);
   ```

2. Before the `isCrypto` check (line 305), normalize the symbol:
   ```
   // Auto-detect crypto: if symbol is a known crypto ticker without /USD, append it
   let normalizedSymbol = symbol.toUpperCase();
   if (!normalizedSymbol.includes('/') && KNOWN_CRYPTO.has(normalizedSymbol)) {
     normalizedSymbol = `${normalizedSymbol}/USD`;
   }
   const isCrypto = normalizedSymbol.includes('/');
   ```

3. Use `normalizedSymbol` instead of `symbol` in the Alpaca API calls (both the `symbols` param for crypto and the URL path for stocks), and in the response trade records.

### No frontend changes needed

The BacktestPanel already passes `config.symbol` as-is. Once the edge function auto-detects and normalizes crypto tickers, entering "SOL" or "BTC" will just work — it'll route to the crypto bars endpoint with `SOL/USD`.

### Technical details

- The crypto bars endpoint uses `symbols` as a query param (multi-symbol capable): `?symbols=SOL/USD&timeframe=1Min&...`
- The response nests bars under the symbol key: `data.bars["SOL/USD"]` — so the lookup key also needs to use the normalized symbol
- The known-crypto set is a lightweight check that covers the major assets available on Alpaca; any symbol containing `/` already works correctly

