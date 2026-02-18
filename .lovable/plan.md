
## Fix: Non-MFA Users Log In Immediately

### Root Cause

In `src/pages/Auth.tsx`, line 113 has a guard:

```typescript
if (user && !justSignedOut && mode !== 'verify-email' && mode !== 'mfa-challenge') {
  return <p>Redirecting...</p>
}
```

This fires the instant `user` is set after login, before the async `proceed()` function has even finished checking MFA factors. For users with no TOTP enrolled, `proceed()` eventually reaches step 4 and calls `navigate('/trade')`, but the screen is frozen on "Redirecting..." during that async gap — causing the freeze you see.

### Fix (one file, minimal change)

**`src/pages/Auth.tsx`** — two small changes:

1. Add `'redirecting'` to the `AuthMode` union type.
2. At the top of `proceed()`, before the async DB calls begin, set `setMode('redirecting')`. This converts the premature guard into a controlled state.
3. Update the guard at line 113 to check for `mode === 'redirecting'` instead of the blanket `user &&` check — so the "Redirecting..." screen only shows when we have explicitly decided to redirect, not just because `user` exists.
4. Remove the email OTP logic entirely — no new edge functions, no DB columns, no new components needed.

The updated flow for a non-MFA user becomes:

```
signIn() succeeds → user set in state
  → proceed() starts:
      1. Check email_verified (if not: show verify-email screen)
      2. Check isRemembered() (if yes: setMode('redirecting') → navigate /trade)
      3. Check TOTP factors (if found: show mfa-challenge)
      4. No MFA → setMode('redirecting') → navigate /trade immediately
```

No freezing, no extra screens, no email OTPs — users without MFA just land on `/trade`.

### Technical Details

- Only `src/pages/Auth.tsx` is modified
- The `AuthMode` type gains `'redirecting'` as a valid state
- The early-return guard becomes: `if (mode === 'redirecting')`
- `proceed()` calls `setMode('redirecting')` right before each `navigate()` call
- The existing MFA, verify-email, forgot-password, and signup flows are completely unchanged
