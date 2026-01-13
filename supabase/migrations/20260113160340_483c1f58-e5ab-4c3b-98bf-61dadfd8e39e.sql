-- Ensure user_brokerage_accounts has strict RLS - users can ONLY see their own records
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own brokerage accounts" ON public.user_brokerage_accounts;
DROP POLICY IF EXISTS "Users can insert their own brokerage accounts" ON public.user_brokerage_accounts;
DROP POLICY IF EXISTS "Users can update their own brokerage accounts" ON public.user_brokerage_accounts;
DROP POLICY IF EXISTS "Users can delete their own brokerage accounts" ON public.user_brokerage_accounts;

-- Create strict RLS policies for brokerage accounts
CREATE POLICY "Users can only view their own brokerage accounts"
ON public.user_brokerage_accounts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own brokerage accounts"
ON public.user_brokerage_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own brokerage accounts"
ON public.user_brokerage_accounts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own brokerage accounts"
ON public.user_brokerage_accounts
FOR DELETE
USING (auth.uid() = user_id);

-- Add RLS policies for backtest_trade_summary view
DROP POLICY IF EXISTS "Model owners can view their backtest summaries" ON public.backtest_trade_summary;

-- Note: backtest_trade_summary is a view - policies may need to be on underlying tables instead