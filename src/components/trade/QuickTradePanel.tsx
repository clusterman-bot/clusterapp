import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  TrendingUp, TrendingDown, DollarSign, 
  BarChart3, Target, Shield, Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useAlpacaPlaceOrder, useAlpacaAccount } from '@/hooks/useAlpaca';
import { TradingModeIndicator } from '@/components/TradingModeToggle';

interface QuickTradePanelProps {
  symbol: string;
  stockId: string;
  currentPrice: number;
  dayHigh?: number;
  dayLow?: number;
}

export function QuickTradePanel({ symbol, stockId, currentPrice, dayHigh, dayLow }: QuickTradePanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: alpacaAccount } = useAlpacaAccount();
  const placeOrder = useAlpacaPlaceOrder();
  
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState(currentPrice.toFixed(2));
  const [stopPrice, setStopPrice] = useState((currentPrice * 0.95).toFixed(2));
  const [takeProfitPrice, setTakeProfitPrice] = useState((currentPrice * 1.05).toFixed(2));
  
  const qty = parseFloat(quantity) || 0;
  const estimatedCost = qty * currentPrice;
  const buyingPower = alpacaAccount?.buying_power || 0;
  const canAfford = estimatedCost <= buyingPower;
  
  const percentages = [25, 50, 75, 100];
  
  const handlePercentageClick = (percent: number) => {
    const maxShares = Math.floor((buyingPower * (percent / 100)) / currentPrice);
    setQuantity(maxShares.toString());
  };
  
  const handleSubmit = () => {
    if (!qty || qty <= 0) return;
    
    placeOrder.mutate({
      stockId,
      symbol,
      quantity: qty,
      side: orderSide,
      orderType: orderType === 'stop' ? 'stop_loss' : orderType,
      limitPrice: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
      stopPrice: orderType === 'stop' ? parseFloat(stopPrice) : undefined,
    });
    
    setQuantity('1');
  };
  
  if (!user) {
    return (
      <Card className="border-0 bg-card/50 backdrop-blur-sm">
        <CardContent className="py-8 text-center">
          <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Sign in to start trading</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="border-0 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Quick Trade</CardTitle>
          <TradingModeIndicator />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Buy/Sell Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={orderSide === 'buy' ? 'default' : 'outline'}
            className={`${orderSide === 'buy' ? 'bg-profit hover:bg-profit/90 text-profit-foreground' : ''}`}
            onClick={() => setOrderSide('buy')}
          >
            <TrendingUp className="mr-2 h-4 w-4" /> Buy
          </Button>
          <Button
            variant={orderSide === 'sell' ? 'default' : 'outline'}
            className={`${orderSide === 'sell' ? 'bg-loss hover:bg-loss/90' : ''}`}
            onClick={() => setOrderSide('sell')}
          >
            <TrendingDown className="mr-2 h-4 w-4" /> Sell
          </Button>
        </div>
        
        {/* Order Type Tabs */}
        <Tabs value={orderType} onValueChange={(v) => setOrderType(v as any)}>
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="market" className="flex-1 text-xs gap-1">
              <DollarSign className="h-3 w-3" /> Market
            </TabsTrigger>
            <TabsTrigger value="limit" className="flex-1 text-xs gap-1">
              <Target className="h-3 w-3" /> Limit
            </TabsTrigger>
            <TabsTrigger value="stop" className="flex-1 text-xs gap-1">
              <Shield className="h-3 w-3" /> Stop
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Quantity Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Shares</Label>
            <span className="text-xs text-muted-foreground">
              Market: ${currentPrice.toFixed(2)}
            </span>
          </div>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="font-mono text-lg h-12"
            min="0"
            step="1"
          />
          
          {/* Quick Percentage Buttons */}
          <div className="flex gap-2">
            {percentages.map(pct => (
              <Button
                key={pct}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => handlePercentageClick(pct)}
              >
                {pct}%
              </Button>
            ))}
          </div>
        </div>
        
        {/* Limit Price (for limit orders) */}
        {orderType === 'limit' && (
          <div className="space-y-2">
            <Label className="text-xs">Limit Price</Label>
            <Input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              className="font-mono"
              step="0.01"
            />
          </div>
        )}
        
        {/* Stop Price (for stop orders) */}
        {orderType === 'stop' && (
          <div className="space-y-2">
            <Label className="text-xs">Stop Price</Label>
            <Input
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              className="font-mono"
              step="0.01"
            />
          </div>
        )}
        
        {/* Order Summary */}
        <div className="p-3 rounded-lg bg-muted/30 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated {orderSide === 'buy' ? 'Cost' : 'Credit'}</span>
            <span className="font-mono font-semibold">${estimatedCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Buying Power</span>
            <span className="font-mono">${buyingPower.toFixed(2)}</span>
          </div>
          {orderSide === 'buy' && !canAfford && qty > 0 && (
            <p className="text-xs text-loss">Insufficient buying power</p>
          )}
        </div>
        
        {/* Submit Button */}
        <Button 
          className={`w-full h-12 text-lg font-semibold ${
            orderSide === 'buy' 
              ? 'bg-profit hover:bg-profit/90' 
              : 'bg-loss hover:bg-loss/90'
          }`}
          disabled={!qty || qty <= 0 || (orderSide === 'buy' && !canAfford) || placeOrder.isPending}
          onClick={handleSubmit}
        >
          {placeOrder.isPending ? 'Placing Order...' : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${qty} ${symbol}`}
        </Button>
        
        {/* Risk Warning */}
        <p className="text-xs text-muted-foreground text-center">
          Trading involves risk. Past performance doesn't guarantee future results.
        </p>
      </CardContent>
    </Card>
  );
}
