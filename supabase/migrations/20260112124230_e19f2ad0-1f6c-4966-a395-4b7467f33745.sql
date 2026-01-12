-- Fix overly permissive RLS policies on market_data_cache
-- Drop the permissive policies
DROP POLICY IF EXISTS "Service role can insert market data" ON public.market_data_cache;
DROP POLICY IF EXISTS "Service role can update market data" ON public.market_data_cache;

-- The cache table will be written by edge functions using service role key
-- No user-level insert/update policies needed since edge functions bypass RLS with service role