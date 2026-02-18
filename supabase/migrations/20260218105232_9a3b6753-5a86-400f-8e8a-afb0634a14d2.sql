
-- Add min/max allocation constraints and max exposure to models table
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS min_allocation numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_allocation numeric DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS max_exposure_percent numeric DEFAULT 20;

-- Add a column to subscriptions to track if insufficient funds email was sent (one-time)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS funds_warning_sent boolean DEFAULT false;
