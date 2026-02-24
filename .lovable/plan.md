

## Plan: Explorable Landing Page with Public Navigation

### What changes

The landing page will get the main navigation bar between the hero and community sections, and key browsing routes will become publicly accessible. Actions like trading, posting, or managing portfolios will still require login.

### Changes

**1. Add MainNav to the landing page (`src/pages/Index.tsx`)**
- Insert `<MainNav />` between the hero section and the community feed section (right after the `border-b` divider)
- This gives visitors immediate access to explore Trade, Community, etc.

**2. Make browsing routes public (`src/App.tsx`)**
- Remove `<ProtectedRoute>` wrapper from these routes:
  - `/trade` — stock explorer, search, movers
  - `/trade/stocks/:symbol` — individual stock detail pages
  - `/community` — community feed and models
- Keep `<ProtectedRoute>` on action-oriented routes:
  - `/trade/portfolio`, `/trade/orders`, `/trade/ai-builder`
  - `/settings/brokerage`, `/profile`, `/profile/:userId`
  - `/alpha`, `/models/new`, `/models/:id`
  - `/trade/stocks/:symbol/automate`

**3. No changes needed to Trade.tsx or Community.tsx**
- Trade already shows "Sign in to create a watchlist" for guests and hides portfolio/order sections behind `{user && ...}` checks
- Community already shows "Sign in to post" prompts and hides the create-post box for unauthenticated users
- StockDetail will need a quick check — any trade actions should prompt login

**4. Handle auto-redirect on Index.tsx**
- Keep the existing `useEffect` that redirects authenticated users to `/trade` — logged-in users skip the landing page as before

### Technical detail

The `MainNav` component already handles the unauthenticated state — it shows a "Sign In" button instead of the avatar dropdown. The nav links (Trade, Portfolio, Orders, Community, Settings) will be visible. Portfolio, Orders, and Settings still route through `ProtectedRoute`, so clicking them will redirect to `/auth`. Trade and Community will load directly.

