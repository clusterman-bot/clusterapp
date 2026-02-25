import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEmailVerified } from '@/hooks/useEmailVerified';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { MainNav } from '@/components/MainNav';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff, Bitcoin, Activity, Zap } from 'lucide-react';
import { useCryptoBySymbol, useIsCryptoInWatchlist, useAddToCryptoWatchlist, useRemoveFromCryptoWatchlist } from '@/hooks/useCryptoTrading';
import { useAlpacaCryptoQuote } from '@/hooks/useAlpaca';
import { TradingModeToggle } from '@/components/TradingModeToggle';
import { AdvancedChart } from '@/components/trade/AdvancedChart';
import { CryptoTradePanel } from '@/components/trade/CryptoTradePanel';
import { QuickBuildPanel } from '@/components/stock/QuickBuildPanel';

export default function CryptoDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const { user } = useAuth();
  const { isVerified } = useEmailVerified();
  const navigate = useNavigate();

  // Symbol comes as BTC-USD from URL, convert to BTC/USD for API
  const apiSymbol = symbol?.replace('-', '/');
  
  const { data: dbCrypto, isLoading: dbLoading } = useCryptoBySymbol(apiSymbol);
  const { data: cryptoQuote, isLoading: quoteLoading } = useAlpacaCryptoQuote(apiSymbol);

  const isLoading = dbLoading || quoteLoading;

  const livePrice = cryptoQuote?.price ?? dbCrypto?.current_price ?? 0;

  const { data: isInWatchlist } = useIsCryptoInWatchlist(dbCrypto?.id);
  const addToWatchlist = useAddToCryptoWatchlist();
  const removeFromWatchlist = useRemoveFromCryptoWatchlist();

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

  const cryptoName = dbCrypto?.name || apiSymbol?.split('/')[0] || 'Crypto';
  const displaySymbol = apiSymbol || '';

  const toggleWatchlist = () => {
    if (!dbCrypto) return;
    if (isInWatchlist) removeFromWatchlist.mutate(dbCrypto.id);
    else addToWatchlist.mutate(dbCrypto.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/trade?market=crypto')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Bitcoin className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{displaySymbol}</h1>
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">Crypto</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{cryptoName}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && isVerified && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/trade/crypto/${symbol}/automate`)}>
                <Activity className="mr-2 h-4 w-4" /> Automate
              </Button>
            )}
            {user && isVerified && (
              <Button variant="outline" size="sm" onClick={() => {
                const el = document.getElementById('quick-build-panel');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}>
                <Zap className="mr-2 h-4 w-4" /> Quick Build
              </Button>
            )}
            {user && isVerified && dbCrypto && (
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
              symbol={displaySymbol}
              currentPrice={livePrice}
              previousClose={dbCrypto?.previous_close || 0}
              dayHigh={dbCrypto?.day_high}
              dayLow={dbCrypto?.day_low}
              isCrypto
            />
          </div>
          {isVerified && (
            <div>
              <CryptoTradePanel
                symbol={displaySymbol}
                cryptoAssetId={dbCrypto?.id || ''}
                currentPrice={livePrice}
              />
            </div>
          )}
        </div>

        {/* Quick Build Panel */}
        {user && isVerified && (
          <div id="quick-build-panel">
            <QuickBuildPanel symbol={displaySymbol} isCrypto />
          </div>
        )}
      </main>
    </div>
  );
}
