-- Add model_tickers table for developers to specify which stocks a model trades
CREATE TABLE public.model_tickers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  weight NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(model_id, ticker)
);

-- Enable RLS on model_tickers
ALTER TABLE public.model_tickers ENABLE ROW LEVEL SECURITY;

-- Policies for model_tickers
CREATE POLICY "Model owners can manage their model tickers"
ON public.model_tickers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.models 
    WHERE models.id = model_tickers.model_id 
    AND models.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view tickers for public models"
ON public.model_tickers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.models 
    WHERE models.id = model_tickers.model_id 
    AND models.is_public = true
  )
);

-- Add allocations table for retail investors to allocate paper money to models
CREATE TABLE public.allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  allocated_amount NUMERIC NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  current_value NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC DEFAULT 0,
  total_pnl_percent NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(subscription_id)
);

-- Enable RLS on allocations
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;

-- Policies for allocations
CREATE POLICY "Users can manage their own allocations"
ON public.allocations
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Model owners can view allocations to their models"
ON public.allocations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.models 
    WHERE models.id = allocations.model_id 
    AND models.user_id = auth.uid()
  )
);

-- Add paper_balance to profiles for tracking paper trading allocation pool
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS paper_balance NUMERIC DEFAULT 100000,
ADD COLUMN IF NOT EXISTS allocated_balance NUMERIC DEFAULT 0;

-- Add strategy configuration columns to models for developer adjustments
ALTER TABLE public.models
ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS position_size_percent NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_positions INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS stop_loss_percent NUMERIC DEFAULT 5,
ADD COLUMN IF NOT EXISTS take_profit_percent NUMERIC DEFAULT 15;

-- Add allocation_id to subscriber_trades to track which allocation trade belongs to
ALTER TABLE public.subscriber_trades
ADD COLUMN IF NOT EXISTS allocation_id UUID REFERENCES public.allocations(id);

-- Create function to update allocation values after trades
CREATE OR REPLACE FUNCTION public.update_allocation_value()
RETURNS TRIGGER AS $$
DECLARE
  trade_value NUMERIC;
BEGIN
  IF NEW.status = 'executed' AND NEW.allocation_id IS NOT NULL THEN
    -- Calculate trade impact (simplified: quantity * price)
    trade_value := COALESCE(NEW.executed_price, 0) * NEW.quantity;
    
    IF NEW.side = 'buy' THEN
      -- Reduce available value
      UPDATE public.allocations
      SET current_value = current_value - trade_value,
          updated_at = now()
      WHERE id = NEW.allocation_id;
    ELSE
      -- Increase available value + pnl
      UPDATE public.allocations
      SET current_value = current_value + trade_value,
          total_pnl = total_pnl + COALESCE(NEW.pnl, 0),
          updated_at = now()
      WHERE id = NEW.allocation_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for allocation updates
DROP TRIGGER IF EXISTS on_subscriber_trade_update_allocation ON public.subscriber_trades;
CREATE TRIGGER on_subscriber_trade_update_allocation
AFTER INSERT OR UPDATE ON public.subscriber_trades
FOR EACH ROW
EXECUTE FUNCTION public.update_allocation_value();

-- Enable realtime for allocations
ALTER PUBLICATION supabase_realtime ADD TABLE public.allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.model_tickers;