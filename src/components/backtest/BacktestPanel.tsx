import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Play, Loader2, BarChart3, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { calculateChunks, computeAggregateMetrics, downsample, type CarryOver, type ChunkResult } from '@/lib/backtest-utils';
import { BacktestResults } from './BacktestResults';

interface BacktestMetrics {
  total_return: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  cagr: number;
  total_trades: number;
  initial_capital: number;
  final_equity: number;
}

interface BacktestTrade {
  side: string;
  ticker: string;
  quantity: number;
  entry_price: number;
  exit_price: number;
  entry_date: string;
  exit_date: string;
  pnl: number;
  pnl_percent: number;
  reason: string;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  equity_curve: { date: string; value: number }[];
  trades: BacktestTrade[];
  bars_count: number;
}

interface BacktestPanelProps {
  config: {
    symbol: string;
    indicators: any;
    rsi_oversold: number;
    rsi_overbought: number;
    theta: number;
    position_size_percent: number;
    stop_loss_percent: number;
    take_profit_percent: number;
    custom_indicators?: any[];
  };
}

const getDateString = (d: Date) => d.toISOString().split('T')[0];
const sixMonthsAgo = () => {
  const d = new Date(); d.setMonth(d.getMonth() - 6); return getDateString(d);
};
const today = () => getDateString(new Date());

const DATE_PRESETS = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
];

export function BacktestPanel({ config }: BacktestPanelProps) {
  const [startDate, setStartDate] = useState(sixMonthsAgo());
  const [endDate, setEndDate] = useState(today());
  const [initialCapital, setInitialCapital] = useState('100000');
  const [timeframe, setTimeframe] = useState('1Day');

  const applyPreset = (months: number) => {
    const end = new Date();
    const start = new Date(); start.setMonth(start.getMonth() - months);
    setStartDate(getDateString(start));
    setEndDate(getDateString(end));
  };
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    setResult(null);
    setChunkProgress(null);

    try {
      const indicatorsPayload = { ...config.indicators } as any;
      if (config.custom_indicators?.length) {
        indicatorsPayload.custom = config.custom_indicators;
      }

      const chunks = calculateChunks(startDate, endDate, timeframe);
      const isChunked = chunks.length > 1;

      if (!isChunked) {
        // Single chunk — use existing non-chunk path
        const { data, error } = await supabase.functions.invoke('run-backtest', {
          body: {
            symbol: config.symbol,
            indicators: indicatorsPayload,
            rsi_oversold: config.rsi_oversold,
            rsi_overbought: config.rsi_overbought,
            theta: config.theta,
            position_size_percent: config.position_size_percent,
            stop_loss_percent: config.stop_loss_percent,
            take_profit_percent: config.take_profit_percent,
            start_date: startDate,
            end_date: endDate,
            initial_capital: parseFloat(initialCapital),
            timeframe,
          },
        });

        if (error) throw error;
        if (data.error) {
          toast({ title: 'Backtest Error', description: data.error, variant: 'destructive' });
          return;
        }
        if (data.needsConnection) {
          toast({ title: 'Brokerage Required', description: data.error || 'Please connect your Alpaca account first.', variant: 'destructive' });
          return;
        }

        setResult(data);
        toast({ title: '✅ Backtest Complete', description: `${data.metrics.total_trades} trades across ${data.bars_count.toLocaleString()} bars.` });
      } else {
        // Chunked backtesting
        let carryOver: CarryOver | null = null;
        const allTrades: any[] = [];
        const allEquityCurve: { date: string; value: number }[] = [];
        const allDailyReturns: number[] = [];
        let totalBars = 0;

        setChunkProgress({ current: 0, total: chunks.length });

        for (let i = 0; i < chunks.length; i++) {
          setChunkProgress({ current: i + 1, total: chunks.length });

          const isLastChunk = i === chunks.length - 1;
          const chunk = chunks[i];

          const { data, error } = await supabase.functions.invoke('run-backtest', {
            body: {
              symbol: config.symbol,
              indicators: indicatorsPayload,
              rsi_oversold: config.rsi_oversold,
              rsi_overbought: config.rsi_overbought,
              theta: config.theta,
              position_size_percent: config.position_size_percent,
              stop_loss_percent: config.stop_loss_percent,
              take_profit_percent: config.take_profit_percent,
              start_date: chunk.start,
              end_date: chunk.end,
              initial_capital: parseFloat(initialCapital),
              timeframe,
              chunk_mode: true,
              carry_over: carryOver,
            },
          });

          if (error) throw error;
          if (data.error) {
            toast({ title: 'Backtest Error', description: `Chunk ${i + 1}: ${data.error}`, variant: 'destructive' });
            return;
          }
          if (data.needsConnection) {
            toast({ title: 'Brokerage Required', description: data.error || 'Please connect your Alpaca account first.', variant: 'destructive' });
            return;
          }

          const chunkData = data as ChunkResult;
          allTrades.push(...(chunkData.trades || []));
          allEquityCurve.push(...(chunkData.raw_equity_curve || []));
          allDailyReturns.push(...(chunkData.raw_daily_returns || []));
          totalBars += chunkData.bars_count || 0;
          carryOver = chunkData.carry_over;
        }

        // Close any remaining open position at the last equity curve value
        if (carryOver && carryOver.position > 0 && allEquityCurve.length > 0) {
          const lastPoint = allEquityCurve[allEquityCurve.length - 1];
          // The carry_over still has an open position; the final equity already accounts for it
        }

        // Compute aggregate metrics
        const capital = parseFloat(initialCapital);
        const metrics = computeAggregateMetrics(
          allTrades, allDailyReturns, allEquityCurve,
          capital, startDate, endDate, timeframe,
        );

        // Downsample equity curve for display
        const displayCurve = downsample(allEquityCurve, 500);

        const stitchedResult: BacktestResult = {
          metrics,
          equity_curve: displayCurve,
          trades: allTrades.filter(t => t.side === 'sell'),
          bars_count: totalBars,
        };

        setResult(stitchedResult);
        setChunkProgress(null);
        toast({
          title: '✅ Backtest Complete',
          description: `${metrics.total_trades} trades across ${totalBars.toLocaleString()} bars (${chunks.length} chunks).`,
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to run backtest', variant: 'destructive' });
    } finally {
      setIsRunning(false);
      setChunkProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Backtest Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            Test <span className="font-medium">{config.symbol}</span> strategy against historical data via Alpaca
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick date presets */}
          <div className="flex gap-1.5 flex-wrap">
            {DATE_PRESETS.map(p => (
              <Button key={p.label} variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => applyPreset(p.months)}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Timeframe</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1Min">1 Minute</SelectItem>
                  <SelectItem value="5Min">5 Minutes</SelectItem>
                  <SelectItem value="15Min">15 Minutes</SelectItem>
                  <SelectItem value="1Hour">1 Hour</SelectItem>
                  <SelectItem value="1Day">1 Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Initial Capital ($)</Label>
              <Input type="number" value={initialCapital} onChange={e => setInitialCapital(e.target.value)} min="1000" step="1000" className="h-8 text-xs" />
            </div>
          </div>

          {/* Progress bar during chunked backtest */}
          {chunkProgress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing chunk {chunkProgress.current} of {chunkProgress.total}...</span>
                <span>{Math.round((chunkProgress.current / chunkProgress.total) * 100)}%</span>
              </div>
              <Progress value={(chunkProgress.current / chunkProgress.total) * 100} className="h-2" />
            </div>
          )}

          <Button onClick={handleRunBacktest} disabled={isRunning} className="w-full" size="sm">
            {isRunning ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
            {isRunning ? (chunkProgress ? `Running Chunk ${chunkProgress.current}/${chunkProgress.total}...` : 'Running Backtest...') : 'Run Backtest'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && <BacktestResults result={result} />}

      {/* Empty state */}
      {!result && !isRunning && (
        <Card className="flex items-center justify-center h-[200px]">
          <div className="text-center space-y-2 p-6">
            <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-xs">Configure dates and run a backtest to see results</p>
          </div>
        </Card>
      )}
    </div>
  );
}
