import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PostToMarketplaceDialog } from '@/components/automation/PostToMarketplaceDialog';
import { 
  Activity, BarChart3, Settings2, History, Save, Power, PowerOff, 
  TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, XCircle, Loader2, Store, RotateCcw, DollarSign,
  Clock, Brain, ChevronDown, Zap, RefreshCw
} from 'lucide-react';

// Market hours helper (9AM–4PM ET, Mon–Fri, DST-aware)
function getEasternOffset(now: Date): number {
  const year = now.getFullYear();
  const march = new Date(year, 2, 1);
  const marchDow = march.getDay();
  const firstSundayMarch = marchDow === 0 ? march : new Date(year, 2, 7 - marchDow);
  const dstStart = new Date(firstSundayMarch.getTime() + 7 * 24 * 3600 * 1000);
  const nov = new Date(year, 10, 1);
  const novDow = nov.getDay();
  const dstEnd = novDow === 0 ? nov : new Date(year, 10, 7 - novDow);
  return now >= dstStart && now < dstEnd ? -4 : -5;
}

function useMarketStatus() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function check() {
      const now = new Date();
      const offset = getEasternOffset(now);
      const et = new Date(now.getTime() + offset * 3600 * 1000);
      const day = et.getUTCDay();
      const mins = et.getUTCHours() * 60 + et.getUTCMinutes();
      setOpen(day >= 1 && day <= 5 && mins >= 9 * 60 && mins < 16 * 60);
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}
import { Progress } from '@/components/ui/progress';
import { 
  useStockAutomation, useUpsertAutomation, useToggleAutomation, 
  useAutomationSignals, useResetInvestedAmount, useOptimizationLogs, type StockAutomation 
} from '@/hooks/useStockAutomations';
import { toast } from '@/hooks/use-toast';

const DEFAULT_INDICATORS = {
  rsi: { enabled: false, periods: [14] },
  sma: { enabled: false, windows: [5, 20] },
  ema: { enabled: false, windows: [5, 20] },
  bollinger: { enabled: false, window: 20, std: 2 },
  sma_deviation: { enabled: false, window: 20 },
};

export default function StockAutomationConfig() {
  const { symbol } = useParams<{ symbol: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const upperSymbol = symbol?.toUpperCase() || '';

  const { data: automation, isLoading } = useStockAutomation(upperSymbol);
  const { data: signals } = useAutomationSignals(automation?.id);
  const { data: optimizationLogs } = useOptimizationLogs(automation?.id);
  const upsertMutation = useUpsertAutomation();
  const toggleMutation = useToggleAutomation();
  const resetInvestedMutation = useResetInvestedAmount();
  const marketOpen = useMarketStatus();


  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [horizonMinutes, setHorizonMinutes] = useState(5);
  const [theta, setTheta] = useState(0.01);
  const [positionSizePercent, setPositionSizePercent] = useState(10);
  const [maxQuantity, setMaxQuantity] = useState(10);
  const [stopLossPercent, setStopLossPercent] = useState(5);
  const [takeProfitPercent, setTakeProfitPercent] = useState(15);
  const [allowShorting, setAllowShorting] = useState(false);
  const [showMarketplaceDialog, setShowMarketplaceDialog] = useState(false);
  const [maxInvestmentAmount, setMaxInvestmentAmount] = useState<string>('');
  const [selfImproveEnabled, setSelfImproveEnabled] = useState(false);
  const [minWinRate, setMinWinRate] = useState(40);
  const [maxDrawdownThreshold, setMaxDrawdownThreshold] = useState(15);
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(5);
  const [selfImproveOpen, setSelfImproveOpen] = useState(false);

  // Raw text states for comma-separated inputs to allow free typing
  const [rsiPeriodsText, setRsiPeriodsText] = useState('14');
  const [smaWindowsText, setSmaWindowsText] = useState('5, 20');
  const [emaWindowsText, setEmaWindowsText] = useState('5, 20');

  // Load existing config
  useEffect(() => {
    if (automation) {
      const ind = automation.indicators || DEFAULT_INDICATORS;
      setIndicators(ind);
      setRsiOversold(automation.rsi_oversold);
      setRsiOverbought(automation.rsi_overbought);
      setHorizonMinutes(automation.horizon_minutes);
      setTheta(automation.theta);
      setPositionSizePercent(automation.position_size_percent);
      setMaxQuantity(automation.max_quantity);
      setStopLossPercent(automation.stop_loss_percent);
      setTakeProfitPercent(automation.take_profit_percent);
      setAllowShorting(automation.allow_shorting ?? false);
      setMaxInvestmentAmount(automation.max_investment_amount != null ? String(automation.max_investment_amount) : '');
      setSelfImproveEnabled(automation.self_improve_enabled ?? false);
      setMinWinRate((automation.min_win_rate ?? 0.40) * 100);
      setMaxDrawdownThreshold(automation.max_drawdown_threshold ?? 15);
      setMaxConsecutiveLosses(automation.max_consecutive_losses ?? 5);
      setRsiPeriodsText((ind.rsi?.periods || [14]).join(', '));
      setSmaWindowsText((ind.sma?.windows || [5, 20]).join(', '));
      setEmaWindowsText((ind.ema?.windows || [5, 20]).join(', '));
    }
  }, [automation]);

  const updateIndicator = (key: string, field: string, value: any) => {
    setIndicators(prev => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], [field]: value },
    }));
  };

  const handleSave = () => {
    // Parse comma-separated text fields into indicator arrays before saving
    const parseList = (text: string) => text.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    const finalIndicators = {
      ...indicators,
      rsi: { ...indicators.rsi, periods: parseList(rsiPeriodsText).length > 0 ? parseList(rsiPeriodsText) : [14] },
      sma: { ...indicators.sma, windows: parseList(smaWindowsText).length > 0 ? parseList(smaWindowsText) : [5, 20] },
      ema: { ...indicators.ema, windows: parseList(emaWindowsText).length > 0 ? parseList(emaWindowsText) : [5, 20] },
    };

    const parsedMax = maxInvestmentAmount !== '' ? parseFloat(maxInvestmentAmount) : null;
    upsertMutation.mutate({
      symbol: upperSymbol,
      indicators: finalIndicators as any,
      rsi_oversold: rsiOversold,
      rsi_overbought: rsiOverbought,
      horizon_minutes: horizonMinutes,
      theta,
      position_size_percent: positionSizePercent,
      max_quantity: maxQuantity,
      stop_loss_percent: stopLossPercent,
      take_profit_percent: takeProfitPercent,
      allow_shorting: allowShorting,
      max_investment_amount: (parsedMax && parsedMax > 0) ? parsedMax : null,
      self_improve_enabled: selfImproveEnabled,
      min_win_rate: minWinRate / 100,
      max_drawdown_threshold: maxDrawdownThreshold,
      max_consecutive_losses: maxConsecutiveLosses,
      is_active: true,
    } as any);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6 text-center">
          <p className="text-muted-foreground">Please sign in to configure automations.</p>
          <Button onClick={() => navigate('/auth')} className="mt-4">Sign In</Button>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-6">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                {upperSymbol} Automation
              </h1>
              <p className="text-sm text-muted-foreground">Configure automated trading indicators</p>
            </div>
          </div>
          {automation && (
            <Button
              variant={automation.is_active ? 'destructive' : 'default'}
              onClick={() => toggleMutation.mutate({ id: automation.id, is_active: !automation.is_active })}
              disabled={toggleMutation.isPending}
            >
              {automation.is_active ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
              {automation.is_active ? 'Pause' : 'Activate'}
            </Button>
          )}
        </div>

        {/* Status bar */}
        {automation && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant={automation.is_active ? 'default' : 'secondary'}>
                    {automation.is_active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                 <div className="flex items-center gap-1.5">
                   <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                   <span className="text-muted-foreground">Market: </span>
                   <Badge variant={marketOpen ? 'default' : 'secondary'} className={marketOpen ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20' : ''}>
                     {marketOpen ? 'Open' : 'Closed'}
                   </Badge>
                   {!marketOpen && automation.is_active && (
                     <span className="text-xs text-amber-500 font-medium ml-1">⏸ Auto-paused until market opens (9 AM ET)</span>
                   )}
                 </div>
                <div>
                  <span className="text-muted-foreground">Last Checked: </span>
                  <span>{automation.last_checked_at ? new Date(automation.last_checked_at).toLocaleString() : 'Never'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Signals: </span>
                  <span className="font-semibold">{automation.total_signals}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Trades: </span>
                  <span className="font-semibold">{automation.total_trades}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="config">
          <TabsList className="mb-4">
            <TabsTrigger value="config"><Settings2 className="mr-2 h-4 w-4" /> Configuration</TabsTrigger>
            <TabsTrigger value="signals"><History className="mr-2 h-4 w-4" /> Signal History</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            {/* Indicators */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Technical Indicators</CardTitle>
                <CardDescription>Enable and configure indicators for signal generation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* RSI */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">RSI (Relative Strength Index)</Label>
                    <Switch checked={indicators.rsi.enabled} onCheckedChange={v => updateIndicator('rsi', 'enabled', v)} />
                  </div>
                  {indicators.rsi.enabled && (
                    <div className="ml-4 space-y-3 p-3 bg-muted/30 rounded-lg">
                      <div>
                        <Label className="text-sm">Periods (comma-separated)</Label>
                        <Input
                          value={rsiPeriodsText}
                          onChange={e => setRsiPeriodsText(e.target.value)}
                          placeholder="7, 14, 21"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">Oversold Threshold</Label>
                          <div className="flex items-center gap-2">
                            <Slider value={[rsiOversold]} onValueChange={v => setRsiOversold(v[0])} min={10} max={50} step={1} />
                            <span className="text-sm font-mono w-8">{rsiOversold}</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm">Overbought Threshold</Label>
                          <div className="flex items-center gap-2">
                            <Slider value={[rsiOverbought]} onValueChange={v => setRsiOverbought(v[0])} min={50} max={90} step={1} />
                            <span className="text-sm font-mono w-8">{rsiOverbought}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Separator />

                {/* SMA */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">SMA (Simple Moving Average)</Label>
                    <Switch checked={indicators.sma.enabled} onCheckedChange={v => updateIndicator('sma', 'enabled', v)} />
                  </div>
                  {indicators.sma.enabled && (
                    <div className="ml-4 p-3 bg-muted/30 rounded-lg">
                      <Label className="text-sm">Windows (comma-separated)</Label>
                      <Input
                        value={smaWindowsText}
                        onChange={e => setSmaWindowsText(e.target.value)}
                        placeholder="5, 20, 50"
                      />
                    </div>
                  )}
                </div>
                <Separator />

                {/* EMA */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">EMA (Exponential Moving Average)</Label>
                    <Switch checked={indicators.ema.enabled} onCheckedChange={v => updateIndicator('ema', 'enabled', v)} />
                  </div>
                  {indicators.ema.enabled && (
                    <div className="ml-4 p-3 bg-muted/30 rounded-lg">
                      <Label className="text-sm">Windows (comma-separated)</Label>
                      <Input
                        value={emaWindowsText}
                        onChange={e => setEmaWindowsText(e.target.value)}
                        placeholder="5, 20"
                      />
                    </div>
                  )}
                </div>
                <Separator />

                {/* Bollinger Bands */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Bollinger Bands</Label>
                    <Switch checked={indicators.bollinger.enabled} onCheckedChange={v => updateIndicator('bollinger', 'enabled', v)} />
                  </div>
                  {indicators.bollinger.enabled && (
                    <div className="ml-4 p-3 bg-muted/30 rounded-lg grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Window</Label>
                        <Input
                          type="number" min={5} max={50}
                          value={indicators.bollinger.window}
                          onChange={e => updateIndicator('bollinger', 'window', parseInt(e.target.value) || 20)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Std Deviations</Label>
                        <Input
                          type="number" min={1} max={4} step={0.5}
                          value={indicators.bollinger.std}
                          onChange={e => updateIndicator('bollinger', 'std', parseFloat(e.target.value) || 2)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <Separator />

                {/* SMA Deviation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">SMA Deviation</Label>
                    <Switch checked={indicators.sma_deviation.enabled} onCheckedChange={v => updateIndicator('sma_deviation', 'enabled', v)} />
                  </div>
                  {indicators.sma_deviation.enabled && (
                    <div className="ml-4 p-3 bg-muted/30 rounded-lg">
                      <Label className="text-sm">Window</Label>
                      <Input
                        type="number" min={5} max={50}
                        value={indicators.sma_deviation.window}
                        onChange={e => updateIndicator('sma_deviation', 'window', parseInt(e.target.value) || 20)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Trading Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Trading Parameters</CardTitle>
                <CardDescription>Adjust signal thresholds and trade execution settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Horizon (minutes)</Label>
                    <Input type="number" min={1} max={60} value={horizonMinutes} onChange={e => setHorizonMinutes(parseInt(e.target.value) || 5)} />
                    <p className="text-xs text-muted-foreground mt-1">Bar timeframe for indicator calculation</p>
                  </div>
                  <div>
                    <Label>Theta (signal threshold)</Label>
                    <div className="flex items-center gap-2">
                      <Slider value={[theta * 100]} onValueChange={v => setTheta(v[0] / 100)} min={1} max={10} step={0.5} />
                      <span className="text-sm font-mono w-12">{theta.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Min composite score to trigger trade (0.01-0.10)</p>
                  </div>
                  <div>
                    <Label>Max Quantity (shares)</Label>
                    <Input type="number" min={0.01} max={10000} step={0.01} value={maxQuantity} onChange={e => setMaxQuantity(parseFloat(e.target.value) || 10)} />
                    <p className="text-xs text-muted-foreground mt-1">Maximum shares per trade. Fractional shares supported. The bot may trade fewer shares based on signal confidence.</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Max Investment Amount ($)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={maxInvestmentAmount}
                      onChange={e => setMaxInvestmentAmount(e.target.value)}
                      placeholder="No limit"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Dollar cap per automation. Leave blank for no limit.</p>
                    {automation && automation.max_investment_amount != null && automation.max_investment_amount > 0 && (
                      <div className="mt-3 space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Current Invested</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold font-mono">
                              ${(automation.current_invested_amount ?? 0).toFixed(2)} / ${automation.max_investment_amount.toFixed(2)}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => resetInvestedMutation.mutate(automation.id)}
                              disabled={resetInvestedMutation.isPending}
                            >
                              {resetInvestedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                              Reset
                            </Button>
                          </div>
                        </div>
                        <Progress
                          value={Math.min(100, ((automation.current_invested_amount ?? 0) / automation.max_investment_amount) * 100)}
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {Math.min(100, ((automation.current_invested_amount ?? 0) / automation.max_investment_amount) * 100).toFixed(0)}% of budget used
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Position Size (%)</Label>
                    <div className="flex items-center gap-2">
                      <Slider value={[positionSizePercent]} onValueChange={v => setPositionSizePercent(v[0])} min={1} max={100} step={1} />
                      <span className="text-sm font-mono w-10">{positionSizePercent}%</span>
                    </div>
                  </div>
                  <div>
                    <Label>Stop Loss (%)</Label>
                    <div className="flex items-center gap-2">
                      <Slider value={[stopLossPercent]} onValueChange={v => setStopLossPercent(v[0])} min={1} max={50} step={0.5} />
                      <span className="text-sm font-mono w-10">{stopLossPercent}%</span>
                    </div>
                  </div>
                  <div>
                    <Label>Take Profit (%)</Label>
                    <div className="flex items-center gap-2">
                      <Slider value={[takeProfitPercent]} onValueChange={v => setTakeProfitPercent(v[0])} min={1} max={100} step={0.5} />
                      <span className="text-sm font-mono w-10">{takeProfitPercent}%</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div>
                    <Label className="text-base font-semibold">Allow Short Selling</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      When enabled, SELL signals will execute even if you don't hold the stock, creating a short position. 
                      <span className="text-destructive font-medium"> This carries significant risk.</span>
                    </p>
                  </div>
                  <Switch checked={allowShorting} onCheckedChange={setAllowShorting} />
                </div>
              </CardContent>
            </Card>

            {/* Self-Improving Bot */}
            <Collapsible open={selfImproveOpen} onOpenChange={setSelfImproveOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-base">Self-Improving Bot</CardTitle>
                          <CardDescription className="text-xs mt-0.5">Automatically optimize parameters when performance degrades</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {automation && selfImproveEnabled && (
                          <Badge variant="outline" className="text-xs">
                            Gen {automation.optimization_generation ?? 0}
                          </Badge>
                        )}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${selfImproveOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-6 pt-0">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-primary/30 bg-primary/5">
                      <div>
                        <Label className="text-base font-semibold">Enable Self-Improvement</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          When enabled, the bot monitors its own win rate, drawdown, and consecutive losses. If thresholds are breached, 
                          it automatically optimizes parameters or rewrites the strategy using AI.
                        </p>
                      </div>
                      <Switch checked={selfImproveEnabled} onCheckedChange={setSelfImproveEnabled} />
                    </div>

                    {selfImproveEnabled && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm">Min Win Rate (%)</Label>
                            <div className="flex items-center gap-2">
                              <Slider value={[minWinRate]} onValueChange={v => setMinWinRate(v[0])} min={10} max={80} step={5} />
                              <span className="text-sm font-mono w-10">{minWinRate}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Trigger optimization if win rate drops below this</p>
                          </div>
                          <div>
                            <Label className="text-sm">Max Drawdown (%)</Label>
                            <div className="flex items-center gap-2">
                              <Slider value={[maxDrawdownThreshold]} onValueChange={v => setMaxDrawdownThreshold(v[0])} min={5} max={50} step={1} />
                              <span className="text-sm font-mono w-10">{maxDrawdownThreshold}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Trigger if drawdown exceeds this</p>
                          </div>
                          <div>
                            <Label className="text-sm">Max Consecutive Losses</Label>
                            <Input
                              type="number" min={2} max={20}
                              value={maxConsecutiveLosses}
                              onChange={e => setMaxConsecutiveLosses(parseInt(e.target.value) || 5)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Trigger after N losses in a row</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">
                          <Zap className="h-4 w-4 text-primary shrink-0" />
                          <span>
                            <strong>How it works:</strong> Every hour, the bot checks its performance. If thresholds are breached, 
                            it first tries parameter optimization (±20% variations with backtests). If that fails, it uses AI to rewrite the entire strategy. 
                            Changes are only applied if the new config outperforms the old one.
                          </span>
                        </div>

                        {automation && (
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Generation: </span>
                              <span className="font-semibold">{automation.optimization_generation ?? 0} / 50</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Last Optimized: </span>
                              <span>{automation.last_optimization_at ? new Date(automation.last_optimization_at).toLocaleString() : 'Never'}</span>
                            </div>
                          </div>
                        )}

                        {/* Optimization History */}
                        {optimizationLogs && optimizationLogs.length > 0 && (
                          <div>
                            <Label className="text-sm font-semibold mb-2 block">Optimization History</Label>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {optimizationLogs.map(log => (
                                <div key={log.id} className="p-3 rounded-lg border border-border bg-card text-sm">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={log.stage === 'ai_rewrite' ? 'default' : 'secondary'} className="text-xs">
                                        {log.stage === 'ai_rewrite' ? <><Brain className="h-3 w-3 mr-1" />AI Rewrite</> : <><RefreshCw className="h-3 w-3 mr-1" />Param Opt</>}
                                      </Badge>
                                      <Badge variant={log.status === 'applied' ? 'default' : 'destructive'} className="text-xs">
                                        {log.status}
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">Trigger: {log.trigger_reason}</p>
                                  {log.old_metrics && (
                                    <details className="text-xs mt-1">
                                      <summary className="cursor-pointer text-muted-foreground">View config changes</summary>
                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div>
                                          <p className="font-medium text-muted-foreground">Before</p>
                                          <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-24">{JSON.stringify(log.old_config, null, 1)}</pre>
                                        </div>
                                        <div>
                                          <p className="font-medium text-muted-foreground">After</p>
                                          <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-24">{JSON.stringify(log.new_config, null, 1)}</pre>
                                        </div>
                                      </div>
                                    </details>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-end">
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowMarketplaceDialog(true)}
                disabled={upsertMutation.isPending}
              >
                <Store className="mr-2 h-4 w-4" />
                Post to Marketplace
              </Button>
              <Button size="lg" onClick={handleSave} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save & Activate
              </Button>
            </div>

            <PostToMarketplaceDialog
              open={showMarketplaceDialog}
              onOpenChange={setShowMarketplaceDialog}
              symbol={upperSymbol}
              automationConfig={{
                indicators,
                rsi_oversold: rsiOversold,
                rsi_overbought: rsiOverbought,
                horizon_minutes: horizonMinutes,
                theta,
                position_size_percent: positionSizePercent,
                max_quantity: maxQuantity,
                stop_loss_percent: stopLossPercent,
                take_profit_percent: takeProfitPercent,
                allow_shorting: allowShorting,
              }}
            />
          </TabsContent>

          <TabsContent value="signals">
            <Card>
              <CardHeader>
                <CardTitle>Signal History</CardTitle>
                <CardDescription>Every signal generated with full indicator breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                {!signals || signals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No signals generated yet</p>
                    <p className="text-sm mt-1">Signals will appear here once the automation runs</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Signal</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Traded</TableHead>
                          <TableHead>Exec. Price</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signals.map(sig => (
                          <TableRow key={sig.id}>
                            <TableCell className="text-xs">{new Date(sig.created_at).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={sig.signal_type === 'BUY' ? 'default' : sig.signal_type === 'SELL' ? 'destructive' : 'secondary'} className="gap-1">
                                {sig.signal_type === 'BUY' && <TrendingUp className="h-3 w-3" />}
                                {sig.signal_type === 'SELL' && <TrendingDown className="h-3 w-3" />}
                                {sig.signal_type === 'HOLD' && <Minus className="h-3 w-3" />}
                                {sig.signal_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{(sig.confidence * 100).toFixed(1)}%</TableCell>
                            <TableCell className="font-mono">${sig.price_at_signal?.toFixed(2)}</TableCell>
                            <TableCell>
                              {sig.trade_executed ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : sig.error_message ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono">{sig.executed_price ? `$${sig.executed_price.toFixed(2)}` : '—'}</TableCell>
                            <TableCell className="max-w-[200px]">
                              {sig.error_message && (
                                <span className="text-xs text-destructive">{sig.error_message}</span>
                              )}
                              {sig.indicator_snapshot?.votes && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground">
                                    {sig.indicator_snapshot.votes.length} indicators
                                  </summary>
                                  <ul className="mt-1 space-y-0.5">
                                    {sig.indicator_snapshot.votes.map((v: any, i: number) => (
                                      <li key={i} className={v.signal > 0 ? 'text-green-600' : v.signal < 0 ? 'text-red-600' : 'text-muted-foreground'}>
                                        {v.reason}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
