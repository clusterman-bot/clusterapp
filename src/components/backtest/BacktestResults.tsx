import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { BacktestResult } from './BacktestPanel';

const formatCurrency = (val: number) =>
  `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MetricCard({ label, value, positive, sub }: { label: string; value: string; positive: boolean; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold font-mono ${positive ? 'text-green-500' : 'text-red-500'}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function BacktestResults({ result }: { result: BacktestResult }) {
  return (
    <>
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Total Return"
          value={`${result.metrics.total_return > 0 ? '+' : ''}${result.metrics.total_return}%`}
          positive={result.metrics.total_return > 0}
          sub={`${formatCurrency(result.metrics.initial_capital)} → ${formatCurrency(result.metrics.final_equity)}`}
        />
        <MetricCard label="Sharpe Ratio" value={result.metrics.sharpe_ratio.toFixed(2)} positive={result.metrics.sharpe_ratio > 1} />
        <MetricCard
          label="Win Rate"
          value={`${result.metrics.win_rate}%`}
          positive={result.metrics.win_rate > 50}
          sub={`${result.metrics.total_trades} trades · ${result.bars_count.toLocaleString()} bars`}
        />
        <MetricCard label="Max Drawdown" value={`-${result.metrics.max_drawdown}%`} positive={result.metrics.max_drawdown < 10} />
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
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
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
  );
}
