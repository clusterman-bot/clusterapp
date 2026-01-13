-- Drop the trigger that auto-assigns roles
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Drop the function that auto-assigns roles
DROP FUNCTION IF EXISTS public.handle_new_user_role();