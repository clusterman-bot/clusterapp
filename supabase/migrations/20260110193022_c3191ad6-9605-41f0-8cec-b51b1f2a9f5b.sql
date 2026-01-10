-- Create enum for order types
CREATE TYPE public.order_type AS ENUM ('market', 'limit', 'stop_loss', 'recurring');

-- Create enum for order status
CREATE TYPE public.order_status AS ENUM ('pending', 'executed', 'cancelled', 'failed');

-- Create enum for order side (buy/sell)
CREATE TYPE public.order_side AS ENUM ('buy', 'sell');

-- Stocks table - available stocks to trade
CREATE TABLE public.stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT,
  current_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  previous_close NUMERIC(12, 2),
  day_high NUMERIC(12, 2),
  day_low NUMERIC(12, 2),
  volume BIGINT DEFAULT 0,
  market_cap BIGINT,
  logo_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User portfolio holdings
CREATE TABLE public.holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  quantity NUMERIC(12, 6) NOT NULL DEFAULT 0,
  average_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, stock_id)
);

-- User watchlist
CREATE TABLE public.watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, stock_id)
);

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  order_type order_type NOT NULL DEFAULT 'market',
  order_side order_side NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  quantity NUMERIC(12, 6) NOT NULL,
  price NUMERIC(12, 2),
  limit_price NUMERIC(12, 2),
  stop_price NUMERIC(12, 2),
  executed_price NUMERIC(12, 2),
  executed_at TIMESTAMP WITH TIME ZONE,
  recurring_interval TEXT, -- 'daily', 'weekly', 'monthly'
  next_execution_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User cash balance for trading
CREATE TABLE public.user_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  cash_balance NUMERIC(14, 2) NOT NULL DEFAULT 10000.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

-- Stocks are public to read
CREATE POLICY "Anyone can view stocks" ON public.stocks FOR SELECT USING (true);

-- Holdings policies
CREATE POLICY "Users can view their own holdings" ON public.holdings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own holdings" ON public.holdings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own holdings" ON public.holdings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own holdings" ON public.holdings FOR DELETE USING (auth.uid() = user_id);

-- Watchlist policies
CREATE POLICY "Users can view their own watchlist" ON public.watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to their own watchlist" ON public.watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from their own watchlist" ON public.watchlist FOR DELETE USING (auth.uid() = user_id);

-- Orders policies
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);

-- Balance policies
CREATE POLICY "Users can view their own balance" ON public.user_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own balance" ON public.user_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own balance" ON public.user_balances FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_holdings_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_balances_updated_at BEFORE UPDATE ON public.user_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample stocks for the prototype
INSERT INTO public.stocks (symbol, name, sector, current_price, previous_close, day_high, day_low, volume, market_cap) VALUES
('AAPL', 'Apple Inc.', 'Technology', 178.72, 176.55, 179.89, 175.01, 52436789, 2800000000000),
('GOOGL', 'Alphabet Inc.', 'Technology', 141.80, 140.25, 143.50, 139.80, 23456789, 1780000000000),
('MSFT', 'Microsoft Corporation', 'Technology', 378.91, 375.28, 380.50, 374.00, 18234567, 2810000000000),
('AMZN', 'Amazon.com Inc.', 'Consumer Cyclical', 178.25, 176.80, 180.00, 175.50, 35678901, 1850000000000),
('TSLA', 'Tesla Inc.', 'Automotive', 248.50, 245.30, 252.00, 243.00, 98765432, 790000000000),
('NVDA', 'NVIDIA Corporation', 'Technology', 495.22, 488.50, 498.00, 485.00, 45678123, 1220000000000),
('META', 'Meta Platforms Inc.', 'Technology', 505.95, 502.10, 510.00, 498.50, 12345678, 1290000000000),
('JPM', 'JPMorgan Chase & Co.', 'Financial Services', 196.52, 194.80, 198.00, 193.50, 8765432, 567000000000),
('V', 'Visa Inc.', 'Financial Services', 279.80, 277.50, 282.00, 276.00, 5432109, 573000000000),
('JNJ', 'Johnson & Johnson', 'Healthcare', 156.42, 155.20, 157.50, 154.80, 6543210, 378000000000),
('WMT', 'Walmart Inc.', 'Consumer Defensive', 165.28, 163.90, 166.50, 163.00, 7654321, 446000000000),
('PG', 'Procter & Gamble Co.', 'Consumer Defensive', 158.95, 157.80, 160.00, 156.50, 5432100, 374000000000),
('XOM', 'Exxon Mobil Corporation', 'Energy', 104.56, 103.20, 106.00, 102.50, 14567890, 417000000000),
('DIS', 'The Walt Disney Company', 'Communication Services', 111.25, 109.80, 113.00, 108.50, 9876543, 203000000000),
('NFLX', 'Netflix Inc.', 'Communication Services', 628.50, 622.30, 635.00, 618.00, 3456789, 275000000000);