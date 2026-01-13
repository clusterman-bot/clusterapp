-- 1. For backtest_trade_summary VIEW - create a secure function to access it
-- Views cannot have RLS policies directly, so we use a security definer function
CREATE OR REPLACE FUNCTION public.get_backtest_trade_summary(p_model_id UUID DEFAULT NULL)
RETURNS TABLE (
  backtest_id UUID,
  model_id UUID,
  model_owner_id UUID,
  is_public BOOLEAN,
  total_trades BIGINT,
  buy_count BIGINT,
  sell_count BIGINT,
  winning_trades BIGINT,
  losing_trades BIGINT,
  total_pnl NUMERIC,
  avg_pnl_per_trade NUMERIC,
  win_rate_pct NUMERIC,
  first_trade_date TIMESTAMPTZ,
  last_trade_date TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    bts.backtest_id,
    bts.model_id,
    bts.model_owner_id,
    bts.is_public,
    bts.total_trades,
    bts.buy_count,
    bts.sell_count,
    bts.winning_trades,
    bts.losing_trades,
    bts.total_pnl,
    bts.avg_pnl_per_trade,
    bts.win_rate_pct,
    bts.first_trade_date,
    bts.last_trade_date
  FROM public.backtest_trade_summary bts
  WHERE 
    -- User owns the model OR model is public
    (bts.model_owner_id = auth.uid() OR bts.is_public = true)
    -- Optional filter by model_id
    AND (p_model_id IS NULL OR bts.model_id = p_model_id);
$$;

-- 2. Add audit columns for brokerage accounts
ALTER TABLE public.user_brokerage_accounts 
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Create function to log credential access
CREATE OR REPLACE FUNCTION public.log_credential_access()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create public_posts view without raw user_id
CREATE OR REPLACE VIEW public.public_posts
WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.content,
  p.post_type,
  p.model_id,
  p.likes_count,
  p.comments_count,
  p.created_at,
  p.updated_at,
  pr.id as author_profile_id,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  pr.is_verified
FROM public.posts p
LEFT JOIN public.profiles pr ON p.user_id = pr.id;

-- Update posts RLS - drop overly permissive policy
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;

-- Authenticated users can view all posts
CREATE POLICY "Authenticated users can view posts"
ON public.posts
FOR SELECT
USING (auth.role() = 'authenticated');

-- Create secure function for public/unauthenticated access to posts
CREATE OR REPLACE FUNCTION public.get_public_posts(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  content TEXT,
  post_type TEXT,
  model_id UUID,
  likes_count INTEGER,
  comments_count INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  author_profile_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.content,
    p.post_type,
    p.model_id,
    p.likes_count,
    p.comments_count,
    p.created_at,
    p.updated_at,
    pr.id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    pr.is_verified
  FROM public.posts p
  LEFT JOIN public.profiles pr ON p.user_id = pr.id
  ORDER BY p.created_at DESC
  LIMIT limit_count;
$$;