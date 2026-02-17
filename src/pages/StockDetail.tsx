import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff, Activity } from 'lucide-react';
import { useStockBySymbol, useIsInWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from '@/hooks/useTrading';
import { useAlpacaQuote, useAlpacaAssetInfo } from '@/hooks/useAlpaca';
import { TradingModeToggle } from '@/components/TradingModeToggle';
import { AdvancedChart } from '@/components/trade/AdvancedChart';
import { QuickTradePanel } from '@/components/trade/QuickTradePanel';

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const { user } = useAuth();
  const { isVerified } = useEmailVerified();
  const navigate = useNavigate();

  const { data: dbStock, isLoading: dbLoading } = useStockBySymbol(symbol);

  // Always fetch live quote for accurate pricing
  const { data: alpacaQuote, isLoading: quoteLoading } = useAlpacaQuote(symbol);
  // Asset info only needed when symbol isn't in local DB
  const { data: alpacaAsset, isLoading: assetLoading } = useAlpacaAssetInfo(!dbStock ? symbol : undefined);

  const isLoading = dbLoading || (!dbStock && !alpacaQuote && (quoteLoading || assetLoading));

  // Build a unified stock object from whichever source has data
  const stock = dbStock
    ? dbStock
    : alpacaQuote
      ? {
          id: '', // no local id
          symbol: symbol!.toUpperCase(),
          name: alpacaAsset?.name || symbol!.toUpperCase(),
          current_price: alpacaQuote.price,
          previous_close: alpacaQuote.price,
          day_high: null as number | null,
          day_low: null as number | null,
          sector: alpacaAsset?.exchange || null,
        }
      : null;

  // Live price: prefer Alpaca quote, fall back to DB price
  const livePrice = alpacaQuote?.price ?? stock?.current_price ?? 0;

  const { data: isInWatchlist } = useIsInWatchlist(dbStock?.id);
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-[400px] bg-muted rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <BackButton />
          <div className="text-center py-16">
            <p className="text-muted-foreground">Stock not found</p>
            <Button onClick={() => navigate('/trade')} className="mt-4">Back to Trading</Button>
          </div>
        </main>
      </div>
    );
  }

  const toggleWatchlist = () => {
    if (!dbStock) return; // watchlist only works for DB stocks
    if (isInWatchlist) removeFromWatchlist.mutate(dbStock.id);
    else addToWatchlist.mutate(dbStock.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="font-bold text-primary">{stock.symbol.slice(0, 2)}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{stock.symbol}</h1>
                  {stock.sector && <Badge variant="outline" className="text-xs">{stock.sector}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{stock.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && isVerified && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/trade/stocks/${stock.symbol}/automate`)}>
                <Activity className="mr-2 h-4 w-4" /> Automate
              </Button>
            )}
            {user && isVerified && dbStock && (
              <Button variant="outline" size="icon" onClick={toggleWatchlist}>
                {isInWatchlist ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> : <StarOff className="h-4 w-4" />}
              </Button>
            )}
            {user && isVerified && <TradingModeToggle />}
          </div>
        </div>

        {/* Email verification banner */}
        {user && !isVerified && <EmailVerificationBanner />}

        {/* Main Grid */}
        <div className={`grid grid-cols-1 ${isVerified ? 'lg:grid-cols-4' : ''} gap-4`}>
          <div className={isVerified ? 'lg:col-span-3' : ''}>
            <AdvancedChart
              symbol={stock.symbol}
              currentPrice={livePrice}
              previousClose={stock.previous_close || livePrice}
              dayHigh={stock.day_high}
              dayLow={stock.day_low}
            />
          </div>
          {isVerified && (
            <div>
              <QuickTradePanel
                symbol={stock.symbol}
                stockId={stock.id}
                currentPrice={livePrice}
                dayHigh={stock.day_high}
                dayLow={stock.day_low}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
