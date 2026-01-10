import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, TrendingDown, Briefcase, DollarSign,
  PieChart, ArrowRight
} from 'lucide-react';
import { useHoldings, useBalance } from '@/hooks/useTrading';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
  
  const { data: holdings, isLoading: holdingsLoading } = useHoldings();
  const { data: balance } = useBalance();

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

  // Calculate portfolio metrics
  const portfolioData = holdings?.map(holding => {
    const currentValue = holding.stocks ? Number(holding.quantity) * holding.stocks.current_price : 0;
    const costBasis = Number(holding.quantity) * Number(holding.average_cost);
    const gain = currentValue - costBasis;
    const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;
    
    return {
      ...holding,
      currentValue,
      costBasis,
      gain,
      gainPercent,
    };
  }) || [];

  const totalInvested = portfolioData.reduce((sum, h) => sum + h.costBasis, 0);
  const totalValue = portfolioData.reduce((sum, h) => sum + h.currentValue, 0);
  const totalGain = totalValue - totalInvested;
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const cashBalance = balance?.cash_balance || 0;
  const netWorth = totalValue + cashBalance;

  // Pie chart data
  const pieData = portfolioData.map((h, i) => ({
    name: h.stocks?.symbol || 'Unknown',
    value: h.currentValue,
    color: COLORS[i % COLORS.length],
  }));

  if (cashBalance > 0) {
    pieData.push({
      name: 'Cash',
      value: cashBalance,
      color: 'hsl(var(--muted-foreground))',
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        <BackButton />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <Button onClick={() => navigate('/trade')}>
            Trade <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Portfolio Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Net Worth</p>
              </div>
              <p className="text-2xl font-bold">{formatPrice(netWorth)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Invested</p>
              </div>
              <p className="text-2xl font-bold">{formatPrice(totalValue)}</p>
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
                <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
              </div>
              <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalGain >= 0 ? '+' : ''}{formatPrice(totalGain)}
              </p>
              <p className={`text-sm ${totalGain >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalGain >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Cash Available</p>
              </div>
              <p className="text-2xl font-bold">{formatPrice(cashBalance)}</p>
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
              {holdingsLoading ? (
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
              ) : portfolioData.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No holdings yet</p>
                  <Button onClick={() => navigate('/trade')}>Start Trading</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {portfolioData.map((holding) => (
                    <div 
                      key={holding.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                      onClick={() => navigate(`/trade/stocks/${holding.stocks?.symbol}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-bold text-sm text-primary">
                            {holding.stocks?.symbol.slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold">{holding.stocks?.symbol}</p>
                          <p className="text-sm text-muted-foreground">
                            {Number(holding.quantity).toFixed(2)} shares @ {formatPrice(Number(holding.average_cost))}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(holding.currentValue)}</p>
                        <p className={`text-sm ${holding.gain >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {holding.gain >= 0 ? '+' : ''}{formatPrice(holding.gain)} ({holding.gainPercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                  ))}
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
              {pieData.length > 0 ? (
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
                          {((item.value / netWorth) * 100).toFixed(1)}%
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
