-- Create table for user brokerage accounts with encrypted storage
CREATE TABLE public.user_brokerage_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL DEFAULT 'alpaca',
  account_type TEXT NOT NULL CHECK (account_type IN ('paper', 'live')),
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  account_id TEXT,
  account_status TEXT,
  is_active BOOLEAN DEFAULT true,
  daily_trade_limit NUMERIC DEFAULT 10000,
  per_trade_limit NUMERIC DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, broker_name, account_type)
);

-- Create table for trading activity logs (audit trail)
CREATE TABLE public.trading_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brokerage_account_id UUID REFERENCES public.user_brokerage_accounts(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  symbol TEXT,
  quantity NUMERIC,
  side TEXT,
  order_type TEXT,
  status TEXT,
  amount NUMERIC,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_brokerage_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for brokerage accounts
CREATE POLICY "Users can view their own brokerage accounts"
  ON public.user_brokerage_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brokerage accounts"
  ON public.user_brokerage_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brokerage accounts"
  ON public.user_brokerage_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brokerage accounts"
  ON public.user_brokerage_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for activity logs (users can only view their own)
CREATE POLICY "Users can view their own activity logs"
  ON public.trading_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity logs"
  ON public.trading_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_brokerage_accounts_user ON public.user_brokerage_accounts(user_id);
CREATE INDEX idx_brokerage_accounts_active ON public.user_brokerage_accounts(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_activity_logs_user ON public.trading_activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON public.trading_activity_logs(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_brokerage_accounts_updated_at
  BEFORE UPDATE ON public.user_brokerage_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();