import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { useUserRole } from '@/hooks/useUserRole';
import { MainNav } from '@/components/MainNav';
import { Footer } from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, TrendingUp, TrendingDown, Star, 
  Briefcase, Clock, BarChart3, Settings, Link2, AlertTriangle, Bot, Bitcoin
} from 'lucide-react';
import { useStocks, useWatchlist, Stock } from '@/hooks/useTrading';
import { useCryptoAssets, useCryptoWatchlist, CryptoAsset } from '@/hooks/useCryptoTrading';
import { useAlpacaAccount, useAlpacaPositions, useAlpacaSearch, AlpacaAsset, useAlpacaCryptoQuote } from '@/hooks/useAlpaca';
import { useBrokerageAccounts } from '@/hooks/useBrokerageAccounts';

import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
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

function StockRow({ stock, onClick, showChange = false }: { stock: Stock; onClick: () => void; showChange?: boolean }) {
  const priceChange = stock.previous_close 
    ? stock.current_price - stock.previous_close 
    : 0;
  const priceChangePercent = stock.previous_close 
    ? (priceChange / stock.previous_close) * 100 
    : 0;
  const isPositive = priceChange >= 0;
  const isPlausible = Math.abs(priceChangePercent) < 20;

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
        {showChange && stock.previous_close && isPlausible ? (
          <div className={`flex items-center justify-end gap-1 text-sm ${isPositive ? 'text-profit' : 'text-loss'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Click for live price</p>
        )}
      </div>
    </div>
  );
}

function CryptoRow({ crypto, onClick }: { crypto: CryptoAsset; onClick: () => void }) {
  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Bitcoin className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <p className="font-semibold">{crypto.symbol}</p>
          <p className="text-sm text-muted-foreground">{crypto.name}</p>
        </div>
      </div>
      <div className="text-right">
        {crypto.current_price > 0 ? (
          <p className="font-semibold">{formatPrice(crypto.current_price)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Click for live price</p>
        )}
      </div>
    </div>
  );
}

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
  const { isVerified } = useEmailVerified();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('explore');
  const [marketType, setMarketType] = useState<'stocks' | 'crypto'>(
    searchParams.get('market') === 'crypto' ? 'crypto' : 'stocks'
  );
  
  useEffect(() => {
    if (!roleLoading && userRole?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [userRole, roleLoading, navigate]);
  
  const { data: stocks, isLoading: stocksLoading } = useStocks(searchQuery);
  const { data: watchlist } = useWatchlist();
  const { data: cryptoAssets, isLoading: cryptoLoading } = useCryptoAssets(searchQuery);
  const { data: cryptoWatchlist } = useCryptoWatchlist();
  const { data: brokerageAccounts } = useBrokerageAccounts();
  const { data: alpacaAccount } = useAlpacaAccount();
  const { data: alpacaSearchResults, isLoading: alpacaSearchLoading } = useAlpacaSearch(searchQuery);

  const hasConnectedAccount = brokerageAccounts && brokerageAccounts.length > 0;
  const needsReconnect = alpacaAccount && 'needsReconnect' in alpacaAccount && alpacaAccount.needsReconnect;

  const portfolioValue = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.portfolio_value : 0;
  const cashAvailable = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.cash : 0;
  const investedValue = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.equity - alpacaAccount.cash : 0;
  const totalValue = hasConnectedAccount && alpacaAccount && !needsReconnect ? alpacaAccount.portfolio_value : 0;

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

  const navigateToCrypto = (symbol: string) => {
    // Convert BTC/USD to BTC-USD for URL
    navigate(`/trade/crypto/${symbol.replace('/', '-')}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        {user && !isVerified && <EmailVerificationBanner />}

        {user && isVerified && (
          <div className="mb-6 flex items-center justify-between">
            <Button onClick={() => navigate('/trade/ai-builder')} variant="outline" className="gap-2">
              <Bot className="h-4 w-4" /> AI Bot Builder
            </Button>
            <TradingModeToggle />
          </div>
        )}

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
                    <p className="text-muted-foreground">Your brokerage credentials need to be updated.</p>
                  </div>
                </div>
                <Button onClick={() => navigate('/settings/brokerage')} variant="destructive" size="lg">
                  <Settings className="mr-2 h-4 w-4" /> Reconnect Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {user && !needsReconnect && (
          hasConnectedAccount ? (
            <Card className="mb-6 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                  <p className="text-3xl font-bold">{formatPrice(totalValue)}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Cash Available</p>
                    <p className="text-base font-semibold">{formatPrice(cashAvailable)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Invested</p>
                    <p className="text-base font-semibold">{formatPrice(investedValue)}</p>
                  </div>
                  {alpacaAccount && !('needsReconnect' in alpacaAccount) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Buying Power</p>
                      <p className="text-base font-semibold">{formatPrice(alpacaAccount.buying_power)}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 bg-muted/50 rounded-lg p-1 overflow-x-auto">
                  <Button onClick={() => navigate('/trade/portfolio')} size="sm" className="shrink-0">
                    <Briefcase className="mr-2 h-4 w-4" /> Portfolio
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/trade/orders')} className="shrink-0">
                    <Clock className="mr-2 h-4 w-4" /> Orders
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/settings/brokerage')} className="shrink-0">
                    <Settings className="mr-2 h-4 w-4" /> Accounts
                  </Button>
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
                      <p className="text-muted-foreground">Link your Alpaca account to start trading stocks & crypto</p>
                    </div>
                  </div>
                  <Button data-tour="connect-brokerage-btn" onClick={() => navigate('/settings/brokerage')} size="lg">
                    <Settings className="mr-2 h-4 w-4" /> Connect Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {/* Market Type Tabs - Stocks / Crypto */}
        <div className="mb-4">
          <div className="inline-flex items-center rounded-lg border bg-card p-1">
            <Button
              variant={marketType === 'stocks' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMarketType('stocks')}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" /> Stocks
            </Button>
            <Button
              variant={marketType === 'crypto' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMarketType('crypto')}
              className="gap-2"
            >
              <Bitcoin className="h-4 w-4" /> Crypto
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-tour="stock-search-input"
            placeholder={marketType === 'stocks' ? 'Search any stock (e.g., AAPL, TSLA)...' : 'Search crypto (e.g., Bitcoin, ETH)...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
          {alpacaSearchLoading && marketType === 'stocks' && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* STOCKS VIEW */}
        {marketType === 'stocks' && (
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
                  {user && (
                    <div className="mb-6">
                      <PortfolioHistoryChart />
                    </div>
                  )}
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
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
                    {user ? (
                      <RecentTrades />
                    ) : null}
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
                        <StockRow key={stock.id} stock={stock} showChange onClick={() => navigate(`/trade/stocks/${stock.symbol}`)} />
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
                        <StockRow key={stock.id} stock={stock} showChange onClick={() => navigate(`/trade/stocks/${stock.symbol}`)} />
                      ))
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">No losers today</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* CRYPTO VIEW */}
        {marketType === 'crypto' && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <Card className="p-1">
              <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex bg-transparent">
                <TabsTrigger value="explore" className="gap-2">
                  <Bitcoin className="h-4 w-4" /> All Crypto
                </TabsTrigger>
                <TabsTrigger value="watchlist" className="gap-2">
                  <Star className="h-4 w-4" /> Watchlist
                  {cryptoWatchlist && cryptoWatchlist.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{cryptoWatchlist.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Card>

            <TabsContent value="explore" className="space-y-6">
              {/* Portfolio chart also visible on crypto */}
              {user && (
                <div className="mb-6">
                  <PortfolioHistoryChart />
                </div>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bitcoin className="h-5 w-5" /> Crypto Assets
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">24/7</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                  {cryptoLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                  ) : cryptoAssets && cryptoAssets.length > 0 ? (
                    cryptoAssets.map(crypto => (
                      <CryptoRow 
                        key={crypto.id} 
                        crypto={crypto} 
                        onClick={() => navigateToCrypto(crypto.symbol)}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">No crypto assets found</div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="watchlist">
              <Card>
                <CardHeader>
                  <CardTitle>Crypto Watchlist</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!user ? (
                    <div className="p-8 text-center">
                      <p className="text-muted-foreground mb-4">Sign in to create a watchlist</p>
                      <Button onClick={() => navigate('/auth')}>Sign In</Button>
                    </div>
                  ) : cryptoWatchlist && cryptoWatchlist.length > 0 ? (
                    cryptoWatchlist.map(item => item.crypto_assets && (
                      <CryptoRow 
                        key={item.id} 
                        crypto={item.crypto_assets} 
                        onClick={() => navigateToCrypto(item.crypto_assets!.symbol)}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Your crypto watchlist is empty</p>
                      <p className="text-sm mt-1">Add crypto assets to track them here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
      <Footer />
    </div>
  );
}
