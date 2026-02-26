ALTER TABLE public.model_signals ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE public.subscriber_trades ALTER COLUMN quantity TYPE numeric USING quantity::numeric;