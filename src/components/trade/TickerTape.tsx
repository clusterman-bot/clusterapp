import { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

const mockTickers: TickerItem[] = [
  { symbol: 'AAPL', price: 178.52, change: 2.34, changePercent: 1.33 },
  { symbol: 'MSFT', price: 378.91, change: -1.23, changePercent: -0.32 },
  { symbol: 'GOOGL', price: 141.80, change: 3.45, changePercent: 2.49 },
  { symbol: 'AMZN', price: 178.25, change: -0.87, changePercent: -0.49 },
  { symbol: 'NVDA', price: 495.22, change: 12.45, changePercent: 2.58 },
  { symbol: 'META', price: 505.95, change: 8.32, changePercent: 1.67 },
  { symbol: 'TSLA', price: 248.50, change: -5.67, changePercent: -2.23 },
  { symbol: 'BRK.B', price: 362.15, change: 1.23, changePercent: 0.34 },
  { symbol: 'JPM', price: 195.42, change: 0.98, changePercent: 0.50 },
  { symbol: 'V', price: 279.80, change: -1.45, changePercent: -0.52 },
  { symbol: 'UNH', price: 524.30, change: 4.56, changePercent: 0.88 },
  { symbol: 'JNJ', price: 156.78, change: -0.23, changePercent: -0.15 },
  { symbol: 'XOM', price: 104.56, change: 2.12, changePercent: 2.07 },
  { symbol: 'WMT', price: 165.89, change: 1.34, changePercent: 0.81 },
  { symbol: 'PG', price: 159.45, change: -0.89, changePercent: -0.56 },
];

function TickerItemDisplay({ ticker }: { ticker: TickerItem }) {
  const isPositive = ticker.change >= 0;
  
  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 whitespace-nowrap">
      <span className="font-bold text-sm">{ticker.symbol}</span>
      <span className="font-mono text-sm">${ticker.price.toFixed(2)}</span>
      <span className={`flex items-center gap-1 text-xs ${isPositive ? 'text-profit' : 'text-loss'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isPositive ? '+' : ''}{ticker.changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

export function TickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tickers, setTickers] = useState<TickerItem[]>(mockTickers);
  
  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTickers(prev => prev.map(ticker => {
        const priceChange = (Math.random() - 0.5) * ticker.price * 0.002;
        const newPrice = Math.max(0.01, ticker.price + priceChange);
        const newChange = ticker.change + priceChange;
        const newChangePercent = (newChange / (ticker.price - ticker.change)) * 100;
        
        return {
          ...ticker,
          price: newPrice,
          change: newChange,
          changePercent: newChangePercent,
        };
      }));
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="w-full overflow-hidden bg-card/80 backdrop-blur-sm border-y border-border">
      <div 
        ref={containerRef}
        className="flex animate-ticker"
        style={{
          animationDuration: '60s',
        }}
      >
        {/* Double the tickers for seamless loop */}
        {[...tickers, ...tickers].map((ticker, i) => (
          <TickerItemDisplay key={`${ticker.symbol}-${i}`} ticker={ticker} />
        ))}
      </div>
      
      <style>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .animate-ticker {
          animation: ticker linear infinite;
        }
        
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
