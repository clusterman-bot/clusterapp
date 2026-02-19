
-- Create marketing_bot_config table
CREATE TABLE public.marketing_bot_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT false,
  interval_hours integer NOT NULL DEFAULT 24,
  pages_to_capture jsonb NOT NULL DEFAULT '["/trade","/community"]'::jsonb,
  instagram_account_id text,
  ig_access_token_encrypted text,
  caption_template text,
  last_posted_at timestamp with time zone,
  next_post_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own marketing bot config"
ON public.marketing_bot_config
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create marketing_bot_logs table
CREATE TABLE public.marketing_bot_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL,
  instagram_post_id text,
  caption text,
  pages_captured jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_bot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own marketing bot logs"
ON public.marketing_bot_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Trigger to keep updated_at current on config
CREATE OR REPLACE FUNCTION public.update_marketing_bot_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_marketing_bot_config_updated_at
BEFORE UPDATE ON public.marketing_bot_config
FOR EACH ROW
EXECUTE FUNCTION public.update_marketing_bot_config_updated_at();

-- Create marketing-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for marketing assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-assets');

CREATE POLICY "Service role can manage marketing assets"
ON storage.objects FOR ALL
USING (bucket_id = 'marketing-assets' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'marketing-assets' AND auth.role() = 'service_role');
