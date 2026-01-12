import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAlpacaPortfolioHistory, useAlpacaAccount } from '@/hooks/useAlpaca';
import { useActiveBrokerageAccount } from '@/hooks/useBrokerageAccounts';
import { useTradingMode } from '@/hooks/useTradingMode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Link2 } from 'lucide-react';
import { format, fromUnixTime } from 'date-fns';

export function PortfolioHistoryChart() {
  const { user } = useAuth();
  const { mode, isPaper } = useTradingMode();
  const { data: activeAccount, isLoading: accountCheckLoading } = useActiveBrokerageAccount(mode);
  const { data: alpacaAccount, isLoading: accountLoading } = useAlpacaAccount();
  const { data: history, isLoading: historyLoading } = useAlpacaPortfolioHistory('1M');

  const hasConnectedAccount = !!activeAccount;

  // Transform Alpaca history data for the chart
  const chartData = useMemo(() => {
    if (!history?.timestamp || !history?.equity) return [];
    
    return history.timestamp.map((ts, idx) => ({
      date: format(fromUnixTime(ts), 'MMM dd'),
      value: history.equity[idx],
      pnl: history.profit_loss?.[idx] || 0,
    }));
  }, [history]);

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

  if (accountLoading || historyLoading || accountCheckLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Portfolio Performance</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isPaper ? 'secondary' : 'default'}>
              {isPaper ? 'Paper' : 'Live'}
            </Badge>
            {chartData.length > 0 && (
              <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-profit' : 'text-loss'}`}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{isPositive ? '+' : ''}{changePercent}%</span>
              </div>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold">
          ${(alpacaAccount?.portfolio_value || endValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[200px]">
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
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Value']}
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
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <p>No portfolio history available yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
