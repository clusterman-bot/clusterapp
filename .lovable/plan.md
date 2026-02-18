
## Root Cause Analysis

There are two separate problems here, both stemming from how the email change flow was architected.

### Problem 1: The auth email (login credentials) never actually changes

`supabase.auth.updateUser({ email: newEmail })` is what changes the actual login email in Supabase Auth. However, this function requires Supabase to send its own confirmation email to the **new address** before the change takes effect. Supabase uses its own email hook for this — but the app has its own **custom email hook** registered (visible in the auth logs: `"hook": "https://api.lovable.dev/projects/.../backend/email-hook"`).

This means when `updateUser` is called, Supabase fires the email hook to send a "confirm your new email" message. Since the domain (`clusterapp.space`) has DNS issues, **that confirmation email also never arrives**. Until the user clicks that link, Supabase Auth keeps the old email as the login credential.

**The current custom verification flow only marks `email_verified: true` in the `profiles` table — it does NOT tell Supabase Auth to actually swap the email.** These are two completely separate systems.

### Problem 2: The profile UI shows the old email

The `ChangeEmailCard` shows `user?.email` from `useAuth`. After `updateUser` is called, Supabase Auth does not immediately update `user.email` in the session — it only updates after the new email confirmation link is clicked. Since that never happens, the UI keeps showing the old email.

Additionally, the `verify-email-token` edge function only updates `profiles.email_verified = true` — it never calls `supabase.auth.admin.updateUserById()` to sync the new email into the auth system.

## The Real Fix

The cleanest approach is to **completely bypass `supabase.auth.updateUser` for the email change** and instead handle everything through the custom verification flow and the admin API in the edge function. Here is the updated architecture:

```text
User enters new email → clicks "Update Email"
        |
        v
Store pending_email in profiles table (not auth)
Mark email_verified = false
Send custom verification email to NEW address
Show toast: "Check your new email to confirm the change"
        |
        v
User clicks link in email → /verify-email?token=...&uid=...
        |
        v
verify-email-token edge function:
  1. Validates token (existing logic)
  2. Calls supabase.auth.admin.updateUserById(uid, { email: newEmail })
     to swap the auth email (uses service role key - no confirmation needed)
  3. Sets email_verified = true, clears pending_email
        |
        v
Session is refreshed → user.email updates → profile shows new email
```

## Files to Change

### 1. Database migration — add `pending_email` column to `profiles`

Add a nullable `pending_email text` column to store the new email address between the time the user requests the change and the time they verify it. This is needed so the `verify-email-token` function knows what email to switch to.

### 2. `supabase/functions/send-verification-email/index.ts`

Update to also store the `pending_email` in the profiles table alongside the token.

### 3. `supabase/functions/verify-email-token/index.ts`

After validating the token, add a call to `supabase.auth.admin.updateUserById(uid, { email: profile.pending_email })` using the service role key. This actually swaps the auth credential. Then clear `pending_email` and set `email_verified = true`.

### 4. `src/components/auth/ChangeEmailCard.tsx`

Remove the call to `supabase.auth.updateUser({ email: newEmail })` entirely. Instead, just call `send-verification-email` (which now also stores `pending_email`). This avoids the need for Supabase's own email confirmation and the domain DNS issue with it.

### 5. `src/pages/VerifyEmail.tsx`

After a successful verification, call `supabase.auth.refreshSession()` so the auth context (`useAuth`) picks up the new email immediately without requiring a sign-out/sign-in.

## Summary

- The old flow: `updateUser` (triggers Supabase email, which fails) → custom email (marks profile only) → **auth email never changes**
- The new flow: skip `updateUser` entirely → store `pending_email` → custom email → edge function uses admin API to swap both auth AND profile email atomically → `refreshSession` updates the UI instantly
