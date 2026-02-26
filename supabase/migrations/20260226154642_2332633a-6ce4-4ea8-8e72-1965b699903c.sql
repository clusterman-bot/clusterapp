-- Allow all authenticated users to view signals for public models (including system bots)
CREATE POLICY "Anyone can view signals for public models"
  ON public.model_signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM models
      WHERE models.id = model_signals.model_id
      AND (models.is_public = true OR models.is_system = true)
    )
  );
