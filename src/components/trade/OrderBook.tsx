import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, BookOpen } from 'lucide-react';

interface OrderBookProps {
  currentPrice: number;
  symbol: string;
}

interface OrderLevel {
  price: number;
  size: number;
  total: number;
  percentage: number;
}

function generateOrderBook(currentPrice: number): { bids: OrderLevel[]; asks: OrderLevel[] } {
  const levels = 12;
  const spread = currentPrice * 0.001;
  
  const bids: OrderLevel[] = [];
  const asks: OrderLevel[] = [];
  
  let bidTotal = 0;
  let askTotal = 0;
  
  for (let i = 0; i < levels; i++) {
    const bidSize = Math.floor(100 + Math.random() * 5000);
    const askSize = Math.floor(100 + Math.random() * 5000);
    
    bidTotal += bidSize;
    askTotal += askSize;
    
    bids.push({
      price: currentPrice - spread * (i + 1),
      size: bidSize,
      total: bidTotal,
      percentage: 0,
    });
    
    asks.push({
      price: currentPrice + spread * (i + 1),
      size: askSize,
      total: askTotal,
      percentage: 0,
    });
  }
  
  // Calculate percentages
  const maxTotal = Math.max(bidTotal, askTotal);
  bids.forEach(b => b.percentage = (b.total / maxTotal) * 100);
  asks.forEach(a => a.percentage = (a.total / maxTotal) * 100);
  
  return { bids, asks: asks.reverse() };
}

function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function OrderBook({ currentPrice, symbol }: OrderBookProps) {
  const { bids, asks } = useMemo(() => generateOrderBook(currentPrice), [currentPrice]);
  
  const spread = asks[asks.length - 1]?.price - bids[0]?.price || 0;
  const spreadPercent = (spread / currentPrice) * 100;
  
  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Order Book
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            Spread: ${spread.toFixed(2)} ({spreadPercent.toFixed(3)}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="book">
          <TabsList className="w-full bg-muted/50 mb-4">
            <TabsTrigger value="book" className="flex-1 text-xs">Order Book</TabsTrigger>
            <TabsTrigger value="depth" className="flex-1 text-xs">Depth Chart</TabsTrigger>
          </TabsList>
          
          <TabsContent value="book" className="mt-0">
            {/* Header */}
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-2 px-2">
              <span>Price</span>
              <span className="text-right">Size</span>
              <span className="text-right">Total</span>
            </div>
            
            {/* Asks (Sell Orders) */}
            <div className="space-y-0.5 mb-2">
              {asks.map((ask, i) => (
                <div 
                  key={i} 
                  className="relative grid grid-cols-3 gap-2 text-xs py-1 px-2 rounded"
                >
                  <div 
                    className="absolute inset-0 bg-loss/10 rounded"
                    style={{ width: `${ask.percentage}%`, right: 0, left: 'auto' }}
                  />
                  <span className="relative text-loss font-mono">${ask.price.toFixed(2)}</span>
                  <span className="relative text-right font-mono">{formatNumber(ask.size)}</span>
                  <span className="relative text-right font-mono text-muted-foreground">{formatNumber(ask.total)}</span>
                </div>
              ))}
            </div>
            
            {/* Current Price */}
            <div className="py-2 text-center border-y border-border bg-muted/30">
              <span className="text-lg font-bold font-mono">${currentPrice.toFixed(2)}</span>
            </div>
            
            {/* Bids (Buy Orders) */}
            <div className="space-y-0.5 mt-2">
              {bids.map((bid, i) => (
                <div 
                  key={i} 
                  className="relative grid grid-cols-3 gap-2 text-xs py-1 px-2 rounded"
                >
                  <div 
                    className="absolute inset-0 bg-profit/10 rounded"
                    style={{ width: `${bid.percentage}%` }}
                  />
                  <span className="relative text-profit font-mono">${bid.price.toFixed(2)}</span>
                  <span className="relative text-right font-mono">{formatNumber(bid.size)}</span>
                  <span className="relative text-right font-mono text-muted-foreground">{formatNumber(bid.total)}</span>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="depth" className="mt-0">
            {/* Simple Depth Visualization */}
            <div className="h-[300px] flex items-end justify-center gap-0.5 px-4">
              {/* Bids Side */}
              <div className="flex-1 flex items-end justify-end gap-0.5">
                {[...bids].reverse().map((bid, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-profit/30 rounded-t transition-all hover:bg-profit/50"
                    style={{ height: `${bid.percentage}%`, minHeight: '4px' }}
                    title={`$${bid.price.toFixed(2)} - ${bid.size} shares`}
                  />
                ))}
              </div>
              
              {/* Center Line */}
              <div className="w-1 h-full bg-border" />
              
              {/* Asks Side */}
              <div className="flex-1 flex items-end justify-start gap-0.5">
                {asks.map((ask, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-loss/30 rounded-t transition-all hover:bg-loss/50"
                    style={{ height: `${ask.percentage}%`, minHeight: '4px' }}
                    title={`$${ask.price.toFixed(2)} - ${ask.size} shares`}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground mt-2 px-4">
              <span className="text-profit">Bids (Buy)</span>
              <span className="text-loss">Asks (Sell)</span>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
