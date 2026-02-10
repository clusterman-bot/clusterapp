import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, StarOff } from 'lucide-react';
import { useStockBySymbol, useIsInWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from '@/hooks/useTrading';
import { TradingModeToggle } from '@/components/TradingModeToggle';
import { AdvancedChart } from '@/components/trade/AdvancedChart';
import { QuickTradePanel } from '@/components/trade/QuickTradePanel';

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: stock, isLoading } = useStockBySymbol(symbol);
  const { data: isInWatchlist } = useIsInWatchlist(stock?.id);
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
    if (!stock) return;
    if (isInWatchlist) removeFromWatchlist.mutate(stock.id);
    else addToWatchlist.mutate(stock.id);
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
            {user && (
              <Button variant="outline" size="icon" onClick={toggleWatchlist}>
                {isInWatchlist ? <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> : <StarOff className="h-4 w-4" />}
              </Button>
            )}
            {user && <TradingModeToggle />}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <AdvancedChart 
              symbol={stock.symbol}
              currentPrice={stock.current_price}
              previousClose={stock.previous_close || stock.current_price}
              dayHigh={stock.day_high}
              dayLow={stock.day_low}
            />
          </div>
          <div>
            <QuickTradePanel 
              symbol={stock.symbol}
              stockId={stock.id}
              currentPrice={stock.current_price}
              dayHigh={stock.day_high}
              dayLow={stock.day_low}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
