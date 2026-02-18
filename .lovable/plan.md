
# Fix MFA: Bypass on Refresh, Remember Me Auto-Login, and UI Clarity

## What's Wrong Right Now

### Bug 1: MFA is bypassed on refresh or re-visiting /auth

The current `useEffect` (lines 55-79 in `Auth.tsx`) fires whenever `user` is non-null — including when a session is restored from localStorage on page refresh. It calls `checkVerification()` which only checks `email_verified`, and then goes straight to `navigate('/trade')`. The MFA check (`checkMFAAndProceed`) only runs inside `handleLogin` — so any login path that doesn't go through the form button skips MFA entirely.

### Bug 2: Remember Me doesn't auto-login, it still asks for MFA

`isRemembered()` is checked inside `checkMFAAndProceed()` which is called from `handleLogin`. But `handleLogin` only runs on a fresh form submit — not on session restore. So even if "Remember me" was checked and the timestamp is still valid, the user still sees the login form on their next visit instead of being auto-redirected.

### Bug 3: handleMFASuccess flips mode to 'login' which re-triggers the useEffect

When MFA is successfully completed, `handleMFASuccess` sets `mode` back to `'login'`. This causes the `useEffect` to re-fire (since `mode` is in the dependency array at line 79 and the guard `if (mode === 'mfa-challenge') return` no longer applies). That re-run calls `navigate('/trade')` correctly — but this is fragile and causes an unnecessary double render cycle.

## The Fix

Move ALL redirect and MFA logic into the single `useEffect`, making it the gatekeeper for every path that could lead to `/trade`. `handleLogin` simply calls `signIn` and exits — the `useEffect` reacts to the user being set and does the rest.

### Revised flow for the useEffect:

```text
user becomes non-null (from ANY source: form login, session restore, OAuth)
    |
    v
Is mode already 'mfa-challenge'? → return (don't interfere)
    |
    v
Check email_verified in profiles
    → not verified → show verify-email screen
    |
    v
isRemembered()? → YES → navigate('/trade') immediately (1-hour auto-login)
    |
    v
List MFA factors → verified TOTP factor found?
    → YES → setMfaFactorId + setMode('mfa-challenge')
    → NO  → navigate('/trade')
```

### handleLogin becomes minimal:
```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  try {
    const { error } = await signIn(email, password);
    if (error) throw error;
    // useEffect takes over from here
  } catch (error: any) {
    toast({ title: 'Error', description: error.message, variant: 'destructive' });
    setLoading(false);
  }
  // NOTE: do NOT call setLoading(false) on success — component unmounts on navigation
};
```

### handleMFASuccess navigates directly:
```typescript
const handleMFASuccess = () => {
  if (rememberMe) setRemembered();
  navigate('/trade', { replace: true }); // Direct — no mode flip needed
};
```

This removes the fragile "flip to login to re-trigger useEffect" pattern.

## Files to Change

### 1. `src/pages/Auth.tsx`

- **useEffect**: Expand `checkVerification` to also run the `isRemembered()` check and MFA factor check before navigating to `/trade`
- **handleLogin**: Remove `await checkMFAAndProceed()` — just call `signIn` and handle errors
- **handleMFASuccess**: Change from `setMode('login')` to `navigate('/trade', { replace: true })`
- **Remove `checkMFAAndProceed`**: This function is no longer needed as a standalone — its logic moves into the `useEffect`
- **Update label**: "Remember me for 1 hour" — clarify it means auto-login after completing MFA once

### 2. `src/components/auth/MFAChallenge.tsx`

- Update the `CardDescription` text to: "Open your authenticator app (e.g. Google Authenticator or Authy) and enter the 6-digit code shown for this account."
- Add a small helper note below the input: "Codes refresh every 30 seconds — if it fails, wait for the next one."
- Change the cancel button label from "Use a different method" to "Cancel sign in" since TOTP is the only MFA method

## Technical Detail: Why the useEffect Guard Still Works

The guard `if (mode === 'mfa-challenge') return` at line 62 stays in place. This prevents the effect from firing again while the challenge screen is showing. Once `handleMFASuccess` calls `navigate('/trade')`, the component unmounts entirely — so there's no risk of the effect re-running after MFA succeeds.

The dependency array stays as `[user, authLoading, navigate, justSignedOut, mode]` — no changes needed there.

## Summary of Behavior After the Fix

| Scenario | Before | After |
|---|---|---|
| Fresh login with MFA enabled | MFA shown | MFA shown |
| Page refresh while logged in | MFA skipped | MFA shown |
| Revisit /auth while session active | MFA skipped | MFA shown |
| Remember Me checked, within 1 hour | MFA still shown | Auto-navigates to /trade |
| Remember Me expired (>1 hour) | MFA still shown | MFA shown |
| No MFA factor enrolled | No challenge | No challenge |
