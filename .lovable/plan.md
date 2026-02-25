

## Issue: Duplicate Variable Declaration Crashing Edge Function

The `alpaca-trading` edge function has a **duplicate `const accountType` declaration** at lines 199-200, introduced in the last edit. This causes a `SyntaxError: Identifier 'accountType' has already been declared` boot failure, which means every call to the function returns a 500 error. Since the trade page, portfolio, orders, and search all depend on this function, everything appears broken.

### Fix

Remove the duplicate line 200 (`const accountType = isPaper ? 'paper' : 'live';`), keeping only the first declaration at line 199. One-line change, then redeploy.

