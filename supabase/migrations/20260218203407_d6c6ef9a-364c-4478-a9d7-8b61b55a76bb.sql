ALTER TABLE public.stock_automations
  ADD COLUMN IF NOT EXISTS max_investment_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_invested_amount numeric DEFAULT 0 NOT NULL;