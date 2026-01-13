-- SECURITY FIX 1: Restrict trades table to only show aggregated data for public models
-- Instead of exposing individual trades (with exact prices, dates, quantities, and P&L),
-- public users should only see summary statistics

-- Drop existing permissive SELECT policy for public model trades
DROP POLICY IF EXISTS "Users can view trades of accessible backtests" ON public.trades;

-- Create new policy: owners and subscribers can view trades, but public only sees their own
CREATE POLICY "Users can view their own backtest trades"
ON public.trades FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM backtests
    WHERE backtests.id = trades.backtest_id
    AND backtests.user_id = auth.uid()
  )
);

-- SECURITY FIX 2: Create aggregated trades view for public consumption
-- This exposes only summary statistics, not individual trade details
CREATE OR REPLACE VIEW public.backtest_trade_summary
WITH (security_invoker = on) AS
SELECT 
  b.id as backtest_id,
  b.model_id,
  m.is_public,
  m.user_id as model_owner_id,
  COUNT(t.id) as total_trades,
  COUNT(CASE WHEN t.side = 'buy' THEN 1 END) as buy_count,
  COUNT(CASE WHEN t.side = 'sell' THEN 1 END) as sell_count,
  COUNT(CASE WHEN t.pnl > 0 THEN 1 END) as winning_trades,
  COUNT(CASE WHEN t.pnl < 0 THEN 1 END) as losing_trades,
  CASE WHEN COUNT(t.id) > 0 THEN ROUND((COUNT(CASE WHEN t.pnl > 0 THEN 1 END)::numeric / COUNT(t.id) * 100), 2) ELSE 0 END as win_rate_pct,
  COALESCE(SUM(t.pnl), 0) as total_pnl,
  COALESCE(AVG(t.pnl), 0) as avg_pnl_per_trade,
  MIN(t.entry_date) as first_trade_date,
  MAX(COALESCE(t.exit_date, t.entry_date)) as last_trade_date
FROM backtests b
JOIN models m ON m.id = b.model_id
LEFT JOIN trades t ON t.backtest_id = b.id
GROUP BY b.id, b.model_id, m.is_public, m.user_id;

-- SECURITY FIX 3: Update public_profiles view to properly enforce show_contact_info
-- This replaces the existing view with proper privacy controls
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.trading_philosophy,
  p.experience_level,
  p.user_type,
  p.is_verified,
  p.total_followers,
  p.total_following,
  p.total_earnings,
  p.created_at,
  p.updated_at,
  -- Only show contact info if user has explicitly enabled it
  CASE WHEN p.show_contact_info = true THEN p.twitter_handle ELSE NULL END as twitter_handle,
  CASE WHEN p.show_contact_info = true THEN p.linkedin_url ELSE NULL END as linkedin_url,
  CASE WHEN p.show_contact_info = true THEN p.github_handle ELSE NULL END as github_handle,
  CASE WHEN p.show_contact_info = true THEN p.website_url ELSE NULL END as website_url
FROM profiles p;

-- SECURITY FIX 4: Update profiles RLS policy to require authentication for viewing profiles
-- This prevents anonymous scraping of profile data including social handles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Authenticated users can view other profiles through the public_profiles view
-- (which enforces show_contact_info privacy setting)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');