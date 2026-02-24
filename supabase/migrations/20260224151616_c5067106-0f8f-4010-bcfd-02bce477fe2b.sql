
-- New table: bot_optimization_logs
CREATE TABLE public.bot_optimization_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.stock_automations(id) ON DELETE CASCADE,
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  trigger_reason TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('parameter_optimization', 'ai_rewrite')),
  old_config JSONB,
  new_config JSONB,
  old_metrics JSONB,
  new_metrics JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bot_optimization_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own optimization logs"
  ON public.bot_optimization_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert optimization logs"
  ON public.bot_optimization_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- New columns on stock_automations
ALTER TABLE public.stock_automations
  ADD COLUMN self_improve_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN min_win_rate NUMERIC NOT NULL DEFAULT 0.40,
  ADD COLUMN max_drawdown_threshold NUMERIC NOT NULL DEFAULT 15,
  ADD COLUMN max_consecutive_losses INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN last_optimization_at TIMESTAMPTZ,
  ADD COLUMN optimization_generation INTEGER NOT NULL DEFAULT 0;
