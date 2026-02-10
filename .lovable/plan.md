

# Simplify Cluster into a Pure Trading Platform

## Overview
Strip out the social/community features, profile system, developer marketplace, and multi-role system. Transform the app into a clean, focused stock trading platform (like Robinhood/Coinbase) where:
- Landing page (`/`) is login/signup (no public landing page)
- After login, users go straight to the **Trade** page
- No profiles, social feed, developer dashboards, or marketplace

---

## What Gets Removed

### Pages to remove:
- `Index.tsx` (social landing page) -- replaced with redirect to `/auth` or `/trade`
- `Feed.tsx` (social feed)
- `Profile.tsx` (user profile with posts/likes/bookmarks)
- `Dashboard.tsx` (developer dashboard)
- `RetailTraderDashboard.tsx` (trader dashboard with model subscriptions)
- `AdminDashboard.tsx` (admin panel)
- `Explore.tsx` (model marketplace)
- `ModelBuilder.tsx`, `ModelDetail.tsx`, `ModelEdit.tsx` (model creation/editing)
- `RunBacktest.tsx`, `TrainingDashboard.tsx` (ML/backtesting)
- `Onboarding.tsx` (role selection -- no longer needed)

### Components to remove:
- All social components: `SocialPostCard`, `CreatePostBox`, `CommentDialog`, `DeletePostDialog`, `PostEditDialog`, `TrendingTopics`, `WhoToFollow`, `OnlineUsers`, `UserProfileSidebar`
- All profile tab components: `ProfilePostsTab`, `ProfileLikesTab`, `ProfileBookmarksTab`, `AvatarUpload`, `SocialLinks`
- All model components: `ModelSubscribeButton`, `AllocationDialog`, `PublishToggle`, `StrategyConfig`, `TickerManager`
- All ML components: `HyperparametersConfig`, `IndicatorsConfig`, `ModelSelection`, `TrainingProgress`
- `OnboardingTour`, `CodeTerminal`, `TradingModeToggle`

### Hooks to remove:
- `useSocial`, `useBookmarksAndReposts`, `useModels`, `useModelStrategy`, `useModelTickers`, `useSubscriptions`, `useDeployedModels`, `useMLTraining`, `useBacktests`, `useSandbox`, `useAllocations`, `useUserRole`

---

## What Stays

### Pages kept:
- `Auth.tsx` -- simplified to just email/password login + signup (single role, no developer/trader choice)
- `Trade.tsx` -- the main hub after login (stock search, watchlist, portfolio summary, movers)
- `StockDetail.tsx` -- TradingView-style charts and order panel
- `Portfolio.tsx` -- portfolio holdings view
- `Orders.tsx` -- order history
- `BrokerageSettings.tsx` -- connect Alpaca account
- `NotFound.tsx`
- Legal pages: `PrivacyPolicy`, `TermsOfService`, `FAQ`, `SMSConsent`

### Hooks kept:
- `useAuth` -- authentication
- `useProfile` -- basic profile data (for avatar/name in nav)
- `useTrading` -- stocks, watchlist
- `useAlpaca` -- brokerage connection
- `useBrokerageAccounts` -- account management
- `useTradingMode` -- paper/live toggle

---

## Key Changes

### 1. Routes (`App.tsx`)
Slim down to only trading-related routes:
- `/` -- redirect: if logged in go to `/trade`, if not go to `/auth`
- `/auth` -- login/signup
- `/trade` -- main trading hub
- `/trade/stocks/:symbol` -- stock detail
- `/trade/portfolio` -- portfolio
- `/trade/orders` -- orders
- `/settings/brokerage` -- brokerage connection
- `/privacy`, `/terms`, `/faq`, `/sms-consent` -- legal pages
- `*` -- 404

### 2. Auth Page (`Auth.tsx`)
- Remove developer/trader role selection cards
- Simple login/signup form with email + password + Google OAuth
- No username requirement on signup (optional, profile auto-created by trigger)
- After login, redirect straight to `/trade`

### 3. Navigation (`MainNav.tsx`)
Simplified nav with only:
- Logo (links to `/trade`)
- **Trade** (main page)
- **Portfolio** 
- **Orders**
- **Settings** (brokerage)
- User avatar dropdown with just: Sign out
- Remove: Home, Marketplace, Dashboard, Help dropdown, Profile link, role badges

### 4. Index Page (`Index.tsx`)
Replace entirely with a simple redirect component:
- If authenticated: redirect to `/trade`
- If not: redirect to `/auth`

---

## Technical Details

### Files to modify:
1. **`src/App.tsx`** -- Remove ~15 route imports, keep only trading routes
2. **`src/pages/Index.tsx`** -- Rewrite as simple redirect (auth check -> `/trade` or `/auth`)
3. **`src/pages/Auth.tsx`** -- Simplify to single login/signup form, remove role selection, redirect to `/trade` after login
4. **`src/components/MainNav.tsx`** -- Strip down to Trade, Portfolio, Orders, Settings nav items + sign out

### Files to leave untouched (not imported anymore, can be cleaned up later):
- All social, model, profile, ML components and hooks -- they simply won't be imported or routed to, so they become dead code. No need to delete them in this pass.

### No database changes needed
- The existing tables and auth system remain unchanged
- We just stop using the role system, social features, and model marketplace in the UI

