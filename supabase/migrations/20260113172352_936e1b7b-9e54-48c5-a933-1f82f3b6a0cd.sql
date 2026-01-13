-- Drop the current overly restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own profile only" ON public.profiles;

-- Create a policy that allows:
-- 1. Users to see their own full profile
-- 2. All authenticated users to see other profiles (public_profiles view filters sensitive data)
-- 3. Anonymous users to see profiles (for public feed/explore pages)
CREATE POLICY "Profiles are publicly readable" 
ON public.profiles 
FOR SELECT 
USING (true);

-- The public_profiles view already filters out sensitive fields based on show_contact_info
-- This policy enables the view to work properly while the view handles field-level privacy