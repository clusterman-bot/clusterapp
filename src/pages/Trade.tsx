import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, TrendingUp, TrendingDown, Star, 
  Briefcase, Clock, BarChart3
} from 'lucide-react';
import { useStocks, useHoldings, useWatchlist, useBalance, Stock } from '@/hooks/useTrading';
import { useAlpacaAccount, useAlpacaPositions } from '@/hooks/useAlpaca';
import { LivePriceUpdates } from '@/components/LivePriceUpdates';
import { TradingModeToggle, TradingModeIndicator } from '@/components/TradingModeToggle';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString();
}

function StockRow({ stock, onClick }: { stock: Stock; onClick: () => void }) {
  const priceChange = stock.previous_close 
    ? stock.current_price - stock.previous_close 
    : 0;
  const priceChangePercent = stock.previous_close 
    ? (priceChange / stock.previous_close) * 100 
    : 0;
  const isPositive = priceChange >= 0;

  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="font-bold text-sm text-primary">{stock.symbol.slice(0, 2)}</span>
        </div>
        <div>
          <p className="font-semibold">{stock.symbol}</p>
          <p className="text-sm text-muted-foreground">{stock.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold">{formatPrice(stock.current_price)}</p>
        <div className={`flex items-center justify-end gap-1 text-sm ${isPositive ? 'text-profit' : 'text-loss'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function Trade() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('explore');
  
  const { data: stocks, isLoading: stocksLoading } = useStocks(searchQuery);
  const { data: holdings } = useHoldings();
  const { data: watchlist } = useWatchlist();
  const { data: balance } = useBalance();
  const { data: alpacaAccount, isLoading: alpacaLoading } = useAlpacaAccount();
  const { data: alpacaPositions } = useAlpacaPositions();

  // Use Alpaca account data if available, otherwise fall back to local balance
  const portfolioValue = alpacaAccount 
    ? alpacaAccount.portfolio_value 
    : holdings?.reduce((total, holding) => {
        const currentValue = holding.stocks ? Number(holding.quantity) * holding.stocks.current_price : 0;
        return total + currentValue;
      }, 0) || 0;

  const cashAvailable = alpacaAccount ? alpacaAccount.cash : (balance?.cash_balance || 0);
  const investedValue = alpacaAccount ? alpacaAccount.equity - alpacaAccount.cash : portfolioValue;
  const totalValue = alpacaAccount ? alpacaAccount.portfolio_value : (balance?.cash_balance || 0) + portfolioValue;

  // Group stocks by sector
  const topGainers = stocks?.filter(s => s.previous_close && s.current_price > s.previous_close)
    .sort((a, b) => {
      const aChange = ((a.current_price - (a.previous_close || 0)) / (a.previous_close || 1));
      const bChange = ((b.current_price - (b.previous_close || 0)) / (b.previous_close || 1));
      return bChange - aChange;
    }).slice(0, 5) || [];

  const topLosers = stocks?.filter(s => s.previous_close && s.current_price < s.previous_close)
    .sort((a, b) => {
      const aChange = ((a.current_price - (a.previous_close || 0)) / (a.previous_close || 1));
      const bChange = ((b.current_price - (b.previous_close || 0)) / (b.previous_close || 1));
      return aChange - bChange;
    }).slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        {/* Trading Mode Toggle */}
        {user && (
          <div className="mb-6 flex justify-end">
            <TradingModeToggle />
          </div>
        )}

        {/* Portfolio Summary */}
        {user && (
          <Card className="mb-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                  <p className="text-3xl font-bold">{formatPrice(totalValue)}</p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Cash Available</p>
                    <p className="text-xl font-semibold">{formatPrice(cashAvailable)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Invested</p>
                    <p className="text-xl font-semibold">{formatPrice(investedValue)}</p>
                  </div>
                  {alpacaAccount && (
                    <div>
                      <p className="text-sm text-muted-foreground">Buying Power</p>
                      <p className="text-xl font-semibold">{formatPrice(alpacaAccount.buying_power)}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => navigate('/trade/portfolio')}>
                    <Briefcase className="mr-2 h-4 w-4" /> Portfolio
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/trade/orders')}>
                    <Clock className="mr-2 h-4 w-4" /> Orders
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search stocks by name or symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="explore" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Explore
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-2">
              <Star className="h-4 w-4" /> Watchlist
              {watchlist && watchlist.length > 0 && (
                <Badge variant="secondary" className="ml-1">{watchlist.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="movers" className="gap-2">
              <TrendingUp className="h-4 w-4" /> Movers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6">
            {searchQuery ? (
              <Card>
                <CardHeader>
                  <CardTitle>Search Results</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {stocksLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Searching...</div>
                  ) : stocks && stocks.length > 0 ? (
                    stocks.map(stock => (
                      <StockRow 
                        key={stock.id} 
                        stock={stock} 
                        onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">No stocks found</div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* All Stocks */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>All Stocks</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                    {stocksLoading ? (
                      <div className="p-8 text-center text-muted-foreground">Loading...</div>
                    ) : stocks?.map(stock => (
                      <StockRow 
                        key={stock.id} 
                        stock={stock} 
                        onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
                      />
                    ))}
                  </CardContent>
                </Card>

                {/* Live Prices & Quick Stats */}
                <div className="space-y-6">
                  <LivePriceUpdates />
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Market Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Stocks</span>
                        <span className="font-semibold">{stocks?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gainers</span>
                        <span className="font-semibold text-profit">{topGainers.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Losers</span>
                        <span className="font-semibold text-loss">{topLosers.length}</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {user && watchlist && watchlist.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Your Watchlist</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {watchlist.slice(0, 3).map(item => item.stocks && (
                          <StockRow 
                            key={item.id} 
                            stock={item.stocks} 
                            onClick={() => navigate(`/trade/stocks/${item.stocks?.symbol}`)}
                          />
                        ))}
                        {watchlist.length > 3 && (
                          <Button 
                            variant="ghost" 
                            className="w-full" 
                            onClick={() => setActiveTab('watchlist')}
                          >
                            View all {watchlist.length} items
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="watchlist">
            <Card>
              <CardHeader>
                <CardTitle>Your Watchlist</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!user ? (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground mb-4">Sign in to create a watchlist</p>
                    <Button onClick={() => navigate('/auth')}>Sign In</Button>
                  </div>
                ) : watchlist && watchlist.length > 0 ? (
                  watchlist.map(item => item.stocks && (
                    <StockRow 
                      key={item.id} 
                      stock={item.stocks} 
                      onClick={() => navigate(`/trade/stocks/${item.stocks?.symbol}`)}
                    />
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Your watchlist is empty</p>
                    <p className="text-sm mt-1">Add stocks to track them here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="movers">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-profit">
                    <TrendingUp className="h-5 w-5" /> Top Gainers
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topGainers.length > 0 ? (
                    topGainers.map(stock => (
                      <StockRow 
                        key={stock.id} 
                        stock={stock} 
                        onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">No gainers today</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-loss">
                    <TrendingDown className="h-5 w-5" /> Top Losers
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topLosers.length > 0 ? (
                    topLosers.map(stock => (
                      <StockRow 
                        key={stock.id} 
                        stock={stock} 
                        onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">No losers today</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
