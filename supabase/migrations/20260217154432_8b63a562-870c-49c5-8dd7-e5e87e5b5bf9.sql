
-- Table: stock_automations
CREATE TABLE public.stock_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  is_active boolean DEFAULT true,
  indicators jsonb NOT NULL DEFAULT '{
    "rsi": {"enabled": false, "periods": [14]},
    "sma": {"enabled": false, "windows": [5, 20]},
    "ema": {"enabled": false, "windows": [5, 20]},
    "bollinger": {"enabled": false, "window": 20, "std": 2},
    "sma_deviation": {"enabled": false, "window": 20}
  }',
  rsi_oversold numeric DEFAULT 30,
  rsi_overbought numeric DEFAULT 70,
  horizon_minutes integer DEFAULT 5,
  theta numeric DEFAULT 0.01,
  position_size_percent numeric DEFAULT 10,
  max_quantity integer DEFAULT 10,
  stop_loss_percent numeric DEFAULT 5,
  take_profit_percent numeric DEFAULT 15,
  last_checked_at timestamptz,
  last_signal_at timestamptz,
  total_signals integer DEFAULT 0,
  total_trades integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, symbol)
);

ALTER TABLE public.stock_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automations"
  ON public.stock_automations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_stock_automations_updated_at
  BEFORE UPDATE ON public.stock_automations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table: automation_signals
CREATE TABLE public.automation_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.stock_automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  signal_type text NOT NULL,
  confidence numeric,
  price_at_signal numeric,
  indicator_snapshot jsonb,
  trade_executed boolean DEFAULT false,
  alpaca_order_id text,
  executed_price numeric,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.automation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own signals"
  ON public.automation_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts signals"
  ON public.automation_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
