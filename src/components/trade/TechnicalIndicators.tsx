import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, TrendingDown, Minus, Activity, 
  BarChart3, Target, AlertTriangle
} from 'lucide-react';

interface TechnicalIndicatorsProps {
  currentPrice: number;
  previousClose: number;
  dayHigh?: number;
  dayLow?: number;
}

interface Signal {
  name: string;
  value: string;
  signal: 'buy' | 'sell' | 'neutral';
  strength?: number;
}

// Generate mock technical signals based on price
function generateSignals(currentPrice: number, previousClose: number): Signal[] {
  const priceChange = currentPrice - previousClose;
  const trend = priceChange > 0 ? 'bullish' : priceChange < 0 ? 'bearish' : 'neutral';
  
  const signals: Signal[] = [
    {
      name: 'RSI (14)',
      value: (50 + Math.random() * 30 * (trend === 'bullish' ? 1 : -1)).toFixed(1),
      signal: Math.random() > 0.5 ? 'buy' : Math.random() > 0.5 ? 'sell' : 'neutral',
      strength: Math.floor(Math.random() * 100),
    },
    {
      name: 'MACD (12,26)',
      value: (priceChange * (0.5 + Math.random())).toFixed(3),
      signal: priceChange > 0 ? 'buy' : priceChange < 0 ? 'sell' : 'neutral',
      strength: Math.floor(Math.random() * 100),
    },
    {
      name: 'SMA (20)',
      value: (currentPrice * (0.98 + Math.random() * 0.04)).toFixed(2),
      signal: Math.random() > 0.4 ? 'buy' : 'neutral',
      strength: Math.floor(Math.random() * 100),
    },
    {
      name: 'EMA (50)',
      value: (currentPrice * (0.95 + Math.random() * 0.1)).toFixed(2),
      signal: Math.random() > 0.5 ? 'buy' : 'sell',
      strength: Math.floor(Math.random() * 100),
    },
    {
      name: 'Bollinger Bands',
      value: Math.random() > 0.5 ? 'Upper' : 'Lower',
      signal: Math.random() > 0.5 ? 'buy' : 'sell',
      strength: Math.floor(Math.random() * 100),
    },
    {
      name: 'Stochastic',
      value: (20 + Math.random() * 60).toFixed(1),
      signal: Math.random() > 0.3 ? (Math.random() > 0.5 ? 'buy' : 'sell') : 'neutral',
      strength: Math.floor(Math.random() * 100),
    },
    {
      name: 'Williams %R',
      value: (-50 + Math.random() * 100 * (trend === 'bullish' ? -1 : 1)).toFixed(1),
      signal: trend === 'bullish' ? 'buy' : trend === 'bearish' ? 'sell' : 'neutral',
      strength: Math.floor(Math.random() * 100),
    },
    {
      name: 'ADX',
      value: (15 + Math.random() * 40).toFixed(1),
      signal: Math.random() > 0.5 ? 'buy' : 'neutral',
      strength: Math.floor(Math.random() * 100),
    },
  ];
  
  return signals;
}

function SignalIcon({ signal }: { signal: 'buy' | 'sell' | 'neutral' }) {
  if (signal === 'buy') {
    return <TrendingUp className="h-4 w-4 text-profit" />;
  }
  if (signal === 'sell') {
    return <TrendingDown className="h-4 w-4 text-loss" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function TechnicalIndicators({ currentPrice, previousClose, dayHigh, dayLow }: TechnicalIndicatorsProps) {
  const signals = generateSignals(currentPrice, previousClose);
  
  const buySignals = signals.filter(s => s.signal === 'buy').length;
  const sellSignals = signals.filter(s => s.signal === 'sell').length;
  const neutralSignals = signals.filter(s => s.signal === 'neutral').length;
  
  const overallSentiment = buySignals > sellSignals ? 'Bullish' : sellSignals > buySignals ? 'Bearish' : 'Neutral';
  const sentimentScore = ((buySignals - sellSignals) / signals.length) * 100 + 50;
  
  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Technical Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Signal */}
        <div className="p-4 rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Overall Signal</span>
            <Badge 
              variant={overallSentiment === 'Bullish' ? 'default' : overallSentiment === 'Bearish' ? 'destructive' : 'secondary'}
              className={overallSentiment === 'Bullish' ? 'bg-profit hover:bg-profit/80' : ''}
            >
              {overallSentiment}
            </Badge>
          </div>
          
          <div className="relative h-2 rounded-full overflow-hidden bg-gradient-to-r from-loss via-muted to-profit">
            <div 
              className="absolute top-0 w-3 h-3 -translate-y-0.5 rounded-full bg-foreground border-2 border-background shadow-lg"
              style={{ left: `calc(${Math.min(100, Math.max(0, sentimentScore))}% - 6px)` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Strong Sell</span>
            <span>Strong Buy</span>
          </div>
        </div>
        
        {/* Signal Summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-lg bg-profit/10">
            <p className="text-2xl font-bold text-profit">{buySignals}</p>
            <p className="text-xs text-muted-foreground">Buy</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-2xl font-bold">{neutralSignals}</p>
            <p className="text-xs text-muted-foreground">Neutral</p>
          </div>
          <div className="p-3 rounded-lg bg-loss/10">
            <p className="text-2xl font-bold text-loss">{sellSignals}</p>
            <p className="text-xs text-muted-foreground">Sell</p>
          </div>
        </div>
        
        {/* Individual Signals */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Indicators</p>
          {signals.map((signal, i) => (
            <div 
              key={i}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <SignalIcon signal={signal.signal} />
                <span className="text-sm">{signal.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-muted-foreground">{signal.value}</span>
                <Badge 
                  variant="outline" 
                  className={`text-xs capitalize ${
                    signal.signal === 'buy' ? 'border-profit text-profit' :
                    signal.signal === 'sell' ? 'border-loss text-loss' :
                    'border-muted-foreground text-muted-foreground'
                  }`}
                >
                  {signal.signal}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        
        {/* Key Levels */}
        <div className="pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Key Levels</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Target className="h-3 w-3 text-profit" />
                Resistance 1
              </span>
              <span className="font-mono">${(currentPrice * 1.03).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <Target className="h-3 w-3 text-profit" />
                Resistance 2
              </span>
              <span className="font-mono">${(currentPrice * 1.05).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-loss" />
                Support 1
              </span>
              <span className="font-mono">${(currentPrice * 0.97).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-loss" />
                Support 2
              </span>
              <span className="font-mono">${(currentPrice * 0.95).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
