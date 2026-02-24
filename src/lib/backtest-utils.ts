// Chunking utilities for backtesting

export interface ChunkDateRange {
  start: string;
  end: string;
}

/** Returns chunk window in calendar days based on timeframe */
function getChunkDays(timeframe: string): number {
  switch (timeframe) {
    case '1Min': return 60;
    case '5Min': return 150;
    case '15Min': return 300;
    default: return 0; // no splitting for 1Hour/1Day
  }
}

/** Split a date range into chunk windows */
export function calculateChunks(startDate: string, endDate: string, timeframe: string): ChunkDateRange[] {
  const chunkDays = getChunkDays(timeframe);
  if (chunkDays === 0) return [{ start: startDate, end: endDate }];

  const chunks: ChunkDateRange[] = [];
  let cursor = new Date(startDate);
  const end = new Date(endDate);

  while (cursor < end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + chunkDays);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());

    chunks.push({
      start: cursor.toISOString().slice(0, 10),
      end: chunkEnd.toISOString().slice(0, 10),
    });

    cursor = new Date(chunkEnd);
  }

  return chunks;
}

export interface CarryOver {
  cash: number;
  position: number;
  entryPrice: number;
}

export interface ChunkResult {
  trades: any[];
  bars_count: number;
  raw_equity_curve: { date: string; value: number }[];
  raw_daily_returns: number[];
  carry_over: CarryOver;
}

/** Annualization factor per timeframe (must match edge function) */
function getAnnualizationFactor(timeframe: string): number {
  const factors: Record<string, number> = {
    '1Min': 252 * 6.5 * 60,
    '5Min': 252 * 6.5 * 12,
    '15Min': 252 * 6.5 * 4,
    '1Hour': 252 * 6.5,
    '1Day': 252,
  };
  return factors[timeframe] || 252;
}

/** Downsample an array to at most maxPoints entries */
export function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, idx) => idx % step === 0 || idx === arr.length - 1);
}

/** Compute aggregate metrics from stitched chunk data */
export function computeAggregateMetrics(
  allTrades: any[],
  allDailyReturns: number[],
  allEquityCurve: { date: string; value: number }[],
  initialCapital: number,
  startDate: string,
  endDate: string,
  timeframe: string,
) {
  const closedTrades = allTrades.filter(t => t.side === 'sell');
  const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

  const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Max drawdown
  let peak = initialCapital;
  let maxDrawdown = 0;
  for (const point of allEquityCurve) {
    if (point.value > peak) peak = point.value;
    const dd = ((peak - point.value) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Final equity from last equity curve point
  const finalEquity = allEquityCurve.length > 0 ? allEquityCurve[allEquityCurve.length - 1].value : initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  // Sharpe & Sortino
  const annFactor = getAnnualizationFactor(timeframe);
  const avgReturn = allDailyReturns.length > 0 ? allDailyReturns.reduce((a, b) => a + b, 0) / allDailyReturns.length : 0;
  const stdDev = allDailyReturns.length > 1
    ? Math.sqrt(allDailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (allDailyReturns.length - 1))
    : 0;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(annFactor) : 0;

  const downsideReturns = allDailyReturns.filter(r => r < 0);
  const downsideDev = downsideReturns.length > 1
    ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length)
    : 0;
  const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(annFactor) : 0;

  // CAGR
  const daysDiff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
  const years = daysDiff / 365.25;
  const cagr = years > 0 ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100 : 0;

  return {
    total_return: parseFloat(totalReturn.toFixed(2)),
    sharpe_ratio: parseFloat(sharpeRatio.toFixed(2)),
    sortino_ratio: parseFloat(sortinoRatio.toFixed(2)),
    max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
    win_rate: parseFloat(winRate.toFixed(1)),
    profit_factor: parseFloat(profitFactor.toFixed(2)),
    cagr: parseFloat(cagr.toFixed(2)),
    total_trades: closedTrades.length,
    initial_capital: initialCapital,
    final_equity: parseFloat(finalEquity.toFixed(2)),
  };
}
