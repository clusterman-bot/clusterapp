
# Three Bug Fixes: Login Freeze, MFA Bypass, Subscription Gate

## Bug 1: Login Freeze for Non-MFA Users

### Root Cause
In `proceed()` (Auth.tsx line 76-87), the code fetches `email_verified` from the `profiles` table. If the column is `null` or the query fails, the logic treats it as "not verified" and sends the user to the verify-email screen — or the catch block resets `proceedingRef.current` and nothing re-triggers it. The user is frozen.

The fix has two parts:
1. Only block on email verification if `email_verified === false` explicitly (not just falsy/null)
2. Wrap the DB call more defensively so a missing profile row doesn't block login

### Fix in `src/pages/Auth.tsx`
Change line 82 from:
```typescript
if (!profile?.email_verified) {
```
To:
```typescript
if (profile?.email_verified === false) {
```
This means: only redirect to verify-email if the field is explicitly `false`. If the profile row doesn't exist or the field is null, let the user through.

---

## Bug 2: MFA Bypass via Direct Navigation

### Root Cause
The app has no route-level protection. `supabase.auth.signIn()` immediately creates a valid session token. The MFA challenge in `Auth.tsx` is purely a UI screen — if the user types `/trade` in the address bar or navigates to any other route after password login but before completing the MFA code entry, they get in with no MFA verification at all.

### Fix: Protected Route Wrapper
Create `src/components/ProtectedRoute.tsx` — a wrapper that:
1. Checks `authLoading` — shows a spinner while loading
2. If no `user` — redirects to `/auth`
3. Checks `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` — if the user has a verified TOTP factor (`nextLevel === 'aal2'`) but `currentLevel` is only `'aal1'`, they have NOT completed MFA yet → redirect back to `/auth` (which will re-show the MFA challenge screen since `user` is set and a verified factor exists)

Wrap all protected routes in `App.tsx` with this component. The public routes (`/auth`, `/verify-email`, `/reset-password`, `/privacy`, `/terms`, `/faq`, `/sms-consent`) remain unwrapped.

### Updated `src/App.tsx`
```tsx
<Route path="/trade" element={<ProtectedRoute><Trade /></ProtectedRoute>} />
<Route path="/trade/stocks/:symbol" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
// ... all other private routes wrapped
```

### New `src/components/ProtectedRoute.tsx`
```tsx
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [mfaChecking, setMfaChecking] = useState(true);
  const [mfaPassed, setMfaPassed] = useState(false);

  useEffect(() => {
    if (!user) { setMfaChecking(false); return; }
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      // If user has MFA enrolled but hasn't completed it (aal1 but needs aal2)
      if (data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2') {
        setMfaPassed(false);
      } else {
        setMfaPassed(true);
      }
      setMfaChecking(false);
    });
  }, [user]);

  if (loading || mfaChecking) return <Loader2 spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!mfaPassed) return <Navigate to="/auth" replace />;
  return children;
}
```

---

## Bug 3: Subscription Allowed Without Brokerage Account

### Root Cause
`ModelSubscribeButton.tsx` `handleClick()` opens a confirm dialog with no checks. The subscription inserts into the DB but the actual trade execution via Alpaca will fail silently since there's no linked brokerage account.

### Fix in `src/components/ModelSubscribeButton.tsx`
Before opening the confirm dialog, check if the user has an active brokerage account using the existing `useBrokerageAccounts()` hook. If none, show a different dialog prompting them to link one first with a button to `/settings/brokerage`.

```typescript
import { useBrokerageAccounts } from '@/hooks/useBrokerageAccounts';

// Inside component:
const { data: brokerageAccounts } = useBrokerageAccounts();
const [showNoBrokerageDialog, setShowNoBrokerageDialog] = useState(false);

const handleClick = () => {
  if (!user) { navigate('/auth'); return; }
  if (isSubscribed) { setShowUnsubscribeDialog(true); return; }
  
  const hasActiveBrokerage = brokerageAccounts?.some(a => a.is_active);
  if (!hasActiveBrokerage) {
    setShowNoBrokerageDialog(true); // Show "link a brokerage first" dialog
    return;
  }
  setShowConfirmDialog(true);
};
```

The "no brokerage" dialog will say: *"You need to connect a brokerage account before subscribing to models. Model trades are mirrored automatically through your connected Alpaca account."* with a **Connect Brokerage** button that navigates to `/settings/brokerage`.

---

## Files Changed

1. **`src/pages/Auth.tsx`** — Fix the `email_verified` falsy check (1 line change)
2. **`src/components/ProtectedRoute.tsx`** — New file: MFA-aware route guard
3. **`src/App.tsx`** — Wrap all private routes with `<ProtectedRoute>`
4. **`src/components/ModelSubscribeButton.tsx`** — Add brokerage account check + "no brokerage" dialog
