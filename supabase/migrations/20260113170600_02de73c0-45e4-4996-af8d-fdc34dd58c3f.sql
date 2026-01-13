-- Create a public-facing view for backtests that excludes user_id
-- This prevents user enumeration through public model backtests
CREATE OR REPLACE VIEW public_backtests WITH (security_invoker = on) AS
SELECT 
  b.id,
  b.model_id,
  b.name,
  b.start_date,
  b.end_date,
  b.status,
  b.initial_capital,
  b.benchmark,
  b.sharpe_ratio,
  b.sortino_ratio,
  b.max_drawdown,
  b.win_rate,
  b.profit_factor,
  b.total_return,
  b.cagr,
  b.total_trades,
  b.equity_curve,
  b.created_at,
  b.completed_at
FROM backtests b
WHERE EXISTS (
  SELECT 1 FROM models m 
  WHERE m.id = b.model_id AND m.is_public = true
);

-- Add comment to document the view's purpose
COMMENT ON VIEW public_backtests IS 'Public-facing backtest data for public models. Excludes user_id to prevent user enumeration.';