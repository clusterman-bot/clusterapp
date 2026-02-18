import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCreateModel } from '@/hooks/useModels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Loader2, Store, DollarSign, ShieldAlert, Sparkles, Code2, CheckCircle2 } from 'lucide-react';

interface PostToMarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  automationConfig: Record<string, any>;
}

export function PostToMarketplaceDialog({
  open,
  onOpenChange,
  symbol,
  automationConfig,
}: PostToMarketplaceDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createModel = useCreateModel();

  const [name, setName] = useState(`${symbol} Automation Strategy`);
  const [description, setDescription] = useState('');
  const [strategyOverview, setStrategyOverview] = useState('');
  const [minAllocation, setMinAllocation] = useState(500);
  const [maxAllocation, setMaxAllocation] = useState(10000);
  const [maxExposurePercent, setMaxExposurePercent] = useState(20);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isPublic, setIsPublic] = useState(true);

  // Derive custom indicators at component level so JSX can access them
  const indicatorsSource = automationConfig.indicators ?? automationConfig;
  const customArr: any[] =
    (indicatorsSource.custom && Array.isArray(indicatorsSource.custom) ? indicatorsSource.custom : null) ??
    (Array.isArray(automationConfig.custom_indicators) ? automationConfig.custom_indicators : null) ??
    [];

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Model name is required', variant: 'destructive' });
      return;
    }
    if (minAllocation >= maxAllocation) {
      toast({ title: 'Min allocation must be less than max allocation', variant: 'destructive' });
      return;
    }
    // Check that at least one indicator is active (built-in OR custom AI-generated)
    const builtInEnabled = Object.entries(indicatorsSource)
      .filter(([k]) => ['rsi', 'sma', 'ema', 'bollinger', 'sma_deviation'].includes(k))
      .some(([, v]: [string, any]) => v?.enabled);
    const customEnabled = customArr.some((c: any) => c.enabled !== false);
    if (!builtInEnabled && !customEnabled) {
      toast({ title: 'At least one indicator must be enabled', description: 'Enable a built-in or AI-generated indicator in your strategy config.', variant: 'destructive' });
      return;
    }

    try {
      await createModel.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        strategy_overview: strategyOverview.trim() || undefined,
        model_type: 'no-code',
        is_public: isPublic,
        status: isPublic ? 'published' : 'draft',
        performance_fee_percent: 0,
        ticker: symbol,
        indicators_config: {
          ...indicatorsSource,
          custom: customArr,
        },
        configuration: {
          // Normalise: always store indicators + custom_indicators at top level
          indicators: automationConfig.indicators ?? {
            rsi: automationConfig.rsi,
            sma: automationConfig.sma,
            ema: automationConfig.ema,
            bollinger: automationConfig.bollinger,
            sma_deviation: automationConfig.sma_deviation,
          },
          custom_indicators: customArr,
          rsi_oversold: automationConfig.rsi_oversold,
          rsi_overbought: automationConfig.rsi_overbought,
          horizon_minutes: automationConfig.horizon_minutes,
          theta: automationConfig.theta,
          position_size_percent: automationConfig.position_size_percent,
          max_quantity: automationConfig.max_quantity,
          stop_loss_percent: automationConfig.stop_loss_percent,
          take_profit_percent: automationConfig.take_profit_percent,
          allow_shorting: automationConfig.allow_shorting,
          min_allocation: minAllocation,
          max_allocation: maxAllocation,
          max_exposure_percent: maxExposurePercent,
          risk_level: riskLevel,
          source_symbol: symbol,
        },
        user_id: user!.id,
      });

      toast({
        title: 'Model posted to marketplace!',
        description: isPublic ? 'Your model is now live in the community.' : 'Your model is saved as draft.',
      });
      onOpenChange(false);
      navigate('/community');
    } catch (err: any) {
      toast({ title: 'Failed to post model', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Post to Model Marketplace
          </DialogTitle>
          <DialogDescription>
            Publish your <span className="font-semibold">{symbol}</span> automation as a subscribable model so others can mirror its trades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* AI-Generated Indicators Preview */}
          {customArr.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">AI-Generated Indicators ({customArr.length})</span>
              </div>
              <div className="space-y-2">
                {customArr.map((indicator: any, i: number) => (
                  <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm">{indicator.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-profit" />
                        <span className="text-xs text-muted-foreground">Weight: {indicator.weight ?? 1}</span>
                      </div>
                    </div>
                    {indicator.description && (
                      <p className="text-xs text-muted-foreground pl-5">{indicator.description}</p>
                    )}
                    {indicator.signal_logic && (
                      <p className="text-xs text-muted-foreground pl-5 italic">Logic: {indicator.signal_logic}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="model-name">Model Name <span className="text-destructive">*</span></Label>
            <Input
              id="model-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. AAPL RSI Momentum Strategy"
              maxLength={80}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="model-desc">Short Description</Label>
            <Textarea
              id="model-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe what this strategy does..."
              rows={2}
              maxLength={300}
            />
          </div>

          {/* Strategy overview */}
          <div className="space-y-1.5">
            <Label htmlFor="strategy-overview">Strategy Overview</Label>
            <Textarea
              id="strategy-overview"
              value={strategyOverview}
              onChange={e => setStrategyOverview(e.target.value)}
              placeholder="Explain your signal logic, entry/exit conditions, risk management approach..."
              rows={3}
              maxLength={1000}
            />
          </div>

          <Separator />

          {/* Capital Allocation Constraints */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Capital Allocation Constraints</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Min Allocation ($)</Label>
                <Input
                  type="number"
                  min={100}
                  max={maxAllocation - 1}
                  value={minAllocation}
                  onChange={e => setMinAllocation(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Minimum a subscriber must commit</p>
              </div>
              <div className="space-y-1.5">
                <Label>Max Allocation ($)</Label>
                <Input
                  type="number"
                  min={minAllocation + 1}
                  value={maxAllocation}
                  onChange={e => setMaxAllocation(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Maximum allowed per subscriber</p>
              </div>
            </div>

            {/* Max Exposure */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Exposure Per Trade</Label>
                <span className="text-sm font-mono font-semibold">{maxExposurePercent}%</span>
              </div>
              <Slider
                value={[maxExposurePercent]}
                onValueChange={v => setMaxExposurePercent(v[0])}
                min={5}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">Max % of subscriber's allocated capital per trade</p>
            </div>
          </div>

          <Separator />

          {/* Risk Level & Visibility */}
          <div className="space-y-4">
            {/* Risk Level */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <Label>Risk Level</Label>
              </div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(level => (
                  <Button
                    key={level}
                    size="sm"
                    variant={riskLevel === level ? 'default' : 'outline'}
                    onClick={() => setRiskLevel(level)}
                    className="capitalize flex-1"
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label className="font-semibold">Publish publicly</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPublic ? 'Visible to all community members' : 'Saved as draft — only you can see it'}
                </p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>

          <Separator />

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createModel.isPending}>
              {createModel.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Store className="mr-2 h-4 w-4" />
              )}
              {isPublic ? 'Publish to Marketplace' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
