-- Fix 1: Add UPDATE and DELETE policies for trades table (owner-scoped)
CREATE POLICY "Users can update trades in their backtests"
ON public.trades
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.backtests 
    WHERE backtests.id = trades.backtest_id 
    AND backtests.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete trades in their backtests"
ON public.trades
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.backtests 
    WHERE backtests.id = trades.backtest_id 
    AND backtests.user_id = auth.uid()
  )
);

-- Fix 2: Add database constraints for input validation
-- Username constraints
ALTER TABLE public.profiles ADD CONSTRAINT username_length 
  CHECK (username IS NULL OR (length(username) >= 3 AND length(username) <= 30));
ALTER TABLE public.profiles ADD CONSTRAINT username_format 
  CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_-]+$');
ALTER TABLE public.profiles ADD CONSTRAINT display_name_length 
  CHECK (display_name IS NULL OR length(display_name) <= 100);
ALTER TABLE public.profiles ADD CONSTRAINT bio_length 
  CHECK (bio IS NULL OR length(bio) <= 500);

-- Posts content constraints
ALTER TABLE public.posts ADD CONSTRAINT content_length 
  CHECK (length(content) >= 1 AND length(content) <= 5000);

-- Comments content constraints
ALTER TABLE public.comments ADD CONSTRAINT comment_content_length 
  CHECK (length(content) >= 1 AND length(content) <= 2000);

-- Models constraints
ALTER TABLE public.models ADD CONSTRAINT model_name_length 
  CHECK (length(name) >= 1 AND length(name) <= 200);
ALTER TABLE public.models ADD CONSTRAINT model_description_length 
  CHECK (description IS NULL OR length(description) <= 2000);
ALTER TABLE public.models ADD CONSTRAINT model_strategy_length 
  CHECK (strategy_overview IS NULL OR length(strategy_overview) <= 5000);