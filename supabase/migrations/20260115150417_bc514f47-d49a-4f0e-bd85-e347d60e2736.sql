-- Drop the existing check constraint and add a new one that includes 'ml'
ALTER TABLE public.models DROP CONSTRAINT IF EXISTS models_model_type_check;

ALTER TABLE public.models ADD CONSTRAINT models_model_type_check 
  CHECK (model_type IN ('no-code', 'sandbox', 'ml'));