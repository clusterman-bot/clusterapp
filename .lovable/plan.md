

# Custom Email Verification via Resend

Replace the default `@auth.lovable.cloud` verification emails with branded emails sent from `seif@clusterapp.space` using Resend.

## Approach

Instead of relying on the built-in auth email, we'll:
1. Disable the default confirmation email by enabling auto-confirm on signup
2. Mark users as "unverified" in a custom field until they click our custom verification link
3. Send a branded verification email via Resend from a new edge function
4. Create a verification callback page that confirms the user's email

## What Gets Built

### 1. New Edge Function: `send-verification-email`
- Called after signup with the user's email and a signed verification token
- Uses Resend API to send a branded HTML email from `seif@clusterapp.space`
- The email contains a verification link pointing to `/verify-email?token=...`
- Token is a JWT-like signed value (using HMAC with a secret) containing the user ID and expiry

### 2. New Edge Function: `verify-email-token`
- Called when user clicks the verification link
- Validates the token, checks expiry
- Updates the user's profile to mark `email_verified = true`
- Returns success/failure status

### 3. Database Changes
- Add `email_verified` boolean column (default `false`) to the `profiles` table
- This acts as our custom verification flag since we'll auto-confirm at the auth level

### 4. Auth Config Change
- Enable auto-confirm for email signups (so users can log in immediately but with limited access)
- The custom `email_verified` flag on profiles controls actual verification status

### 5. Frontend Changes

**`src/hooks/useAuth.tsx`**
- After successful signup, call the `send-verification-email` edge function
- Pass the user's email and ID

**`src/pages/Auth.tsx`**
- Keep the existing "Check your email" verification screen as-is (it already looks great)
- Update the flow so it triggers our custom email instead of relying on the built-in one

**New page: `src/pages/VerifyEmail.tsx`**
- Handles the `/verify-email?token=...` route
- Calls the `verify-email-token` edge function
- Shows success/error state
- Redirects to `/trade` on success

**`src/App.tsx`**
- Add `/verify-email` route

### 6. Access Control
- Update protected routes/components to check `profiles.email_verified` instead of `user.email_confirmed_at`
- Users can log in but see a "Please verify your email" banner until verified

## Secret Needed
- **RESEND_API_KEY** -- Your Resend API key (we'll ask you to provide this before building)

## Technical Details

### Verification Token Flow
1. On signup, generate a random token, store a hash in the `profiles` table (`verification_token` column, `verification_token_expires_at`)
2. Send email with link: `https://clusterapp.lovable.app/verify-email?token=<token>&uid=<user_id>`
3. On click, edge function validates token against stored hash and checks expiry (24 hours)
4. On success, set `email_verified = true` and clear the token

### Email Template
- Clean, branded HTML email
- "From: Cluster <seif@clusterapp.space>"
- Subject: "Verify your Cluster account"
- Contains a prominent "Verify Email" button linking to the verification page

### Files to Create/Edit
- `supabase/functions/send-verification-email/index.ts` (new)
- `supabase/functions/verify-email-token/index.ts` (new)
- `src/pages/VerifyEmail.tsx` (new)
- `src/hooks/useAuth.tsx` (edit signup flow)
- `src/pages/Auth.tsx` (update verification check)
- `src/App.tsx` (add route)
- `supabase/config.toml` (add function entries)
- Database migration: add `email_verified`, `verification_token`, `verification_token_expires_at` to profiles
