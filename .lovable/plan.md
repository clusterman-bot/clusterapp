

## Fix: Marketing Bot Token Encryption

### The Problem

When you save your Instagram access token, the UI calls the edge function with `{ action: 'encrypt_token', token: '...' }`. But the edge function **has no handler for this action** -- it only handles posting logic. So the encrypt call returns a generic response without an `encrypted` field, the token is silently discarded, and every bot run fails because `ig_access_token_encrypted` is null in the database.

### The Fix

**File: `supabase/functions/instagram-marketing-bot/index.ts`**

Add an `action` handler right after parsing the request body (before the main posting logic):

1. Parse `action` from the request body alongside `config_id` and `manual`
2. If `action === 'encrypt_token'`:
   - Read the `token` field from the body
   - Call the existing `encryptToken()` function with the token and `ENCRYPTION_SECRET`
   - Return `{ encrypted: "<encrypted_value>" }` immediately
   - Skip all the posting logic
3. Otherwise, continue with the existing bot posting flow as-is

### Technical Detail

```text
Request body parsing currently:
  { config_id?, manual? }

Updated to also check:
  { action?, token?, config_id?, manual? }

New early-return branch:
  if action === "encrypt_token" AND token is provided:
    -> encrypt using existing encryptToken() helper
    -> return { encrypted: "..." }
```

Also set `next_post_at` when saving a new config so the cron job can pick it up. Currently `next_post_at` stays null because the save mutation doesn't set it -- add it to the upsert in `useMarketingBot.tsx`.

### Files to Modify

| File | Change |
|---|---|
| `supabase/functions/instagram-marketing-bot/index.ts` | Add `encrypt_token` action handler before main logic |
| `src/hooks/useMarketingBot.tsx` | Set `next_post_at` in the upsert so cron picks up the config |

No database changes needed.

