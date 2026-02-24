
-- Create crypto_assets table (mirrors stocks)
CREATE TABLE public.crypto_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  current_price NUMERIC NOT NULL DEFAULT 0,
  previous_close NUMERIC,
  day_high NUMERIC,
  day_low NUMERIC,
  volume BIGINT DEFAULT 0,
  market_cap BIGINT,
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crypto_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crypto assets"
  ON public.crypto_assets FOR SELECT
  USING (true);

-- Create crypto_holdings table (mirrors holdings)
CREATE TABLE public.crypto_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crypto_asset_id UUID NOT NULL REFERENCES public.crypto_assets(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  average_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crypto_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own crypto holdings"
  ON public.crypto_holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own crypto holdings"
  ON public.crypto_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own crypto holdings"
  ON public.crypto_holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own crypto holdings"
  ON public.crypto_holdings FOR DELETE USING (auth.uid() = user_id);

-- Create order enums for crypto
CREATE TYPE public.crypto_order_type AS ENUM ('market', 'limit', 'stop_loss');
CREATE TYPE public.crypto_order_side AS ENUM ('buy', 'sell');
CREATE TYPE public.crypto_order_status AS ENUM ('pending', 'executed', 'cancelled', 'failed');

-- Create crypto_orders table (mirrors orders)
CREATE TABLE public.crypto_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crypto_asset_id UUID NOT NULL REFERENCES public.crypto_assets(id),
  order_type public.crypto_order_type NOT NULL DEFAULT 'market',
  order_side public.crypto_order_side NOT NULL,
  status public.crypto_order_status NOT NULL DEFAULT 'pending',
  quantity NUMERIC NOT NULL,
  price NUMERIC,
  limit_price NUMERIC,
  stop_price NUMERIC,
  executed_price NUMERIC,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crypto_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own crypto orders"
  ON public.crypto_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own crypto orders"
  ON public.crypto_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own crypto orders"
  ON public.crypto_orders FOR UPDATE USING (auth.uid() = user_id);

-- Create crypto_watchlist table (mirrors watchlist)
CREATE TABLE public.crypto_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  crypto_asset_id UUID NOT NULL REFERENCES public.crypto_assets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, crypto_asset_id)
);

ALTER TABLE public.crypto_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own crypto watchlist"
  ON public.crypto_watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to their own crypto watchlist"
  ON public.crypto_watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from their own crypto watchlist"
  ON public.crypto_watchlist FOR DELETE USING (auth.uid() = user_id);

-- Seed popular crypto assets
INSERT INTO public.crypto_assets (symbol, name, current_price) VALUES
  ('BTC/USD', 'Bitcoin', 0),
  ('ETH/USD', 'Ethereum', 0),
  ('SOL/USD', 'Solana', 0),
  ('DOGE/USD', 'Dogecoin', 0),
  ('ADA/USD', 'Cardano', 0),
  ('XRP/USD', 'XRP', 0),
  ('DOT/USD', 'Polkadot', 0),
  ('AVAX/USD', 'Avalanche', 0),
  ('MATIC/USD', 'Polygon', 0),
  ('LINK/USD', 'Chainlink', 0),
  ('LTC/USD', 'Litecoin', 0),
  ('UNI/USD', 'Uniswap', 0),
  ('SHIB/USD', 'Shiba Inu', 0),
  ('AAVE/USD', 'Aave', 0),
  ('BCH/USD', 'Bitcoin Cash', 0);

-- Add updated_at triggers
CREATE TRIGGER update_crypto_holdings_updated_at
  BEFORE UPDATE ON public.crypto_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crypto_orders_updated_at
  BEFORE UPDATE ON public.crypto_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
