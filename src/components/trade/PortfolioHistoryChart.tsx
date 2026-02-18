import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAlpacaPortfolioHistory, useAlpacaAccount } from '@/hooks/useAlpaca';
import { useActiveBrokerageAccount } from '@/hooks/useBrokerageAccounts';
import { useTradingMode } from '@/hooks/useTradingMode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Link2 } from 'lucide-react';
import { format, fromUnixTime } from 'date-fns';

const PERIODS = [
  { label: '1D', value: '1D', timeframe: '5Min' },
  { label: '1W', value: '1W', timeframe: '1H' },
  { label: '1M', value: '1M', timeframe: '1D' },
  { label: '3M', value: '3M', timeframe: '1D' },
  { label: '1Y', value: '1A', timeframe: '1D' },
  { label: 'All', value: 'all', timeframe: '1D' },
];

function formatDateByPeriod(ts: number, period: string): string {
  const d = fromUnixTime(ts);
  if (period === '1D') return format(d, 'HH:mm');
  if (period === '1W') return format(d, 'EEE HH:mm');
  return format(d, 'MMM dd');
}

export function PortfolioHistoryChart() {
  const { user } = useAuth();
  const { mode, isPaper } = useTradingMode();
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const { data: activeAccount, isLoading: accountCheckLoading } = useActiveBrokerageAccount(mode);
  const { data: alpacaAccount, isLoading: accountLoading } = useAlpacaAccount();

  const periodConfig = PERIODS.find(p => p.label === selectedPeriod) || PERIODS[2];

  const { data: history, isLoading: historyLoading } = useAlpacaPortfolioHistory(periodConfig.value);

  const hasConnectedAccount = !!activeAccount;

  // Transform Alpaca history data for the chart
  const chartData = useMemo(() => {
    if (!history?.timestamp || !history?.equity) return [];
    return history.timestamp.map((ts, idx) => ({
      date: formatDateByPeriod(ts, selectedPeriod),
      value: history.equity[idx],
      pnl: history.profit_loss?.[idx] || 0,
    })).filter(d => d.value > 0);
  }, [history, selectedPeriod]);

  const startValue = chartData[0]?.value || 0;
  const endValue = chartData[chartData.length - 1]?.value || alpacaAccount?.portfolio_value || 0;
  const change = endValue - startValue;
  const changePercent = startValue > 0 ? ((change / startValue) * 100).toFixed(2) : '0.00';
  const isPositive = change >= 0;

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Sign in to see your portfolio history
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasConnectedAccount && !accountCheckLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Portfolio Performance</CardTitle>
            <Badge variant={isPaper ? 'secondary' : 'default'}>
              {isPaper ? 'Paper' : 'Live'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Link2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No {mode} account connected. Connect your brokerage to see portfolio history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accountLoading || accountCheckLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">Portfolio Performance</CardTitle>
              <Badge variant={isPaper ? 'secondary' : 'default'}>
                {isPaper ? 'Paper' : 'Live'}
              </Badge>
            </div>
            <p className="text-3xl font-bold">
              ${(alpacaAccount?.portfolio_value || endValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            {chartData.length > 0 && (
              <div className={`flex items-center gap-1 text-sm mt-1 ${isPositive ? 'text-profit' : 'text-loss'}`}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>
                  {isPositive ? '+' : ''}${Math.abs(change).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}({isPositive ? '+' : ''}{changePercent}%)
                </span>
                <span className="text-muted-foreground ml-1">this period</span>
              </div>
            )}
          </div>

          {/* Period selector */}
          <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
            {PERIODS.map(p => (
              <Button
                key={p.label}
                variant={selectedPeriod === p.label ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs font-medium"
                onClick={() => setSelectedPeriod(p.label)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {historyLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : chartData.length > 0 ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                  domain={['auto', 'auto']}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [
                    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    'Value',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
                  strokeWidth={2}
                  fill="url(#portfolioGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground">
            <p>No portfolio history available for this period</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
