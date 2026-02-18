
-- Step 1: Create the has_alpha_role function first (before any policies use it)
CREATE OR REPLACE FUNCTION public.has_alpha_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'alpha'
  )
$$;

-- Step 2: Add moderation columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trading_frozen boolean NOT NULL DEFAULT false;

-- Step 3: Create platform_settings table for global Alpha controls
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT 'false',
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform settings"
  ON public.platform_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Alpha can update platform settings"
  ON public.platform_settings
  FOR ALL
  USING (public.has_alpha_role(auth.uid()))
  WITH CHECK (public.has_alpha_role(auth.uid()));

-- Step 4: Insert the global control keys
INSERT INTO public.platform_settings (key, value)
VALUES 
  ('community_muted', 'false'),
  ('onboarding_frozen', 'false')
ON CONFLICT (key) DO NOTHING;

-- Step 5: Allow Alpha users to update profile moderation fields
CREATE POLICY "Alpha can manage user moderation"
  ON public.profiles
  FOR UPDATE
  USING (public.has_alpha_role(auth.uid()))
  WITH CHECK (public.has_alpha_role(auth.uid()));

-- Step 6: Allow Alpha users to manage user_roles
CREATE POLICY "Alpha can update any role"
  ON public.user_roles
  FOR UPDATE
  USING (public.has_alpha_role(auth.uid()))
  WITH CHECK (public.has_alpha_role(auth.uid()));

CREATE POLICY "Alpha can insert roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_alpha_role(auth.uid()));

CREATE POLICY "Alpha can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_alpha_role(auth.uid()));

CREATE POLICY "Alpha can delete roles"
  ON public.user_roles
  FOR DELETE
  USING (public.has_alpha_role(auth.uid()));
