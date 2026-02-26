
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  section text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can submit feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Alpha users can read all feedback
CREATE POLICY "Alpha can view all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (has_alpha_role(auth.uid()));

-- Alpha users can update feedback (mark as read)
CREATE POLICY "Alpha can update feedback"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (has_alpha_role(auth.uid()))
  WITH CHECK (has_alpha_role(auth.uid()));

-- Alpha users can delete feedback
CREATE POLICY "Alpha can delete feedback"
  ON public.feedback FOR DELETE
  TO authenticated
  USING (has_alpha_role(auth.uid()));
