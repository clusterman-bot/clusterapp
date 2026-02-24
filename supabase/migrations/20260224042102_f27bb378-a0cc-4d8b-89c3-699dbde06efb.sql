
-- Create quick_build_runs table for tracking Quick Build pipelines
CREATE TABLE public.quick_build_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'analyzing',
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  indicators_config JSONB DEFAULT '{}'::jsonb,
  hyperparameters JSONB DEFAULT '{}'::jsonb,
  training_period TEXT,
  validation_period TEXT,
  training_run_id UUID REFERENCES public.training_runs(id),
  validation_run_id UUID REFERENCES public.validation_runs(id),
  model_id UUID REFERENCES public.models(id),
  results JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.quick_build_runs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own runs
CREATE POLICY "Users can manage their own quick build runs"
ON public.quick_build_runs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
