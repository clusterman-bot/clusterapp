import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { MainNav } from '@/components/MainNav';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, TrendingUp, TrendingDown, Star, 
  Briefcase, Clock, BarChart3, Settings, Link2, AlertTriangle
} from 'lucide-react';
import { useStocks, useWatchlist, Stock } from '@/hooks/useTrading';
import { useAlpacaAccount, useAlpacaPositions, useAlpacaSearch, AlpacaAsset } from '@/hooks/useAlpaca';
import { useBrokerageAccounts } from '@/hooks/useBrokerageAccounts';
import { LivePriceUpdates } from '@/components/LivePriceUpdates';
import { TradingModeToggle } from '@/components/TradingModeToggle';
import { RecentTrades } from '@/components/trade/RecentTrades';
import { PortfolioHistoryChart } from '@/components/trade/PortfolioHistoryChart';
import { Loader2 } from 'lucide-react';

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

// Component for Alpaca asset search results
function AlpacaAssetRow({ asset, onClick }: { asset: AlpacaAsset; onClick: () => void }) {
  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="font-bold text-sm text-primary">{asset.symbol.slice(0, 2)}</span>
        </div>
        <div>
          <p className="font-semibold">{asset.symbol}</p>
          <p className="text-sm text-muted-foreground line-clamp-1">{asset.name}</p>
        </div>
      </div>
      <div className="text-right">
        <Badge variant="outline" className="text-xs">{asset.exchange}</Badge>
        {asset.fractionable && (
          <p className="text-xs text-muted-foreground mt-1">Fractional</p>
        )}
      </div>
    </div>
  );
}

export default function Trade() {
  const { user } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('explore');
  
  // Redirect admins away from trade page
  useEffect(() => {
    if (!roleLoading && userRole?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [userRole, roleLoading, navigate]);
  
  const { data: stocks, isLoading: stocksLoading } = useStocks(searchQuery);
  const { data: watchlist } = useWatchlist();
  const { data: brokerageAccounts } = useBrokerageAccounts();
  const { data: alpacaAccount } = useAlpacaAccount();
  const { data: alpacaSearchResults, isLoading: alpacaSearchLoading } = useAlpacaSearch(searchQuery);

  // Check if user has connected a brokerage account
  const hasConnectedAccount = brokerageAccounts && brokerageAccounts.length > 0;
  
  // Check if credentials need to be reconnected
  const needsReconnect = alpacaAccount && 'needsReconnect' in alpacaAccount && alpacaAccount.needsReconnect;

  // Only show portfolio data if user has connected their own account and credentials are valid
  const portfolioValue = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.portfolio_value : 0;
  const cashAvailable = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.cash : 0;
  const investedValue = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.equity - alpacaAccount.cash : 0;
  const totalValue = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.portfolio_value : 0;

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

        {/* Reconnect Warning */}
        {user && hasConnectedAccount && needsReconnect && (
          <Card className="mb-6 border-2 border-destructive/50 bg-destructive/5">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Brokerage Reconnection Required</h3>
                    <p className="text-muted-foreground">Your brokerage credentials need to be updated. Please reconnect your Alpaca account to continue trading.</p>
                  </div>
                </div>
                <Button onClick={() => navigate('/settings/brokerage')} variant="destructive" size="lg">
                  <Settings className="mr-2 h-4 w-4" /> Reconnect Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portfolio Summary or Connect Prompt */}
        {user && !needsReconnect && (
          hasConnectedAccount ? (
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
                    {alpacaAccount && !('needsReconnect' in alpacaAccount) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Buying Power</p>
                        <p className="text-xl font-semibold">{formatPrice(alpacaAccount.buying_power)}</p>
                      </div>
                    )}
                  </div>
                    <div className="flex gap-2 bg-muted/50 rounded-lg p-1">
                      <Button onClick={() => navigate('/trade/portfolio')} size="sm">
                        <Briefcase className="mr-2 h-4 w-4" /> Portfolio
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/trade/orders')}>
                        <Clock className="mr-2 h-4 w-4" /> Orders
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate('/settings/brokerage')}>
                        <Settings className="mr-2 h-4 w-4" /> Accounts
                      </Button>
                    </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 border-dashed border-2 border-primary/30 bg-primary/5">
              <CardContent className="py-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Link2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Connect Your Brokerage</h3>
                      <p className="text-muted-foreground">Link your Alpaca account to start trading with real or paper money</p>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/settings/brokerage')} size="lg">
                    <Settings className="mr-2 h-4 w-4" /> Connect Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search any stock (e.g., AAPL, TSLA, MSFT)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
          {alpacaSearchLoading && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <Card className="p-1">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex bg-transparent">
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
          </Card>

          <TabsContent value="explore" className="space-y-6">
            {searchQuery ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Search Results
                    {alpacaSearchResults && (
                      <Badge variant="secondary">{alpacaSearchResults.length} stocks</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                  {alpacaSearchLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Searching all markets...
                    </div>
                  ) : alpacaSearchResults && alpacaSearchResults.length > 0 ? (
                    alpacaSearchResults.map(asset => (
                      <AlpacaAssetRow 
                        key={asset.symbol} 
                        asset={asset} 
                        onClick={() => navigate(`/trade/stocks/${asset.symbol}`)}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      No stocks found for "{searchQuery}"
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Portfolio Chart and Recent Trades - Only show for logged in users */}
                {user && (
                  <div className="grid gap-6 md:grid-cols-2 mb-6">
                    <PortfolioHistoryChart />
                    <RecentTrades />
                  </div>
                )}
                
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
              </>
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
