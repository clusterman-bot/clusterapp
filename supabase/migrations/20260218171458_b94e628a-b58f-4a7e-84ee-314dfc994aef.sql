-- Step 1: Backfill ticker and indicators_config for deployed models that have the data in configuration but not in top-level columns
UPDATE public.models
SET 
  ticker = configuration->>'source_symbol',
  indicators_config = configuration->'indicators'
WHERE 
  ticker IS NULL 
  AND configuration->>'source_symbol' IS NOT NULL
  AND indicators_config IS NULL;