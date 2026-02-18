
# Implement AAL2 Session Step-Up for Sensitive Actions

## What is AAL2 and Why It Matters

Authentication Assurance Level 2 (AAL2) is Supabase's way of saying "the user has proven their identity a second time this session." It is only required when a user has MFA enabled. A normal password login gives you AAL1. Once you complete an MFA challenge, your session is upgraded to AAL2.

Supabase enforces AAL2 server-side for sensitive actions like changing your email or password, and removing MFA. This cannot be bypassed — it is a security guarantee from the server.

The correct, user-friendly solution is a **"step-up" flow**: when the user clicks "Update Email" (or removes MFA), the app checks if AAL2 is needed, prompts the user for their MFA code in a small inline dialog, and then proceeds once they verify. The user only sees this if they have MFA enabled.

## Flow Diagram

```text
User clicks "Update Email"
        |
        v
Check current AAL level
        |
   AAL2 already?         AAL2 not required?
      |                        |
      v                        v
Proceed directly          Check for enrolled MFA factor
                                |
                    Factor found?      No factor?
                         |                  |
                         v                  v
              Show MFA challenge       Proceed directly
              dialog (step-up)
                         |
                   User enters code
                         |
                   Session upgraded
                         |
                         v
                   Proceed with action
```

## Implementation Plan

### 1. Create a reusable `MFAStepUpDialog` component (`src/components/auth/MFAStepUpDialog.tsx`)

A small, focused dialog that:
- Takes a title, description, and `onVerified` callback as props
- Calls `supabase.auth.mfa.challenge()` + `supabase.auth.mfa.verify()` to upgrade the session to AAL2
- On success, calls `onVerified()` so the parent can proceed
- Has a "Cancel" button that closes without doing anything

### 2. Create a helper hook `useAAL2StepUp` (`src/components/auth/useAAL2StepUp.ts`)

A small utility that:
- Checks `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` to see the current and next AAL
- Returns: `{ needsStepUp: boolean, factorId: string | null }`
- Used by both `ChangeEmailCard` and `MFASetup` (for the "Remove" button) before executing sensitive actions

### 3. Update `ChangeEmailCard` (`src/components/auth/ChangeEmailCard.tsx`)

- On "Update Email" click, first call `useAAL2StepUp`
- If step-up is needed: show the `MFAStepUpDialog`
- The `onVerified` callback of the dialog calls the actual `supabase.auth.updateUser({ email })` to proceed
- If no step-up needed: proceed directly as before

### 4. Update `MFASetup` (`src/components/auth/MFASetup.tsx`)

- The "Remove" button for a verified MFA factor also requires AAL2
- Wrap the remove button click with the same step-up check
- Show `MFAStepUpDialog` before calling `supabase.auth.mfa.unenroll()`
- This also fixes the 422 error that was appearing in logs when trying to remove MFA

### 5. Update `ChangePasswordCard` in `Profile.tsx`

- Password changes also require AAL2 when MFA is enabled
- Apply the same step-up pattern to the "Update Password" action

## Files to Create/Modify

- **New**: `src/components/auth/MFAStepUpDialog.tsx`
- **New**: `src/hooks/useAAL2StepUp.ts`
- **Modified**: `src/components/auth/ChangeEmailCard.tsx`
- **Modified**: `src/components/auth/MFASetup.tsx`
- **Modified**: `src/pages/Profile.tsx` (the `ChangePasswordCard` function)

## User Experience

- Users **without MFA** see no change — everything works exactly as before
- Users **with MFA** see a small dialog asking for their 6-digit code when they try to change their email, change their password, or remove MFA
- The dialog is clearly labeled ("Confirm your identity") so users understand why it appears
- After verifying once, they can take multiple sensitive actions without re-verifying (the AAL2 session persists until they sign out)
