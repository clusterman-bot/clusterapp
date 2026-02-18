import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Maximize2,
  BarChart3, Activity, Layers
} from 'lucide-react';
import { useAlpacaBars, AlpacaBar } from '@/hooks/useAlpaca';

interface ChartData {
  time: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number;
  sma50?: number;
  ema12?: number;
  ema26?: number;
  rsi?: number;
  macd?: number;
  signal?: number;
  upperBand?: number;
  lowerBand?: number;
  middleBand?: number;
}

interface AdvancedChartProps {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  dayHigh?: number | null;
  dayLow?: number | null;
}

function addIndicators(data: ChartData[]): void {
  for (let i = 0; i < data.length; i++) {
    if (i >= 19) {
      const sum = data.slice(i - 19, i + 1).reduce((acc, d) => acc + d.close, 0);
      data[i].sma20 = sum / 20;
    }
    if (i >= 49) {
      const sum = data.slice(i - 49, i + 1).reduce((acc, d) => acc + d.close, 0);
      data[i].sma50 = sum / 50;
    }
    if (i >= 11) {
      data[i].ema12 = data.slice(i - 11, i + 1).reduce((acc, d) => acc + d.close, 0) / 12;
    }
    if (i >= 25) {
      data[i].ema26 = data.slice(i - 25, i + 1).reduce((acc, d) => acc + d.close, 0) / 26;
      data[i].macd = (data[i].ema12 || 0) - data[i].ema26!;
    }
    if (i >= 13) {
      let gains = 0, losses = 0;
      for (let j = i - 13; j <= i; j++) {
        const change = data[j].close - data[j].open;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      data[i].rsi = 100 - (100 / (1 + gains / (losses || 1)));
    }
    if (i >= 19) {
      const slice = data.slice(i - 19, i + 1);
      const mean = slice.reduce((acc, d) => acc + d.close, 0) / 20;
      const variance = slice.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / 20;
      const stdDev = Math.sqrt(variance);
      data[i].middleBand = mean;
      data[i].upperBand = mean + 2 * stdDev;
      data[i].lowerBand = mean - 2 * stdDev;
    }
  }
}

function barsToChartData(bars: AlpacaBar[], timeframe: string): ChartData[] {
  const data: ChartData[] = bars.map(b => {
    const d = new Date(b.date);
    const isIntraday = timeframe === '1D' || timeframe === '1W';
    return {
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: isIntraday
        ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    };
  });
  addIndicators(data);
  return data;
}

function generateOHLCData(currentPrice: number, previousClose: number, days: number = 60): ChartData[] {
  const data: ChartData[] = [];
  let price = previousClose || currentPrice * 0.95;
  const volatility = currentPrice * 0.02;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(1000000 + Math.random() * 5000000);
    data.push({
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open, high, low, close, volume,
    });
    price = close;
  }
  if (data.length > 0) {
    data[data.length - 1].close = currentPrice;
    data[data.length - 1].high = Math.max(data[data.length - 1].high, currentPrice);
    data[data.length - 1].low = Math.min(data[data.length - 1].low, currentPrice);
  }
  addIndicators(data);
  return data;
}

const timeframes = ['1D', '1W', '1M', '3M', '1Y'];
const indicators = ['SMA', 'EMA', 'BB', 'RSI', 'MACD', 'VOL'];

export function AdvancedChart({ symbol, currentPrice, previousClose, dayHigh, dayLow }: AdvancedChartProps) {
  const [timeframe, setTimeframe] = useState('1M');
  const [activeIndicators, setActiveIndicators] = useState<string[]>(['SMA', 'VOL']);
  const [chartType, setChartType] = useState<'line' | 'candle' | 'area'>('area');

  const { data: alpacaBars, isLoading: barsLoading } = useAlpacaBars(symbol, timeframe);

  const isLive = !!alpacaBars && alpacaBars.length > 0;

  const chartData = useMemo(() => {
    if (isLive) {
      return barsToChartData(alpacaBars!, timeframe);
    }
    // Fallback to simulated
    const days = timeframe === '1D' ? 1 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : timeframe === '1Y' ? 365 : 365;
    return generateOHLCData(currentPrice, previousClose, days);
  }, [alpacaBars, isLive, currentPrice, previousClose, timeframe]);

  const minPrice = Math.min(...chartData.map(d => d.low)) * 0.995;
  const maxPrice = Math.max(...chartData.map(d => d.high)) * 1.005;
  const latestData = chartData[chartData.length - 1];

  // Start price:
  // - 1D (intraday bars): first bar's OPEN (pre-market starts at 13:50 UTC)
  // - All other timeframes (daily bars): first bar's CLOSE (end of first day = baseline for period gain)
  const periodStartPrice = isLive && chartData.length > 0
    ? (timeframe === '1D' ? chartData[0].open : chartData[0].close)
    : (previousClose || currentPrice);

  // End price: for intraday (1D) use last bar at/before 21:00 UTC (4 PM ET = market close).
  // For daily bars (1W, 1M, etc.) just use the last bar's close.
  const periodEndPrice = (() => {
    if (!isLive || !latestData) return currentPrice;
    if (timeframe === '1D' && alpacaBars && alpacaBars.length > 0) {
      // Find last bar at or before 21:00 UTC (4 PM ET) to exclude after-hours
      const marketBars = alpacaBars.filter(b => {
        const d = new Date(b.date);
        return d.getUTCHours() < 21;
      });
      if (marketBars.length > 0) return marketBars[marketBars.length - 1].close;
    }
    return latestData.close;
  })();

  const priceChange = periodEndPrice - periodStartPrice;
  const priceChangePercent = periodStartPrice > 0 ? (priceChange / periodStartPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  const toggleIndicator = (ind: string) => {
    setActiveIndicators(prev => 
      prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
    );
  };
  
  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold font-mono">{symbol}</span>
                <Badge variant="outline" className="font-mono">
                  {currentPrice.toFixed(2)}
                </Badge>
                {barsLoading ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Loading…</Badge>
                ) : (
                  <Badge
                    variant={isLive ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {isLive ? 'Live' : 'Simulated'}
                  </Badge>
                )}
              </div>
              <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-profit' : 'text-loss'}`}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span className="font-mono">
                  {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </span>
                <span className="text-muted-foreground text-xs ml-1">{timeframe}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant={chartType === 'line' ? 'secondary' : 'ghost'} size="sm" onClick={() => setChartType('line')}>
              <Activity className="h-4 w-4" />
            </Button>
            <Button variant={chartType === 'area' ? 'secondary' : 'ghost'} size="sm" onClick={() => setChartType('area')}>
              <Layers className="h-4 w-4" />
            </Button>
            <Button variant={chartType === 'candle' ? 'secondary' : 'ghost'} size="sm" onClick={() => setChartType('candle')}>
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex items-center justify-between mb-4">
          <Tabs value={timeframe} onValueChange={setTimeframe}>
            <TabsList className="bg-muted/50">
              {timeframes.map(tf => (
                <TabsTrigger key={tf} value={tf} className="text-xs font-mono data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {tf}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-1">
            {indicators.map(ind => (
              <Button
                key={ind}
                variant={activeIndicators.includes(ind) ? 'secondary' : 'ghost'}
                size="sm"
                className="text-xs font-mono h-7 px-2"
                onClick={() => toggleIndicator(ind)}
              >
                {ind}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Main Chart */}
        <div className="h-[400px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} stopOpacity={0} />
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
              />
              
              <YAxis 
                domain={[minPrice, maxPrice]}
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                width={50}
              />
              
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    close: 'Close', open: 'Open', high: 'High', low: 'Low',
                    sma20: 'SMA 20', sma50: 'SMA 50',
                    upperBand: 'Upper BB', lowerBand: 'Lower BB', volume: 'Volume',
                  };
                  return [
                    name === 'volume' ? value.toLocaleString() : `$${value.toFixed(2)}`,
                    labels[name] || name
                  ];
                }}
              />
              
              {activeIndicators.includes('BB') && (
                <>
                  <Area type="monotone" dataKey="upperBand" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} />
                  <Area type="monotone" dataKey="lowerBand" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} />
                </>
              )}
              
              {chartType === 'area' && (
                <Area type="monotone" dataKey="close" stroke={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} strokeWidth={2} fill="url(#priceGradient)" dot={false} />
              )}
              
              {chartType === 'line' && (
                <Line type="monotone" dataKey="close" stroke={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} strokeWidth={2} dot={false} />
              )}
              
              {activeIndicators.includes('SMA') && (
                <>
                  <Line type="monotone" dataKey="sma20" stroke="hsl(var(--chart-1))" strokeWidth={1} dot={false} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="sma50" stroke="hsl(var(--chart-2))" strokeWidth={1} dot={false} strokeDasharray="5 5" />
                </>
              )}
              
              {activeIndicators.includes('EMA') && (
                <>
                  <Line type="monotone" dataKey="ema12" stroke="hsl(var(--chart-3))" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="ema26" stroke="hsl(var(--chart-4))" strokeWidth={1} dot={false} />
                </>
              )}
              
              <ReferenceLine 
                y={currentPrice} 
                stroke={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} 
                strokeDasharray="3 3"
                label={{ 
                  value: `$${currentPrice.toFixed(2)}`, 
                  position: 'right',
                  fill: isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {activeIndicators.includes('VOL') && (
          <div className="h-[80px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis 
                  orientation="right" axisLine={false} tickLine={false}
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  width={50}
                />
                <Bar dataKey="volume" fill="hsl(var(--muted-foreground))" opacity={0.3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* OHLC Stats — period open/high/low, latest close */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Open</p>
            <p className="font-mono font-semibold">${chartData[0]?.open.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">High</p>
            <p className="font-mono font-semibold text-profit">${Math.max(...chartData.map(d => d.high)).toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Low</p>
            <p className="font-mono font-semibold text-loss">${Math.min(...chartData.map(d => d.low)).toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Close</p>
            <p className="font-mono font-semibold">${latestData?.close.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
