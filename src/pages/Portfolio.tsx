import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, TrendingDown, Briefcase, DollarSign,
  PieChart, ArrowRight, Link2, Settings
} from 'lucide-react';
import { useBrokerageAccounts } from '@/hooks/useBrokerageAccounts';
import { useAlpacaAccount, useAlpacaPositions } from '@/hooks/useAlpaca';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { TradingModeToggle } from '@/components/TradingModeToggle';
import { useTradingMode } from '@/hooks/useTradingMode';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function Portfolio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: brokerageAccounts, isLoading: accountsLoading } = useBrokerageAccounts();
  const { data: alpacaAccount, isLoading: alpacaLoading } = useAlpacaAccount();
  const { data: alpacaPositions, isLoading: positionsLoading } = useAlpacaPositions();

  // Check if user has any connected brokerage accounts
  const hasConnectedAccount = brokerageAccounts && brokerageAccounts.length > 0;
  const activeAccount = brokerageAccounts?.find(a => a.is_active);

  const { isVerified } = useEmailVerified();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <div className="text-center py-16">
            <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Sign in to view your portfolio</h2>
            <p className="text-muted-foreground mb-4">Track your investments and performance</p>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        </main>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <EmailVerificationBanner />
          <div className="text-center py-16">
            <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Verify your email</h2>
            <p className="text-muted-foreground mb-4">You need to verify your email before accessing your portfolio.</p>
          </div>
        </main>
      </div>
    );
  }

  // Loading state
  if (accountsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <BackButton />
          <div className="space-y-6">
            <Skeleton className="h-10 w-48" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Empty state - No connected brokerage account
  if (!hasConnectedAccount) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <BackButton />
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Link2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Brokerage</h2>
            <p className="text-muted-foreground mb-6">
              Link your Alpaca brokerage account to view your portfolio, track positions, and start trading.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/settings/brokerage')} size="lg">
                <Settings className="mr-2 h-4 w-4" />
                Connect Account
              </Button>
              <Button variant="outline" onClick={() => navigate('/trade')} size="lg">
                Explore Markets
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Calculate portfolio metrics from Alpaca data
  const netWorth = alpacaAccount?.portfolio_value || 0;
  const cashBalance = alpacaAccount?.cash || 0;
  const investedValue = alpacaAccount?.equity ? alpacaAccount.equity - cashBalance : 0;
  
  // Calculate total gain/loss from positions
  const totalGain = alpacaPositions?.reduce((sum, pos) => sum + Number(pos.unrealized_pl || 0), 0) || 0;
  const totalGainPercent = investedValue > 0 ? (totalGain / investedValue) * 100 : 0;

  // Pie chart data from Alpaca positions
  const pieData = alpacaPositions?.map((pos, i) => ({
    name: pos.symbol,
    value: Number(pos.market_value) || 0,
    color: COLORS[i % COLORS.length],
  })) || [];

  if (cashBalance > 0) {
    pieData.push({
      name: 'Cash',
      value: cashBalance,
      color: 'hsl(var(--muted-foreground))',
    });
  }

  const isLoading = alpacaLoading || positionsLoading;

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        <BackButton />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Portfolio</h1>
            {activeAccount && (
              <p className="text-sm text-muted-foreground mt-1">
                {activeAccount.broker_name} • {activeAccount.account_type === 'paper' ? 'Paper Trading' : 'Live Trading'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <TradingModeToggle />
            <Button variant="outline" onClick={() => navigate('/settings/brokerage')}>
              <Settings className="mr-2 h-4 w-4" /> Manage
            </Button>
            <Button onClick={() => navigate('/trade')}>
              Trade <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Net Worth</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold">{formatPrice(netWorth)}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Invested</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold">{formatPrice(investedValue)}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                {totalGain >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-profit" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
                <p className="text-sm text-muted-foreground">Unrealized P&L</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {totalGain >= 0 ? '+' : ''}{formatPrice(totalGain)}
                  </p>
                  <p className={`text-sm ${totalGain >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {totalGain >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Cash Available</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-2xl font-bold">{formatPrice(cashBalance)}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Holdings List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted-foreground/20" />
                        <div>
                          <div className="h-4 bg-muted-foreground/20 rounded w-16 mb-2" />
                          <div className="h-3 bg-muted-foreground/20 rounded w-24" />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-muted-foreground/20 rounded w-20 mb-2" />
                        <div className="h-3 bg-muted-foreground/20 rounded w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !alpacaPositions || alpacaPositions.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No holdings yet</p>
                  <Button onClick={() => navigate('/trade')}>Start Trading</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Separate stock and crypto positions */}
                  {(() => {
                    const stockPositions = alpacaPositions.filter(p => !p.symbol.includes('/'));
                    const cryptoPositions = alpacaPositions.filter(p => p.symbol.includes('/'));

                    return (
                      <>
                        {stockPositions.length > 0 && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 pt-2">Stocks</p>
                            {stockPositions.map((position) => (
                              <div 
                                key={position.asset_id}
                                className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                                onClick={() => navigate(`/trade/stocks/${position.symbol}`)}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <span className="font-bold text-sm text-primary">
                                      {position.symbol.slice(0, 2)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-semibold">{position.symbol}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {Number(position.qty).toFixed(2)} shares @ {formatPrice(Number(position.avg_entry_price))}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">{formatPrice(Number(position.market_value) || 0)}</p>
                                  <p className={`text-sm ${Number(position.unrealized_pl || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    {Number(position.unrealized_pl || 0) >= 0 ? '+' : ''}{formatPrice(Number(position.unrealized_pl) || 0)} 
                                    ({(Number(position.unrealized_plpc || 0) * 100).toFixed(2)}%)
                                  </p>
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {cryptoPositions.length > 0 && (
                          <>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 pt-4">Crypto</p>
                            {cryptoPositions.map((position) => (
                              <div 
                                key={position.asset_id}
                                className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                                onClick={() => navigate(`/trade/crypto/${position.symbol.replace('/', '-')}`)}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                                    <span className="font-bold text-sm text-amber-600">
                                      {position.symbol.split('/')[0].slice(0, 3)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-semibold">{position.symbol}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {Number(position.qty).toFixed(6)} @ {formatPrice(Number(position.avg_entry_price))}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold">{formatPrice(Number(position.market_value) || 0)}</p>
                                  <p className={`text-sm ${Number(position.unrealized_pl || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    {Number(position.unrealized_pl || 0) >= 0 ? '+' : ''}{formatPrice(Number(position.unrealized_pl) || 0)} 
                                    ({(Number(position.unrealized_plpc || 0) * 100).toFixed(2)}%)
                                  </p>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allocation Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" /> Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Skeleton className="w-32 h-32 rounded-full" />
                </div>
              ) : pieData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatPrice(value)}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="font-medium">
                          {netWorth > 0 ? ((Number(item.value) / netWorth) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No data to display</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
