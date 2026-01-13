-- Fix critical role escalation vulnerability
-- Drop the vulnerable policy that allows users to update their own role
DROP POLICY IF EXISTS "Users can update their own role" ON public.user_roles;

-- Create restrictive policy: Only admins can update ANY role
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Ensure users can only INSERT their own role on signup (not admin)
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

CREATE POLICY "Users can insert initial non-admin role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND role IN ('developer', 'retail_trader')
);

-- Ensure only admins can delete roles
DROP POLICY IF EXISTS "Admins can delete any role" ON public.user_roles;

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Add comment documenting security measures for brokerage accounts
COMMENT ON TABLE public.user_brokerage_accounts IS 
'Stores encrypted brokerage credentials. Security measures:
1. API keys encrypted with AES-256-GCM before storage
2. ENCRYPTION_SECRET stored in Supabase secrets (not in database)
3. RLS restricts access to account owner only
4. Decryption only happens in edge functions with service role
5. Access logging via log_credential_access trigger
6. Keys never exposed to client - only decrypted server-side';