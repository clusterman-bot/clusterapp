-- Add ML-specific columns to existing models table
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS ml_model_uuid TEXT;
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS ticker VARCHAR(10);
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS feature_columns JSONB;
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS hyperparameters JSONB;
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS training_metrics JSONB;
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS indicators_config JSONB;
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS horizon INTEGER DEFAULT 5;
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS theta NUMERIC DEFAULT 0.01;

-- Create training_runs table for training history
CREATE TABLE public.training_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  indicators_enabled JSONB DEFAULT '{}',
  hyperparameters JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  best_model_name TEXT,
  best_model_metrics JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create validation_runs table for validation history
CREATE TABLE public.validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_run_id UUID REFERENCES public.training_runs(id) ON DELETE CASCADE,
  model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  metrics JSONB DEFAULT '{}',
  signal_distribution JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create market_data_cache table for caching Polygon data
CREATE TABLE public.market_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  timespan TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
  UNIQUE(ticker, timespan, start_date, end_date)
);

-- Enable RLS on new tables
ALTER TABLE public.training_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for training_runs
CREATE POLICY "Users can view their own training runs"
ON public.training_runs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own training runs"
ON public.training_runs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own training runs"
ON public.training_runs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own training runs"
ON public.training_runs FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for validation_runs
CREATE POLICY "Users can view their own validation runs"
ON public.validation_runs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own validation runs"
ON public.validation_runs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own validation runs"
ON public.validation_runs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own validation runs"
ON public.validation_runs FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for market_data_cache (public read, admin write)
CREATE POLICY "Anyone can view cached market data"
ON public.market_data_cache FOR SELECT
USING (true);

CREATE POLICY "Service role can insert market data"
ON public.market_data_cache FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update market data"
ON public.market_data_cache FOR UPDATE
USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_runs_user_id ON public.training_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_runs_model_id ON public.training_runs(model_id);
CREATE INDEX IF NOT EXISTS idx_training_runs_status ON public.training_runs(status);
CREATE INDEX IF NOT EXISTS idx_validation_runs_user_id ON public.validation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_runs_training_run_id ON public.validation_runs(training_run_id);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_ticker ON public.market_data_cache(ticker);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_expires ON public.market_data_cache(expires_at);

-- Enable realtime for training_runs to track progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_runs;