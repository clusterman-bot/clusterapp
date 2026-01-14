-- Create reposts table
CREATE TABLE public.reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Create bookmarks table (saved posts)
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Add reposts_count to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reposts_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Repost policies
CREATE POLICY "Users can view all reposts"
  ON public.reposts FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own reposts"
  ON public.reposts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reposts"
  ON public.reposts FOR DELETE
  USING (auth.uid() = user_id);

-- Bookmark policies - only owner can see their bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update reposts_count when a repost is created
CREATE OR REPLACE FUNCTION public.handle_repost_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET reposts_count = COALESCE(reposts_count, 0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET reposts_count = GREATEST(COALESCE(reposts_count, 0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger for reposts count
CREATE TRIGGER on_repost_change
  AFTER INSERT OR DELETE ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.handle_repost_count();

-- Add indexes for performance
CREATE INDEX idx_reposts_user_id ON public.reposts(user_id);
CREATE INDEX idx_reposts_post_id ON public.reposts(post_id);
CREATE INDEX idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX idx_bookmarks_post_id ON public.bookmarks(post_id);