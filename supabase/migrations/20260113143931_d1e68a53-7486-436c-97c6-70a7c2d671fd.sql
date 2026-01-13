-- Add CHECK constraints to prevent negative financial values
-- This provides database-level protection against race conditions and bugs

-- Constraint for user_balances: cash must be non-negative
ALTER TABLE public.user_balances 
  ADD CONSTRAINT positive_cash_balance CHECK (cash_balance >= 0);

-- Constraints for holdings: quantity and average_cost must be non-negative
ALTER TABLE public.holdings 
  ADD CONSTRAINT positive_quantity CHECK (quantity >= 0);

ALTER TABLE public.holdings
  ADD CONSTRAINT positive_average_cost CHECK (average_cost >= 0);

-- Add privacy control for profile contact information
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS show_contact_info BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.show_contact_info IS 'Controls whether contact info (linkedin, twitter, github, website) is publicly visible';

-- Create a secure view that conditionally hides contact information based on privacy setting
CREATE OR REPLACE VIEW public.public_profiles AS
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