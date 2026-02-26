
-- Add is_system column to models table
ALTER TABLE public.models ADD COLUMN is_system boolean NOT NULL DEFAULT false;

-- Create system_bot_config table
CREATE TABLE public.system_bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  sector text NOT NULL,
  ticker_pool text[] NOT NULL DEFAULT '{}',
  current_ticker text,
  last_rotation_at timestamptz,
  last_optimization_at timestamptz,
  optimization_generation integer NOT NULL DEFAULT 0,
  rotation_interval_days integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_id)
);

ALTER TABLE public.system_bot_config ENABLE ROW LEVEL SECURITY;

-- Alpha users can view all system bot configs
CREATE POLICY "Alpha can view system bot configs"
  ON public.system_bot_config
  FOR SELECT
  TO authenticated
  USING (public.has_alpha_role(auth.uid()));

-- Alpha users can update system bot configs
CREATE POLICY "Alpha can update system bot configs"
  ON public.system_bot_config
  FOR UPDATE
  TO authenticated
  USING (public.has_alpha_role(auth.uid()))
  WITH CHECK (public.has_alpha_role(auth.uid()));

-- Anyone authenticated can view system bot configs (for marketplace display)
CREATE POLICY "Authenticated can view system bot configs"
  ON public.system_bot_config
  FOR SELECT
  TO authenticated
  USING (true);
