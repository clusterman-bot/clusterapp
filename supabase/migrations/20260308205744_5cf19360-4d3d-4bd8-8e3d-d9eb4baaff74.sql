
ALTER TABLE public.quick_build_runs ADD COLUMN IF NOT EXISTS build_logs jsonb DEFAULT '[]'::jsonb;

ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_build_runs;
