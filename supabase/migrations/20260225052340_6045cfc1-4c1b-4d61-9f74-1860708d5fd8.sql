
-- Create strategy_knowledge table (anonymized, no user_id)
CREATE TABLE public.strategy_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  source_type TEXT NOT NULL,
  indicators_used JSONB DEFAULT '{}'::jsonb,
  risk_params JSONB DEFAULT '{}'::jsonb,
  custom_indicator_names TEXT[] DEFAULT '{}',
  outcome_metrics JSONB DEFAULT NULL,
  optimization_delta JSONB DEFAULT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast symbol lookups
CREATE INDEX idx_strategy_knowledge_symbol ON public.strategy_knowledge (symbol);
CREATE INDEX idx_strategy_knowledge_created_at ON public.strategy_knowledge (created_at DESC);

-- RLS: authenticated users can SELECT, only service role can INSERT
ALTER TABLE public.strategy_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view strategy knowledge"
  ON public.strategy_knowledge FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies for anon/authenticated — only service_role can write

-- Create knowledge_summaries table
CREATE TABLE public.knowledge_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  total_strategies INTEGER NOT NULL DEFAULT 0,
  avg_sharpe NUMERIC DEFAULT NULL,
  avg_win_rate NUMERIC DEFAULT NULL,
  best_indicator_combo JSONB DEFAULT NULL,
  best_params JSONB DEFAULT NULL,
  common_pitfalls TEXT[] DEFAULT '{}',
  summary_text TEXT DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_summaries_symbol ON public.knowledge_summaries (symbol);

ALTER TABLE public.knowledge_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view knowledge summaries"
  ON public.knowledge_summaries FOR SELECT
  USING (auth.role() = 'authenticated');
