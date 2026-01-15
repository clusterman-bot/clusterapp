import { useState } from 'react';
import { useModelTickers, useAddModelTicker, useRemoveModelTicker, useUpdateModelTicker } from '@/hooks/useModelTickers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Plus, X, TrendingUp } from 'lucide-react';

interface TickerManagerProps {
  modelId: string;
  isOwner: boolean;
}

export function TickerManager({ modelId, isOwner }: TickerManagerProps) {
  const { data: tickers = [], isLoading } = useModelTickers(modelId);
  const addTicker = useAddModelTicker();
  const removeTicker = useRemoveModelTicker();
  const updateTicker = useUpdateModelTicker();
  
  const [newTicker, setNewTicker] = useState('');

  const handleAddTicker = () => {
    if (!newTicker.trim()) return;
    addTicker.mutate(
      { modelId, ticker: newTicker.trim() },
      { onSuccess: () => setNewTicker('') }
    );
  };

  const handleRemoveTicker = (tickerId: string) => {
    removeTicker.mutate({ tickerId, modelId });
  };

  const handleWeightChange = (tickerId: string, weight: number) => {
    updateTicker.mutate({ tickerId, updates: { weight } });
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading tickers...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trading Universe
        </CardTitle>
        <CardDescription>
          Stocks this model will trade. Weights determine position allocation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && (
          <div className="flex gap-2">
            <Input
              placeholder="Enter ticker symbol (e.g., AAPL)"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
              className="flex-1"
            />
            <Button 
              onClick={handleAddTicker} 
              disabled={!newTicker.trim() || addTicker.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}

        {tickers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No tickers configured yet.</p>
            {isOwner && <p className="text-sm">Add stocks that this model should trade.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {tickers.map((ticker) => (
              <div 
                key={ticker.id} 
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-sm">
                    {ticker.ticker}
                  </Badge>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Weight:</span>
                    {isOwner ? (
                      <div className="flex items-center gap-2 w-32">
                        <Slider
                          value={[ticker.weight]}
                          min={0.1}
                          max={3}
                          step={0.1}
                          onValueChange={([value]) => handleWeightChange(ticker.id, value)}
                        />
                        <span className="w-8 text-right">{ticker.weight.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span>{ticker.weight.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTicker(ticker.id)}
                    disabled={removeTicker.isPending}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
