import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Play, Loader2, TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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

interface BacktestResult {
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

export function BacktestPanel({ config }: BacktestPanelProps) {
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');
  const [initialCapital, setInitialCapital] = useState('100000');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const indicatorsPayload = { ...config.indicators } as any;
      if (config.custom_indicators?.length) {
        indicatorsPayload.custom = config.custom_indicators;
      }

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
      toast({ title: '✅ Backtest Complete', description: `${data.metrics.total_trades} trades simulated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to run backtest', variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  };

  const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
          <div className="space-y-1">
            <Label className="text-xs">Initial Capital ($)</Label>
            <Input type="number" value={initialCapital} onChange={e => setInitialCapital(e.target.value)} min="1000" step="1000" className="h-8 text-xs" />
          </div>
          <Button onClick={handleRunBacktest} disabled={isRunning} className="w-full" size="sm">
            {isRunning ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
            {isRunning ? 'Running Backtest...' : 'Run Backtest'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="Total Return"
              value={`${result.metrics.total_return > 0 ? '+' : ''}${result.metrics.total_return}%`}
              positive={result.metrics.total_return > 0}
              sub={`${formatCurrency(result.metrics.initial_capital)} → ${formatCurrency(result.metrics.final_equity)}`}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={result.metrics.sharpe_ratio.toFixed(2)}
              positive={result.metrics.sharpe_ratio > 1}
            />
            <MetricCard
              label="Win Rate"
              value={`${result.metrics.win_rate}%`}
              positive={result.metrics.win_rate > 50}
              sub={`${result.metrics.total_trades} trades`}
            />
            <MetricCard
              label="Max Drawdown"
              value={`-${result.metrics.max_drawdown}%`}
              positive={result.metrics.max_drawdown < 10}
            />
          </div>

          {/* Additional Metrics */}
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Sortino</span>
                  <p className="font-mono font-medium">{result.metrics.sortino_ratio.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Profit Factor</span>
                  <p className="font-mono font-medium">{result.metrics.profit_factor >= 999 ? '∞' : result.metrics.profit_factor.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CAGR</span>
                  <p className="font-mono font-medium">{result.metrics.cagr > 0 ? '+' : ''}{result.metrics.cagr}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equity Curve */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5" /> Equity Curve
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={result.equity_curve}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9 }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
                    }}
                    interval="preserveStartEnd"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 9 }}
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Equity']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <ReferenceLine y={result.metrics.initial_capital} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Trade Log */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Trade Log ({result.trades.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="max-h-[200px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-1 px-1">Date</th>
                      <th className="text-right py-1 px-1">Entry</th>
                      <th className="text-right py-1 px-1">Exit</th>
                      <th className="text-right py-1 px-1">P&L</th>
                      <th className="text-right py-1 px-1">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((trade, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1 px-1 font-mono">{new Date(trade.exit_date).toLocaleDateString()}</td>
                        <td className="py-1 px-1 text-right font-mono">${trade.entry_price.toFixed(2)}</td>
                        <td className="py-1 px-1 text-right font-mono">${trade.exit_price.toFixed(2)}</td>
                        <td className={`py-1 px-1 text-right font-mono ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {trade.pnl >= 0 ? '+' : ''}{trade.pnl_percent.toFixed(1)}%
                        </td>
                        <td className="py-1 px-1 text-right">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{trade.reason}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

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

function MetricCard({ label, value, positive, sub }: { label: string; value: string; positive: boolean; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold font-mono ${positive ? 'text-green-500' : 'text-red-500'}`}>
          {value}
        </p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
