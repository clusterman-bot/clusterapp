
-- Create function to sync backtest metrics to parent model
CREATE OR REPLACE FUNCTION public.sync_model_metrics_from_backtest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.total_return IS NOT NULL THEN
    UPDATE public.models
    SET
      total_return   = NEW.total_return,
      sharpe_ratio   = NEW.sharpe_ratio,
      max_drawdown   = NEW.max_drawdown,
      win_rate       = NEW.win_rate,
      updated_at     = NOW()
    WHERE id = NEW.model_id
      -- Only update if this backtest is better (higher return) or metrics are null
      AND (total_return IS NULL OR NEW.total_return > total_return);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger that fires after a backtest row is updated
CREATE TRIGGER on_backtest_completed
  AFTER UPDATE ON public.backtests
  FOR EACH ROW EXECUTE FUNCTION public.sync_model_metrics_from_backtest();
