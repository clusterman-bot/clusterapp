
## Assessment + Market Hours Cutoff Plan

### 1. Instagram Marketing Bot — Does It Work?

**Short answer: The code is correct and complete, but it has never been triggered.**

The edge function logs show zero activity for `instagram-marketing-bot`. The reason is straightforward: the cron job fires only when `next_post_at <= now()`, and since you haven't saved a config yet via the Alpha Dashboard UI, there are no rows in `marketing_bot_config` — so the function always returns "No configs due for posting" and logs nothing.

**What still needs to happen (one-time, by you):**
1. Open the Alpha Dashboard → Marketing Bot tab
2. Enter your Instagram Business Account ID and long-lived access token
3. Set your posting interval and pages to capture
4. Click Save (this creates the first DB row and sets `next_post_at`)
5. Click "Post Now" to test immediately

The function itself — screenshots, AI caption generation, Instagram Graph API carousel posting — is fully implemented and ready. It just needs user-supplied credentials to run.

---

### 2. Market Hours Cutoff — 4 PM EST / 9 AM EST

**Current state: No market hours enforcement exists anywhere.**

Right now, both the `run-automations` function and the `stock-monitor` function run unconditionally on every cron tick, 24/7. There is no time-of-day check. Trades would be attempted even at 2 AM or on weekends. Alpaca would reject them for outside-hours violations, but this is wasteful and can cause noisy error logs.

**What needs to be built:**

A single shared market hours guard added to both functions. The logic:
- Convert current UTC time to US Eastern Time (accounting for daylight saving: UTC-5 in EST, UTC-4 in EDT)
- Enforce the window: **9:00 AM – 4:00 PM ET, Monday–Friday**
- If outside the window: skip all trade execution, return early with `{ message: "Outside market hours" }`

This applies to **three places**:
1. `run-automations/index.ts` — at the top of the main handler, before Pipeline 1 (stock automations) and Pipeline 2 (deployed models)
2. `stock-monitor/index.ts` — before the trade execution block (the signal can still be computed, but the actual Alpaca order placement should be skipped outside hours)
3. Optionally, a UI badge on the Alpha Dashboard and Model pages showing "Trading paused — market closed" when outside hours

---

### Technical Implementation

**Market hours helper function** (shared logic, duplicated into each edge function since Deno edge functions can't share modules):

```typescript
function isMarketOpen(): boolean {
  const now = new Date();
  // Determine Eastern offset: EDT (UTC-4) Mar 2nd Sunday → Nov 1st Sunday
  // EST (UTC-5) otherwise
  const year = now.getUTCFullYear();
  const dstStart = getSecondSundayOfMarch(year);   // EDT starts
  const dstEnd   = getFirstSundayOfNovember(year);  // EST resumes
  const isDST = now >= dstStart && now < dstEnd;
  const offsetHours = isDST ? 4 : 5;

  const etMs = now.getTime() - offsetHours * 3600 * 1000;
  const et = new Date(etMs);

  const dayOfWeek = et.getUTCDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Weekend

  const hours = et.getUTCHours();
  const minutes = et.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;

  return timeInMinutes >= 9 * 60 && timeInMinutes < 16 * 60; // 9:00 AM–4:00 PM ET
}
```

**In `run-automations/index.ts`:** Add the check right after authentication, before Pipeline 1:
```typescript
if (!isMarketOpen()) {
  console.log('[RunAutomations] Outside market hours (9AM–4PM ET, Mon–Fri), skipping');
  return new Response(JSON.stringify({ message: 'Outside market hours' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

**In `stock-monitor/index.ts`:** Add the same check just before the "Execute trade if signal is BUY or SELL" block (line ~411). The signal is still computed and logged, but no order is placed. This matches the existing pattern of logging signals without executing:
```typescript
if (signalType !== 'HOLD') {
  if (!isMarketOpen()) {
    console.log(`[StockMonitor] Market closed — skipping trade for ${symbol}`);
    signalRecord.trade_executed = false;
    signalRecord.error_message = 'Market closed (outside 9AM–4PM ET)';
    // fall through to insert signal + return
  } else {
    // ... existing trade execution code
  }
}
```

**UI Status badge (optional but useful):** A small "Market Closed" / "Market Open" chip on the Stock Automation Config page and Model Deploy cards, driven by the same ET time calculation on the client side.

---

### Files to Modify

| File | Change |
|---|---|
| `supabase/functions/run-automations/index.ts` | Add `isMarketOpen()` helper + early return before Pipeline 1 |
| `supabase/functions/stock-monitor/index.ts` | Add `isMarketOpen()` helper + guard around order placement |
| `src/pages/StockAutomationConfig.tsx` (optional) | Add "Market Open/Closed" status badge |
| `src/components/model/PublishToggle.tsx` (optional) | Add market hours indicator |

No database changes are needed — this is purely runtime logic in the edge functions.

---

### Important Notes

- **The cutoff is sharp**: At exactly 4:00 PM ET, any cron tick will skip. In-flight orders already submitted before 4 PM are not cancelled (Alpaca handles EOD settlement for `time_in_force: 'day'` orders automatically).
- **Weekends**: The guard also blocks Saturday and Sunday automatically.
- **DST handled correctly**: The helper accounts for Daylight Saving Time transitions so the window is always "9 AM–4 PM local New York time" regardless of the time of year.
- **Subscribers are also covered**: Since subscriber trade mirroring happens inside `run-automations` and `stock-monitor`, they are automatically paused when the guard triggers — no separate change needed for subscribed models.
