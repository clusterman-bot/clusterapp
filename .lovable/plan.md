
## Position Budget System for Stock Automations

### What this solves

Right now the automation fires trades based on `max_quantity` (shares) with no dollar cap. The user wants a **maximum investment amount** per automation (e.g. "$1,000 in AAPL") and a **live tracking ledger** that adjusts the remaining budget as trades execute:

- BUY $500 of AAPL → remaining budget drops from $1,000 to $500
- SELL $300 worth → remaining budget rises back to $800
- Bot never buys more than the remaining budget allows

---

### Data Model

Two new columns go on `stock_automations`:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `max_investment_amount` | `numeric` | `null` | Dollar cap the user sets — null means no cap (current behaviour) |
| `current_invested_amount` | `numeric` | `0` | Running ledger of dollars currently invested |

These columns track the **position budget**, not account buying power. The check happens at trade time in the `stock-monitor` edge function.

**Database migration required** — 2 new columns added to `stock_automations`.

---

### Logic in `stock-monitor` (the actual trade executor for personal automations)

**BUY signal:**
1. If `max_investment_amount` is set, compute `remaining = max_investment_amount - current_invested_amount`.
2. If `remaining <= 0` → block the trade (log error, skip order).
3. Otherwise, cap the trade value to `remaining`: `capped_qty = floor(remaining / currentPrice)` and use `min(capped_qty, requested_qty)`.
4. After a successful fill, update `current_invested_amount += filled_qty * filled_price`.

**SELL signal:**
1. After a successful fill, update `current_invested_amount = max(0, current_invested_amount - filled_qty * filled_price)`.
2. Limit never blocks a sell — only buys are throttled.

---

### UI changes — `StockAutomationConfig.tsx`

Inside the "Trading Parameters" card, add a new field above or below "Max Quantity":

```
Max Investment Amount ($)
[___________] ← dollar input, blank/0 = no limit

Current Invested: $480.00 / $1,000.00  [Reset]
                  ████████░░  (48%)
```

- The field maps to `max_investment_amount`.
- A read-only row shows `current_invested_amount / max_investment_amount` with a progress bar.
- A "Reset" button zeros `current_invested_amount` (useful if the user manually exited a position on Alpaca and wants to clear the ledger).

---

### Hook changes — `useStockAutomations.tsx`

Add `max_investment_amount` and `current_invested_amount` to the `StockAutomation` interface and to the `handleSave` payload.

Add a new `useResetInvestedAmount` mutation that sets `current_invested_amount = 0` for a given automation ID (for the Reset button).

---

### Files to change

| File | Change |
|---|---|
| Database migration | Add `max_investment_amount numeric` and `current_invested_amount numeric DEFAULT 0` to `stock_automations` |
| `src/hooks/useStockAutomations.tsx` | Add fields to interface + `useResetInvestedAmount` mutation |
| `src/pages/StockAutomationConfig.tsx` | Add dollar input, progress bar, and Reset button in Trading Parameters section |
| `supabase/functions/stock-monitor/index.ts` | Enforce budget cap on BUY, update ledger on BUY fill and SELL fill |

---

### Precise engine logic in `stock-monitor`

```
// --- After generating signal, before placing order ---
const maxInvestment = automation.max_investment_amount ?? null;
const currentInvested = automation.current_invested_amount ?? 0;

if (side === 'buy' && maxInvestment !== null) {
  const remaining = maxInvestment - currentInvested;
  if (remaining <= 0) {
    // Block the trade — budget exhausted
    signalRecord.error_message = `Budget exhausted ($${currentInvested.toFixed(2)} / $${maxInvestment.toFixed(2)})`;
    // log signal and return
  }
  // Cap quantity to what remaining budget can afford
  const budgetCappedQty = Math.floor(remaining / currentPrice);
  qty = Math.min(qty, budgetCappedQty);
  if (qty <= 0) { /* block */ }
}

// --- After successful fill ---
if (orderData.id && filledPrice > 0) {
  const tradeValue = qty * filledPrice;
  if (side === 'buy') {
    newInvested = currentInvested + tradeValue;
  } else {
    newInvested = Math.max(0, currentInvested - tradeValue);
  }
  // UPDATE stock_automations SET current_invested_amount = newInvested WHERE id = automationId
}
```

---

### Backward compatibility

- `max_investment_amount = null` means no cap — the bot behaves exactly as it does today.
- `current_invested_amount` starts at 0. Existing automations get the new columns with these safe defaults so no existing row is broken.
- The UI only shows the progress bar and Reset button when `max_investment_amount` is set to a value > 0.

---

### What the user sees end-to-end

1. Open AAPL automation config → set "Max Investment Amount" to $1,000 → Save.
2. Bot runs → BUY signal at $180/share → budget has $1,000 remaining → buys 5 shares ($900) → ledger becomes $900 / $1,000.
3. Bot runs again → BUY signal → only $100 left → buys 0 whole shares (budget exhausted) → trade blocked, logged.
4. Bot generates SELL → sells 3 shares at $185 → ledger drops by $555 → ledger is now $345 / $1,000 → more buys are allowed again.
5. User manually exited Alpaca position → clicks "Reset" → ledger goes back to $0 / $1,000.
