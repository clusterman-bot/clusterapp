
## Alpha-Only Instagram Marketing Bot — Implementation Plan

### What gets built

A fully automated Instagram marketing bot, accessible only to Alpha accounts, living inside a new "Marketing Bot" tab on the existing Alpha Dashboard (`/alpha`). You configure a timer, connect your Instagram account once, and the bot runs automatically — taking screenshots of the live website, using AI to write captions, and posting Instagram carousels on schedule.

---

### One-time setup steps (you do these, not us)

**A. Browserless.io (for screenshots)**
1. Sign up free at [browserless.io](https://browserless.io)
2. Copy your API key — you paste it into the Alpha Dashboard

**B. Meta / Instagram (for posting)**
1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business type
2. Add "Instagram Graph API" product
3. Connect your Instagram Business account
4. In the Graph API Explorer, generate a User Token with scopes: `instagram_basic`, `instagram_content_publish`
5. Exchange it for a long-lived token (60-day expiry):
   `GET https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-token}`
6. Get your Instagram Business Account ID:
   `GET https://graph.facebook.com/{page-id}?fields=instagram_business_account&access_token={token}`
7. Paste the Account ID and long-lived token into the Alpha Dashboard UI

---

### Architecture

```text
Alpha Dashboard (/alpha) → "Marketing Bot" tab (3rd tab)
        │
        ▼
marketing_bot_config table  ← settings + encrypted IG token
        │
Hourly pg_cron job
        │
        ▼
instagram-marketing-bot edge function
  ├── Browserless API  → screenshots (JPEG)
  ├── Upload to Storage bucket → public URLs
  ├── Lovable AI (Gemini Flash) → AI caption + hashtags
  ├── Instagram Graph API → create carousel → publish
  └── Write to marketing_bot_logs
        │
        ▼
Alpha Dashboard → Logs subtab (auto-refreshes every 30s)
```

---

### Database — 2 new tables + 1 storage bucket

**`marketing_bot_config`** (one row per Alpha user, unique on `user_id`)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `id` | uuid | gen_random_uuid() | PK |
| `user_id` | uuid | — | Alpha owner |
| `is_active` | boolean | false | Master on/off |
| `interval_hours` | integer | 24 | Post frequency (1–168 hrs) |
| `pages_to_capture` | jsonb | `["/trade","/community"]` | Pages to screenshot |
| `instagram_account_id` | text | null | IG Business Account ID |
| `ig_access_token_encrypted` | text | null | AES-256-GCM encrypted token |
| `caption_template` | text | null | Optional caption prefix |
| `last_posted_at` | timestamptz | null | Last successful post |
| `next_post_at` | timestamptz | null | When next post fires |

RLS: `auth.uid() = user_id` — owner-only read/write.

**`marketing_bot_logs`** (one row per posting attempt)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `id` | uuid | gen_random_uuid() | PK |
| `user_id` | uuid | — | Owner |
| `status` | text | — | `'success'` or `'error'` |
| `instagram_post_id` | text | null | IG post ID on success |
| `caption` | text | null | AI caption used |
| `pages_captured` | jsonb | `[]` | Pages screenshotted |
| `error_message` | text | null | Error detail |

RLS: `auth.uid() = user_id` — owner SELECT only.

**Storage bucket: `marketing-assets`** — public, so Instagram's servers can fetch screenshot URLs directly.

---

### Secrets

One new backend secret: **`BROWSERLESS_API_KEY`**.

The Instagram access token is stored per-config in the database, encrypted with the existing `ENCRYPTION_SECRET` using AES-256-GCM (same pattern already used for brokerage keys). Never exposed to the client.

---

### Edge function: `instagram-marketing-bot`

Handles both cron-triggered (hourly auto-check) and manual ("Post Now") triggers.

**Processing flow:**
1. Fetch configs where `is_active = true AND next_post_at <= now()` (or a specific `config_id` for manual)
2. Decrypt IG token using `ENCRYPTION_SECRET`
3. For each page: call Browserless → JPEG → upload to `marketing-assets` → get public URL
4. Call Lovable AI (Gemini 3 Flash) → generate caption + hashtags
5. For each image: `POST /{ig_account_id}/media` → get container ID
6. Create carousel container: `POST /{ig_account_id}/media` with `media_type=CAROUSEL`
7. Publish: `POST /{ig_account_id}/media_publish`
8. Update `last_posted_at` and `next_post_at = now() + interval_hours`
9. Insert row into `marketing_bot_logs`

---

### Cron job

pg_cron fires every hour. The function checks `next_post_at <= now()` so it only posts when actually due:

```sql
SELECT cron.schedule(
  'instagram-marketing-bot-hourly', '0 * * * *',
  $$ SELECT net.http_post(
    url := 'https://pfszkghqoxybhbaouliw.supabase.co/functions/v1/instagram-marketing-bot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
```

---

### UI in Alpha Dashboard — new "Marketing Bot" tab

**Config card**
- Toggle: Bot Active
- Number: "Post every N hours" (1–168)
- Checkboxes: Pages to capture (`/trade`, `/community`, `/models/new`)
- Input: Instagram Business Account ID
- Password input: Instagram Long-Lived Access Token (stored encrypted)
- Textarea: Caption prefix (optional)
- Save + "Post Now" buttons

**Status card** — Last posted, Next scheduled, Active/Paused badge

**Logs table** — Last 20 rows, auto-refreshes every 30s: Timestamp | Status | Pages | Post ID | Error

---

### Files changed

| File | Action |
|---|---|
| `supabase/migrations/..._marketing_bot.sql` | Create — tables + RLS + storage bucket |
| `supabase/functions/instagram-marketing-bot/index.ts` | Create — full engine |
| `supabase/config.toml` | Edit — add function entry |
| `src/hooks/useMarketingBot.tsx` | Create — React Query hooks |
| `src/pages/AlphaDashboard.tsx` | Edit — add "Marketing Bot" as 3rd tab |

No routing changes — everything lives inside the existing `/alpha` page which already guards non-Alpha users.
