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
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Activity, BarChart3, Settings2, History, Save, Power, PowerOff, 
  TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, Loader2, RotateCcw, DollarSign, Bitcoin,
  Brain, ChevronDown, Zap, RefreshCw
} from 'lucide-react';
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

export default function CryptoAutomationConfig() {
  const { symbol } = useParams<{ symbol: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Convert URL symbol BTC-USD -> BTC/USD for DB
  const upperSymbol = symbol?.replace('-', '/').toUpperCase() || '';

  const { data: automation, isLoading } = useStockAutomation(upperSymbol);
  const { data: signals } = useAutomationSignals(automation?.id);
  const { data: optimizationLogs } = useOptimizationLogs(automation?.id);
  const upsertMutation = useUpsertAutomation();
  const toggleMutation = useToggleAutomation();
  const resetInvestedMutation = useResetInvestedAmount();

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
  const [maxInvestmentAmount, setMaxInvestmentAmount] = useState<string>('');
  const [selfImproveEnabled, setSelfImproveEnabled] = useState(false);
  const [minWinRate, setMinWinRate] = useState(40);
  const [maxDrawdownThreshold, setMaxDrawdownThreshold] = useState(15);
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState(5);
  const [selfImproveOpen, setSelfImproveOpen] = useState(false);

  const [rsiPeriodsText, setRsiPeriodsText] = useState('14');
  const [smaWindowsText, setSmaWindowsText] = useState('5, 20');
  const [emaWindowsText, setEmaWindowsText] = useState('5, 20');

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
                <Bitcoin className="h-6 w-6 text-amber-500" />
                {upperSymbol} Automation
              </h1>
              <p className="text-sm text-muted-foreground">Configure automated crypto trading indicators</p>
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
                  <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">
                    24/7 Market
                  </Badge>
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
                        <Input value={rsiPeriodsText} onChange={e => setRsiPeriodsText(e.target.value)} placeholder="7, 14, 21" />
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
                      <Input value={smaWindowsText} onChange={e => setSmaWindowsText(e.target.value)} placeholder="5, 20, 50" />
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
                      <Input value={emaWindowsText} onChange={e => setEmaWindowsText(e.target.value)} placeholder="5, 20" />
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
                        <Input type="number" min={5} max={50} value={indicators.bollinger.window} onChange={e => updateIndicator('bollinger', 'window', parseInt(e.target.value) || 20)} />
                      </div>
                      <div>
                        <Label className="text-sm">Std Deviations</Label>
                        <Input type="number" min={1} max={4} step={0.5} value={indicators.bollinger.std} onChange={e => updateIndicator('bollinger', 'std', parseFloat(e.target.value) || 2)} />
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
                      <Input type="number" min={5} max={50} value={indicators.sma_deviation.window} onChange={e => updateIndicator('sma_deviation', 'window', parseInt(e.target.value) || 20)} />
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
                    <Label>Max Quantity</Label>
                    <Input type="number" min={0.001} max={10000} step={0.001} value={maxQuantity} onChange={e => setMaxQuantity(parseFloat(e.target.value) || 1)} />
                    <p className="text-xs text-muted-foreground mt-1">Maximum units per trade. Fractional quantities supported.</p>
                  </div>
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Max Investment Amount ($)
                    </Label>
                    <Input type="number" min={0} step={100} value={maxInvestmentAmount} onChange={e => setMaxInvestmentAmount(e.target.value)} placeholder="No limit" />
                    <p className="text-xs text-muted-foreground mt-1">Dollar cap per automation. Leave blank for no limit.</p>
                    {automation && automation.max_investment_amount != null && automation.max_investment_amount > 0 && (
                      <div className="mt-3 space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Current Invested</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold font-mono">
                              ${(automation.current_invested_amount ?? 0).toFixed(2)} / ${automation.max_investment_amount.toFixed(2)}
                            </span>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => resetInvestedMutation.mutate(automation.id)} disabled={resetInvestedMutation.isPending}>
                              {resetInvestedMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                              Reset
                            </Button>
                          </div>
                        </div>
                        <Progress value={Math.min(100, ((automation.current_invested_amount ?? 0) / automation.max_investment_amount) * 100)} className="h-2" />
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
                      When enabled, SELL signals will execute even if you don't hold the asset.
                      <span className="text-destructive font-medium"> This carries significant risk.</span>
                    </p>
                  </div>
                  <Switch checked={allowShorting} onCheckedChange={setAllowShorting} />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-end">
              <Button size="lg" onClick={handleSave} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save & Activate
              </Button>
            </div>
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
