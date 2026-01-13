-- Fix the security definer view issue by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate the view with SECURITY INVOKER
CREATE VIEW public.public_profiles 
WITH (security_invoker = true) AS
SELECT 
  id, 
  username, 
  display_name, 
  avatar_url, 
  bio, 
  experience_level,
  is_verified,
  total_followers,
  total_following,
  total_earnings,
  trading_philosophy,
  user_type,
  created_at,
  updated_at,
  -- Only expose contact info if user has opted in
  CASE WHEN show_contact_info = true THEN linkedin_url ELSE NULL END as linkedin_url,
  CASE WHEN show_contact_info = true THEN twitter_handle ELSE NULL END as twitter_handle,
  CASE WHEN show_contact_info = true THEN github_handle ELSE NULL END as github_handle,
  CASE WHEN show_contact_info = true THEN website_url ELSE NULL END as website_url
FROM public.profiles;