import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useStocks, Stock } from '@/hooks/useTrading';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

interface LiveStock extends Stock {
  livePrice: number;
  priceChange: number;
  priceChangePercent: number;
  lastUpdate: number;
  animationDirection: 'up' | 'down' | null;
}

export function LivePriceUpdates() {
  const navigate = useNavigate();
  const { data: stocks } = useStocks();
  const [liveStocks, setLiveStocks] = useState<LiveStock[]>([]);

  // Initialize live stocks from fetched data
  useEffect(() => {
    if (stocks && stocks.length > 0) {
      setLiveStocks(stocks.slice(0, 8).map(stock => ({
        ...stock,
        livePrice: stock.current_price,
        priceChange: stock.previous_close ? stock.current_price - stock.previous_close : 0,
        priceChangePercent: stock.previous_close 
          ? ((stock.current_price - stock.previous_close) / stock.previous_close) * 100 
          : 0,
        lastUpdate: Date.now(),
        animationDirection: null,
      })));
    }
  }, [stocks]);

  // Simulate live price updates
  useEffect(() => {
    if (liveStocks.length === 0) return;

    const interval = setInterval(() => {
      setLiveStocks(prev => {
        // Randomly update 1-3 stocks
        const numUpdates = Math.floor(Math.random() * 3) + 1;
        const indicesToUpdate = new Set<number>();
        
        while (indicesToUpdate.size < numUpdates && indicesToUpdate.size < prev.length) {
          indicesToUpdate.add(Math.floor(Math.random() * prev.length));
        }

        return prev.map((stock, index) => {
          if (!indicesToUpdate.has(index)) {
            return { ...stock, animationDirection: null };
          }

          // Generate small random price change (-0.5% to +0.5%)
          const changePercent = (Math.random() - 0.5) * 0.01;
          const newPrice = stock.livePrice * (1 + changePercent);
          const previousClose = stock.previous_close || stock.current_price;
          const newPriceChange = newPrice - previousClose;
          const newPriceChangePercent = (newPriceChange / previousClose) * 100;
          const direction = newPrice > stock.livePrice ? 'up' : 'down';

          return {
            ...stock,
            livePrice: newPrice,
            priceChange: newPriceChange,
            priceChangePercent: newPriceChangePercent,
            lastUpdate: Date.now(),
            animationDirection: direction,
          };
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [liveStocks.length]);

  if (liveStocks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          Live Prices
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            Real-time
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {liveStocks.map((stock) => {
            const isPositive = stock.priceChangePercent >= 0;
            
            return (
              <div
                key={stock.id}
                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all hover:bg-muted/50 ${
                  stock.animationDirection === 'up' 
                    ? 'animate-pulse-profit bg-profit/5' 
                    : stock.animationDirection === 'down' 
                    ? 'animate-pulse-loss bg-loss/5' 
                    : ''
                }`}
                onClick={() => navigate(`/trade/stocks/${stock.symbol}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-xs text-primary">
                      {stock.symbol.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {stock.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm tabular-nums ${
                    stock.animationDirection === 'up' ? 'text-profit' : 
                    stock.animationDirection === 'down' ? 'text-loss' : ''
                  }`}>
                    {formatPrice(stock.livePrice)}
                  </p>
                  <div className={`flex items-center justify-end gap-1 text-xs ${
                    isPositive ? 'text-profit' : 'text-loss'
                  }`}>
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="tabular-nums">
                      {isPositive ? '+' : ''}{stock.priceChangePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
