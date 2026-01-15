import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, BarChart3, Volume2, 
  DollarSign, Activity, Calendar, Clock
} from 'lucide-react';

interface MarketStatsProps {
  currentPrice: number;
  previousClose: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  marketCap?: number;
  avgVolume?: number;
}

function formatNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

export function MarketStats({ 
  currentPrice, 
  previousClose, 
  dayHigh = currentPrice * 1.02, 
  dayLow = currentPrice * 0.98,
  volume = 15000000,
  marketCap = 2800000000000,
  avgVolume = 12000000,
}: MarketStatsProps) {
  const priceChange = currentPrice - previousClose;
  const priceChangePercent = previousClose > 0 ? (priceChange / previousClose) * 100 : 0;
  const isPositive = priceChange >= 0;
  
  // Calculate day range position
  const dayRange = dayHigh - dayLow;
  const dayRangePosition = dayRange > 0 ? ((currentPrice - dayLow) / dayRange) * 100 : 50;
  
  // Mock data
  const weekHigh = currentPrice * 1.15;
  const weekLow = currentPrice * 0.85;
  const yearHigh = currentPrice * 1.35;
  const yearLow = currentPrice * 0.65;
  const peRatio = 25 + Math.random() * 15;
  const eps = currentPrice / peRatio;
  const dividend = Math.random() > 0.3 ? (Math.random() * 2).toFixed(2) : null;
  const beta = (0.8 + Math.random() * 0.8).toFixed(2);
  
  const stats = [
    { label: 'Previous Close', value: `$${previousClose.toFixed(2)}`, icon: Clock },
    { label: 'Open', value: `$${(previousClose * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2)}`, icon: Calendar },
    { label: 'Volume', value: formatNumber(volume), icon: Volume2 },
    { label: 'Avg. Volume', value: formatNumber(avgVolume), icon: BarChart3 },
    { label: 'Market Cap', value: formatNumber(marketCap), icon: DollarSign },
    { label: 'P/E Ratio', value: peRatio.toFixed(2), icon: Activity },
    { label: 'EPS', value: `$${eps.toFixed(2)}`, icon: TrendingUp },
    { label: 'Beta', value: beta, icon: Activity },
  ];
  
  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Market Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Day's Range */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Day's Range</span>
            <span className="font-mono">${dayLow.toFixed(2)} - ${dayHigh.toFixed(2)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-gradient-to-r from-loss via-muted to-profit overflow-hidden">
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-background shadow-lg"
              style={{ left: `calc(${dayRangePosition}% - 6px)` }}
            />
          </div>
        </div>
        
        {/* 52 Week Range */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">52 Week Range</span>
            <span className="font-mono">${yearLow.toFixed(2)} - ${yearHigh.toFixed(2)}</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-primary/30 rounded-full"
              style={{ width: `${((currentPrice - yearLow) / (yearHigh - yearLow)) * 100}%` }}
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"
              style={{ left: `calc(${((currentPrice - yearLow) / (yearHigh - yearLow)) * 100}% - 4px)` }}
            />
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <stat.icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className="text-sm font-mono font-semibold">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
        
        {/* Dividend Info */}
        {dividend && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm">Dividend Yield</span>
              <Badge variant="secondary" className="font-mono">{dividend}%</Badge>
            </div>
          </div>
        )}
        
        {/* Volume Comparison */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Volume vs Avg</p>
          <div className="flex items-center gap-3">
            <Progress value={(volume / avgVolume) * 100} className="flex-1 h-2" />
            <span className={`text-xs font-mono ${volume > avgVolume ? 'text-profit' : 'text-loss'}`}>
              {volume > avgVolume ? '+' : ''}{(((volume - avgVolume) / avgVolume) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
