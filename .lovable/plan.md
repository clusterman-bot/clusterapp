
## Root Cause: `useEffect` Re-Runs After `setMode('redirecting')`

The `useEffect` that runs `proceed()` has `mode` in its dependency array. Here is the exact sequence causing the freeze:

1. User submits login → `signIn()` succeeds → `user` is set in state
2. `useEffect` fires (because `user` changed), `proceed()` runs
3. `proceed()` fetches email_verified, confirms no TOTP → calls `setMode('redirecting')`
4. `setMode('redirecting')` causes a re-render AND re-triggers the `useEffect` (because `mode` is a dependency)
5. `useEffect` fires again — now `mode === 'redirecting'`
6. The guards only check for `mode === 'mfa-challenge'` and `mode === 'verify-email'` — **`'redirecting'` is not guarded**
7. `proceed()` runs a SECOND time: it fetches from the DB again, calls `navigate('/trade')` again mid-flight
8. React state updates collide with the in-progress navigation, causing the freeze

The current guards at the top of the `useEffect`:
```typescript
if (mode === 'mfa-challenge') return;
if (mode === 'verify-email') return;
// 'redirecting' is NOT guarded — this is the bug
```

### Fix: One Line in Auth.tsx

Add a guard for `mode === 'redirecting'` inside the `useEffect`, alongside the existing `mfa-challenge` and `verify-email` guards.

**Before (lines 62-63):**
```typescript
if (mode === 'mfa-challenge') return;
if (mode === 'verify-email') return;
```

**After:**
```typescript
if (mode === 'mfa-challenge') return;
if (mode === 'verify-email') return;
if (mode === 'redirecting') return;
```

This single addition prevents `proceed()` from running a second time once the redirect decision has already been made. The navigation to `/trade` will complete cleanly without interference.

### Technical Details

- Only `src/pages/Auth.tsx` is modified
- One line is added inside the `useEffect`, at line ~64
- All existing flows (MFA, verify-email, forgot-password, signup) remain completely unchanged
- The fix is the minimal correct solution — no restructuring needed
