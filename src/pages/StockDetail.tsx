import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, TrendingDown, Star, StarOff, 
  ArrowUpRight, ArrowDownRight, Clock, DollarSign,
  BarChart3, Activity
} from 'lucide-react';
import { 
  useStockBySymbol, useHoldings, useBalance, 
  useIsInWatchlist, useAddToWatchlist, useRemoveFromWatchlist, 
  usePlaceOrder
} from '@/hooks/useTrading';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString();
}

// Generate mock price history for the chart
function generateMockPriceHistory(currentPrice: number, previousClose: number) {
  const points = 30;
  const data = [];
  const startPrice = previousClose || currentPrice * 0.98;
  const priceRange = currentPrice - startPrice;
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    const noise = (Math.random() - 0.5) * (Math.abs(priceRange) * 0.3);
    const price = startPrice + (priceRange * progress) + noise;
    data.push({
      time: `${9 + Math.floor(i / 4)}:${String((i % 4) * 15).padStart(2, '0')}`,
      price: Math.max(0, price),
    });
  }
  // Ensure last point is current price
  data[data.length - 1].price = currentPrice;
  return data;
}

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: stock, isLoading } = useStockBySymbol(symbol);
  const { data: holdings } = useHoldings();
  const { data: balance } = useBalance();
  const { data: isInWatchlist } = useIsInWatchlist(stock?.id);
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const placeOrder = usePlaceOrder();

  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop_loss' | 'recurring'>('market');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [recurringInterval, setRecurringInterval] = useState('weekly');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-64 bg-muted rounded" />
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
            <Button onClick={() => navigate('/trade')} className="mt-4">
              Back to Trading
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const priceChange = stock.previous_close 
    ? stock.current_price - stock.previous_close 
    : 0;
  const priceChangePercent = stock.previous_close 
    ? (priceChange / stock.previous_close) * 100 
    : 0;
  const isPositive = priceChange >= 0;

  const userHolding = holdings?.find(h => h.stock_id === stock.id);
  const sharesOwned = userHolding ? Number(userHolding.quantity) : 0;
  const averageCost = userHolding ? Number(userHolding.average_cost) : 0;
  const marketValue = sharesOwned * stock.current_price;
  const totalReturn = sharesOwned > 0 ? (stock.current_price - averageCost) * sharesOwned : 0;
  const totalReturnPercent = averageCost > 0 ? ((stock.current_price - averageCost) / averageCost) * 100 : 0;

  const chartData = generateMockPriceHistory(stock.current_price, stock.previous_close || stock.current_price);

  const orderQuantity = parseFloat(quantity) || 0;
  const estimatedCost = orderQuantity * stock.current_price;
  const canAfford = orderSide === 'buy' 
    ? estimatedCost <= (balance?.cash_balance || 0) 
    : orderQuantity <= sharesOwned;

  const handlePlaceOrder = () => {
    if (!stock || orderQuantity <= 0) return;
    
    placeOrder.mutate({
      stockId: stock.id,
      orderType,
      orderSide,
      quantity: orderQuantity,
      limitPrice: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
      stopPrice: orderType === 'stop_loss' ? parseFloat(stopPrice) : undefined,
      recurringInterval: orderType === 'recurring' ? recurringInterval : undefined,
    });
    
    setQuantity('');
    setLimitPrice('');
    setStopPrice('');
  };

  const toggleWatchlist = () => {
    if (!stock) return;
    if (isInWatchlist) {
      removeFromWatchlist.mutate(stock.id);
    } else {
      addToWatchlist.mutate(stock.id);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-6">
        <BackButton />

        {/* Stock Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="font-bold text-lg text-primary">{stock.symbol.slice(0, 2)}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {stock.symbol}
                  {stock.sector && (
                    <Badge variant="outline">{stock.sector}</Badge>
                  )}
                </h1>
                <p className="text-muted-foreground">{stock.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={toggleWatchlist}
                disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
              >
                {isInWatchlist ? (
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Price Display */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-4xl font-bold">{formatPrice(stock.current_price)}</p>
                <div className={`flex items-center gap-2 mt-1 ${isPositive ? 'text-profit' : 'text-loss'}`}>
                  {isPositive ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  <span className="font-semibold">
                    {isPositive ? '+' : ''}{formatPrice(priceChange)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                  </span>
                  <span className="text-muted-foreground text-sm">Today</span>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Day High</p>
                  <p className="font-semibold">{formatPrice(stock.day_high || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Day Low</p>
                  <p className="font-semibold">{formatPrice(stock.day_low || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Volume</p>
                  <p className="font-semibold">{formatLargeNumber(stock.volume || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Market Cap</p>
                  <p className="font-semibold">{formatLargeNumber(stock.market_cap || 0)}</p>
                </div>
              </div>
            </div>
            
            {/* Price Chart */}
            <div className="h-48 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin - 1', 'dataMax + 1']} 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    width={50}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatPrice(value), 'Price']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke={isPositive ? 'hsl(var(--profit))' : 'hsl(var(--loss))'} 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Order Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Place Order</CardTitle>
            </CardHeader>
            <CardContent>
              {!user ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Sign in to start trading</p>
                  <Button onClick={() => navigate('/auth')}>Sign In</Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Buy/Sell Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={orderSide === 'buy' ? 'default' : 'outline'}
                      className={orderSide === 'buy' ? 'bg-profit hover:bg-profit/90' : ''}
                      onClick={() => setOrderSide('buy')}
                    >
                      <TrendingUp className="mr-2 h-4 w-4" /> Buy
                    </Button>
                    <Button
                      variant={orderSide === 'sell' ? 'default' : 'outline'}
                      className={orderSide === 'sell' ? 'bg-loss hover:bg-loss/90' : ''}
                      onClick={() => setOrderSide('sell')}
                    >
                      <TrendingDown className="mr-2 h-4 w-4" /> Sell
                    </Button>
                  </div>

                  {/* Order Type */}
                  <div className="space-y-2">
                    <Label>Order Type</Label>
                    <Select value={orderType} onValueChange={(v: any) => setOrderType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" /> Market Order
                          </div>
                        </SelectItem>
                        <SelectItem value="limit">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" /> Limit Order
                          </div>
                        </SelectItem>
                        <SelectItem value="stop_loss">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4" /> Stop Loss
                          </div>
                        </SelectItem>
                        <SelectItem value="recurring">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Recurring Order
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <Label>Shares</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="0"
                      step="1"
                    />
                    {orderSide === 'sell' && sharesOwned > 0 && (
                      <p className="text-sm text-muted-foreground">
                        You own {sharesOwned.toFixed(2)} shares
                      </p>
                    )}
                  </div>

                  {/* Limit Price (for limit orders) */}
                  {orderType === 'limit' && (
                    <div className="space-y-2">
                      <Label>Limit Price</Label>
                      <Input
                        type="number"
                        placeholder={stock.current_price.toFixed(2)}
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}

                  {/* Stop Price (for stop loss) */}
                  {orderType === 'stop_loss' && (
                    <div className="space-y-2">
                      <Label>Stop Price</Label>
                      <Input
                        type="number"
                        placeholder={stock.current_price.toFixed(2)}
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}

                  {/* Recurring Interval */}
                  {orderType === 'recurring' && (
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select value={recurringInterval} onValueChange={setRecurringInterval}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Order Summary */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Market Price</span>
                      <span>{formatPrice(stock.current_price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shares</span>
                      <span>{orderQuantity || 0}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Estimated {orderSide === 'buy' ? 'Cost' : 'Credit'}</span>
                      <span>{formatPrice(estimatedCost)}</span>
                    </div>
                    {orderSide === 'buy' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cash Available</span>
                        <span className={!canAfford && orderQuantity > 0 ? 'text-loss' : ''}>
                          {formatPrice(balance?.cash_balance || 0)}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button 
                    className={`w-full ${orderSide === 'buy' ? 'bg-profit hover:bg-profit/90' : 'bg-loss hover:bg-loss/90'}`}
                    size="lg"
                    disabled={orderQuantity <= 0 || !canAfford || placeOrder.isPending}
                    onClick={handlePlaceOrder}
                  >
                    {placeOrder.isPending ? 'Processing...' : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${stock.symbol}`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Your Position */}
          <div className="space-y-6">
            {user && sharesOwned > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Your Position</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shares</span>
                    <span className="font-semibold">{sharesOwned.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. Cost</span>
                    <span className="font-semibold">{formatPrice(averageCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Market Value</span>
                    <span className="font-semibold">{formatPrice(marketValue)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-4">
                    <span className="text-muted-foreground">Total Return</span>
                    <span className={`font-semibold ${totalReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {totalReturn >= 0 ? '+' : ''}{formatPrice(totalReturn)} ({totalReturnPercent.toFixed(2)}%)
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">About {stock.symbol}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Company</p>
                  <p className="font-medium">{stock.name}</p>
                </div>
                {stock.sector && (
                  <div>
                    <p className="text-muted-foreground mb-1">Sector</p>
                    <p className="font-medium">{stock.sector}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground mb-1">Market Cap</p>
                  <p className="font-medium">{formatLargeNumber(stock.market_cap || 0)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
