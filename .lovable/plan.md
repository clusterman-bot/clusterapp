

# Reverse AAL2 Bypass and Fix Email Verification

## 1. Reverse the AAL2 bypass in ChangeEmailCard

The recent change wrapped `supabase.auth.updateUser()` in a try-catch that silently ignores AAL2 errors. This weakens security by allowing email changes without MFA verification.

**Fix**: Revert `ChangeEmailCard.tsx` so that `updateUser` errors are not silently swallowed. Since MFA will be disabled, the AAL2 error will no longer occur, and the straightforward error handling is sufficient.

**File**: `src/components/auth/ChangeEmailCard.tsx`
- Remove the nested try-catch that catches "aal2" errors
- Restore the simple pattern: call `updateUser`, throw on any error
- Keep the rest of the flow (mark unverified, send verification email) intact

## 2. Email delivery

The edge function is working correctly -- Resend returned `{"success": true}`. The emails are not arriving because the sending domain (`clusterapp.space`) needs to be verified in the Resend dashboard. No code changes are needed for this; it is a DNS configuration task on your end.

## Summary of code changes

Only one file is modified: `src/components/auth/ChangeEmailCard.tsx` -- revert the AAL2 bypass back to simple error propagation.

