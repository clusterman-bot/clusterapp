import { useState, useEffect } from 'react';
import { useUpdateModelStrategy, StrategyConfig as StrategyConfigType } from '@/hooks/useModelStrategy';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Settings, Shield, Target, TrendingDown, TrendingUp, Save } from 'lucide-react';

interface StrategyConfigProps {
  modelId: string;
  model: {
    risk_level?: string;
    position_size_percent?: number;
    max_positions?: number;
    stop_loss_percent?: number;
    take_profit_percent?: number;
  };
  isOwner: boolean;
}

export function StrategyConfig({ modelId, model, isOwner }: StrategyConfigProps) {
  const updateStrategy = useUpdateModelStrategy();
  
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>(
    (model.risk_level as 'low' | 'medium' | 'high') || 'medium'
  );
  const [positionSize, setPositionSize] = useState(model.position_size_percent ?? 10);
  const [maxPositions, setMaxPositions] = useState(model.max_positions ?? 5);
  const [stopLoss, setStopLoss] = useState(model.stop_loss_percent ?? 5);
  const [takeProfit, setTakeProfit] = useState(model.take_profit_percent ?? 15);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = 
      riskLevel !== (model.risk_level || 'medium') ||
      positionSize !== (model.position_size_percent ?? 10) ||
      maxPositions !== (model.max_positions ?? 5) ||
      stopLoss !== (model.stop_loss_percent ?? 5) ||
      takeProfit !== (model.take_profit_percent ?? 15);
    setHasChanges(changed);
  }, [riskLevel, positionSize, maxPositions, stopLoss, takeProfit, model]);

  const handleSave = () => {
    updateStrategy.mutate({
      modelId,
      strategy: {
        risk_level: riskLevel,
        position_size_percent: positionSize,
        max_positions: maxPositions,
        stop_loss_percent: stopLoss,
        take_profit_percent: takeProfit,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Strategy Configuration
        </CardTitle>
        <CardDescription>
          Configure how the model manages risk and positions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Risk Level */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Level
          </Label>
          <RadioGroup
            value={riskLevel}
            onValueChange={(value) => setRiskLevel(value as 'low' | 'medium' | 'high')}
            disabled={!isOwner}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="low" id="low" />
              <Label htmlFor="low" className="text-green-500">Low Risk</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="medium" />
              <Label htmlFor="medium" className="text-yellow-500">Medium Risk</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="high" id="high" />
              <Label htmlFor="high" className="text-red-500">High Risk</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Position Size */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Position Size (% of allocation)
            </Label>
            <span className="text-sm font-medium">{positionSize}%</span>
          </div>
          <Slider
            value={[positionSize]}
            min={1}
            max={50}
            step={1}
            onValueChange={([value]) => setPositionSize(value)}
            disabled={!isOwner}
          />
          <p className="text-xs text-muted-foreground">
            Each trade will use {positionSize}% of the allocated capital.
          </p>
        </div>

        {/* Max Positions */}
        <div className="space-y-2">
          <Label>Maximum Open Positions</Label>
          <Input
            type="number"
            value={maxPositions}
            onChange={(e) => setMaxPositions(parseInt(e.target.value) || 1)}
            min={1}
            max={20}
            disabled={!isOwner}
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of stocks to hold at once.
          </p>
        </div>

        {/* Stop Loss */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Stop Loss
            </Label>
            <span className="text-sm font-medium text-destructive">-{stopLoss}%</span>
          </div>
          <Slider
            value={[stopLoss]}
            min={1}
            max={20}
            step={0.5}
            onValueChange={([value]) => setStopLoss(value)}
            disabled={!isOwner}
          />
        </div>

        {/* Take Profit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Take Profit
            </Label>
            <span className="text-sm font-medium text-green-500">+{takeProfit}%</span>
          </div>
          <Slider
            value={[takeProfit]}
            min={5}
            max={50}
            step={1}
            onValueChange={([value]) => setTakeProfit(value)}
            disabled={!isOwner}
          />
        </div>

        {isOwner && (
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || updateStrategy.isPending}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateStrategy.isPending ? 'Saving...' : 'Save Strategy'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
