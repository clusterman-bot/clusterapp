-- Create function to sync model subscriber counts
CREATE OR REPLACE FUNCTION public.sync_model_subscriber_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE models 
    SET total_subscribers = (
      SELECT COUNT(*) FROM subscriptions 
      WHERE model_id = NEW.model_id AND status = 'active'
    )
    WHERE id = NEW.model_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update both old and new model if model_id changed, or just current one
    UPDATE models 
    SET total_subscribers = (
      SELECT COUNT(*) FROM subscriptions 
      WHERE model_id = NEW.model_id AND status = 'active'
    )
    WHERE id = NEW.model_id;
    
    IF OLD.model_id != NEW.model_id THEN
      UPDATE models 
      SET total_subscribers = (
        SELECT COUNT(*) FROM subscriptions 
        WHERE model_id = OLD.model_id AND status = 'active'
      )
      WHERE id = OLD.model_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE models 
    SET total_subscribers = (
      SELECT COUNT(*) FROM subscriptions 
      WHERE model_id = OLD.model_id AND status = 'active'
    )
    WHERE id = OLD.model_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_subscriber_count_trigger ON public.subscriptions;

-- Create trigger
CREATE TRIGGER sync_subscriber_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_model_subscriber_count();

-- Add RLS policy for admin to delete any post
DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;
CREATE POLICY "Admins can delete any post"
ON public.posts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- Add RLS policy for admin to update any post
DROP POLICY IF EXISTS "Admins can update any post" ON public.posts;
CREATE POLICY "Admins can update any post"
ON public.posts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- Sync existing subscriber counts
UPDATE models m
SET total_subscribers = (
  SELECT COUNT(*) FROM subscriptions s
  WHERE s.model_id = m.id AND s.status = 'active'
);