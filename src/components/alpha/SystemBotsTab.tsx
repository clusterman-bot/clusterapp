import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  useSystemBots,
  useBootstrapSystemBots,
  useRotateSystemBotTickers,
  useOptimizeSystemBots,
  useUpdateSystemBotConfig,
  SystemBot,
} from '@/hooks/useSystemBots';
import {
  Bot, RefreshCw, Zap, Clock, XCircle, Rocket, ChevronDown, ChevronUp, Settings2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function IndicatorDisplay({ config }: { config: any }) {
  if (!config) return <span className="text-muted-foreground text-xs">No indicators</span>;
  const nativeEntries = Object.entries(config).filter(([k, v]: any) => k !== 'custom' && v?.enabled);
  const customIndicators = Array.isArray(config.custom) ? config.custom.filter((c: any) => c.enabled) : [];

  if (!nativeEntries.length && !customIndicators.length) return <span className="text-muted-foreground text-xs">No active indicators</span>;

  return (
    <div className="space-y-3">
      {nativeEntries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Native Indicators</p>
          <div className="grid grid-cols-2 gap-2">
            {nativeEntries.map(([key, val]: any) => (
              <div key={key} className="bg-muted/50 rounded p-2 text-xs">
                <span className="font-mono font-semibold uppercase">{key}</span>
                <div className="text-muted-foreground mt-0.5">
                  {val.periods && <span>Periods: {val.periods.join(', ')}</span>}
                  {val.windows && <span>Windows: {val.windows.join(', ')}</span>}
                  {val.window && !val.windows && <span>Window: {val.window}</span>}
                  {val.std && <span> · Std: {val.std}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {customIndicators.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">AI-Generated Custom Indicators</p>
          <div className="grid grid-cols-1 gap-2">
            {customIndicators.map((ci: any, i: number) => (
              <div key={i} className="bg-accent/30 border border-accent/50 rounded p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold">{ci.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4">weight: {ci.weight?.toFixed(1) ?? '1.0'}</Badge>
                </div>
                <pre className="text-muted-foreground mt-1 text-[10px] max-h-20 overflow-auto whitespace-pre-wrap break-all">{ci.code}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BotCard({ bot }: { bot: SystemBot }) {
  const { toast } = useToast();
  const updateConfig = useUpdateSystemBotConfig();
  const rotateTickers = useRotateSystemBotTickers();
  const optimizeBots = useOptimizeSystemBots();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(bot.model?.name ?? '');
  const [tickerInput, setTickerInput] = useState('');
  const [showParams, setShowParams] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);

  // Editable params state
  const model = bot.model;
  const cfg = bot.config;
  const deploy = bot.deployment;
  const totalReturn = model?.total_return ?? 0;
  const isPositive = totalReturn >= 0;

  const [params, setParams] = useState({
    min_allocation: model?.min_allocation ?? 100,
    max_allocation: model?.max_allocation ?? 10000,
    stop_loss_percent: model?.stop_loss_percent ?? 5,
    take_profit_percent: model?.take_profit_percent ?? 15,
    position_size_percent: model?.position_size_percent ?? 10,
    theta: model?.theta ?? 0.01,
    max_exposure_percent: model?.max_exposure_percent ?? 20,
  });

  const handleRename = async () => {
    if (!newName.trim()) return;
    try {
      await updateConfig.mutateAsync({
        config_id: cfg.id,
        model_id: model?.id,
        model_updates: { name: newName.trim() },
      });
      setEditingName(false);
      toast({ title: 'Bot renamed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (active: boolean) => {
    try {
      await updateConfig.mutateAsync({ config_id: cfg.id, updates: { is_active: active } });
      toast({ title: active ? 'Bot activated' : 'Bot deactivated' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSaveParams = async () => {
    try {
      await updateConfig.mutateAsync({
        config_id: cfg.id,
        model_id: model?.id,
        model_updates: {
          min_allocation: params.min_allocation,
          max_allocation: params.max_allocation,
          stop_loss_percent: params.stop_loss_percent,
          take_profit_percent: params.take_profit_percent,
          position_size_percent: params.position_size_percent,
          theta: params.theta,
          max_exposure_percent: params.max_exposure_percent,
        },
      });
      toast({ title: 'Parameters saved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const addTicker = () => {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker || cfg.ticker_pool.includes(ticker)) return;
    updateConfig.mutateAsync({
      config_id: cfg.id,
      updates: { ticker_pool: [...cfg.ticker_pool, ticker] },
    });
    setTickerInput('');
  };

  const removeTicker = (t: string) => {
    updateConfig.mutateAsync({
      config_id: cfg.id,
      updates: { ticker_pool: cfg.ticker_pool.filter((x) => x !== t) },
    });
  };

  const sectorLabel = cfg.sector === 'tech_growth' ? 'Tech Growth'
    : cfg.sector === 'tech_momentum' ? 'Tech Momentum'
    : 'Precious Metals';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 w-56" onKeyDown={(e) => e.key === 'Enter' && handleRename()} />
                <Button size="sm" variant="outline" onClick={handleRename} disabled={updateConfig.isPending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
              </div>
            ) : (
              <CardTitle className="text-base cursor-pointer" onClick={() => { setNewName(model?.name ?? ''); setEditingName(true); }}>
                {model?.name ?? sectorLabel}
              </CardTitle>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{sectorLabel}</Badge>
            <Badge className={cfg.is_active ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted text-muted-foreground'}>
              {cfg.is_active ? '● Active' : '○ Inactive'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Current Ticker</p>
            <p className="font-mono font-bold text-lg">{cfg.current_ticker ?? '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Return</p>
            <p className={`font-mono font-bold text-lg ${isPositive ? 'text-profit' : 'text-loss'}`}>
              {isPositive ? '+' : ''}{totalReturn.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Sharpe</p>
            <p className="font-mono font-bold text-lg">{model?.sharpe_ratio?.toFixed(2) ?? '—'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Subscribers</p>
            <p className="font-mono font-bold text-lg">{model?.total_subscribers ?? 0}</p>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last rotation: {cfg.last_rotation_at ? formatDistanceToNow(new Date(cfg.last_rotation_at), { addSuffix: true }) : 'Never'}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Last optimization: {cfg.last_optimization_at ? formatDistanceToNow(new Date(cfg.last_optimization_at), { addSuffix: true }) : 'Never'}
          </span>
          <span>Gen #{cfg.optimization_generation}</span>
          {deploy?.total_signals != null && (
            <span>{deploy.total_signals} signals · {deploy.total_trades ?? 0} trades</span>
          )}
        </div>

        <Separator />

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Active</Label>
            <Switch checked={cfg.is_active} onCheckedChange={handleToggleActive} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => rotateTickers.mutateAsync({ force: true }).then(() => toast({ title: 'Rotation triggered' })).catch((e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))}
              disabled={rotateTickers.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${rotateTickers.isPending ? 'animate-spin' : ''}`} />
              Rotate Now
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => optimizeBots.mutateAsync().then(() => toast({ title: 'Optimization triggered' })).catch((e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))}
              disabled={optimizeBots.isPending}
            >
              <Zap className={`h-3.5 w-3.5 ${optimizeBots.isPending ? 'animate-spin' : ''}`} />
              Optimize Now
            </Button>
          </div>
        </div>

        {/* Ticker pool */}
        <div className="space-y-2">
          <Label className="text-sm">Ticker Pool</Label>
          <div className="flex flex-wrap gap-2">
            {cfg.ticker_pool.map((t) => (
              <Badge key={t} variant={t === cfg.current_ticker ? 'default' : 'secondary'} className="gap-1 pl-2 pr-1 py-1">
                {t}
                <button onClick={() => removeTicker(t)} className="ml-1 hover:text-destructive rounded-full">
                  <XCircle className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Add ticker" value={tickerInput} onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTicker())} className="w-28 h-8" />
            <Button size="sm" variant="outline" onClick={addTicker} disabled={!tickerInput.trim()}>Add</Button>
          </div>
        </div>

        <Separator />

        {/* Strategy Parameters (collapsible) */}
        <div className="space-y-3">
          <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full"
            onClick={() => setShowParams(!showParams)}>
            <Settings2 className="h-4 w-4" />
            Strategy Parameters
            {showParams ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
          </button>
          {showParams && (
            <div className="space-y-4 pl-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Min Allocation ($)</Label>
                  <Input type="number" value={params.min_allocation} onChange={(e) => setParams(p => ({ ...p, min_allocation: Number(e.target.value) }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Allocation ($)</Label>
                  <Input type="number" value={params.max_allocation} onChange={(e) => setParams(p => ({ ...p, max_allocation: Number(e.target.value) }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Position Size (%)</Label>
                  <Input type="number" value={params.position_size_percent} onChange={(e) => setParams(p => ({ ...p, position_size_percent: Number(e.target.value) }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stop Loss (%)</Label>
                  <Input type="number" value={params.stop_loss_percent} onChange={(e) => setParams(p => ({ ...p, stop_loss_percent: Number(e.target.value) }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Take Profit (%)</Label>
                  <Input type="number" value={params.take_profit_percent} onChange={(e) => setParams(p => ({ ...p, take_profit_percent: Number(e.target.value) }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Theta</Label>
                  <Input type="number" step="0.001" value={params.theta} onChange={(e) => setParams(p => ({ ...p, theta: Number(e.target.value) }))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Exposure (%)</Label>
                  <Input type="number" value={params.max_exposure_percent} onChange={(e) => setParams(p => ({ ...p, max_exposure_percent: Number(e.target.value) }))} className="h-8" />
                </div>
              </div>
              <Button size="sm" onClick={handleSaveParams} disabled={updateConfig.isPending}>
                {updateConfig.isPending ? 'Saving…' : 'Save Parameters'}
              </Button>
            </div>
          )}
        </div>

        {/* Indicators (collapsible, view-only) */}
        <div className="space-y-3">
          <button className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full"
            onClick={() => setShowIndicators(!showIndicators)}>
            <Zap className="h-4 w-4" />
            Active Indicators
            {showIndicators ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
          </button>
          {showIndicators && (
            <div className="pl-6">
              <IndicatorDisplay config={model?.indicators_config} />
              <p className="text-xs text-muted-foreground mt-2">Indicators are auto-managed by the optimization engine.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemBotsTab() {
  const { toast } = useToast();
  const { data, isLoading } = useSystemBots();
  const bootstrap = useBootstrapSystemBots();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
      </div>
    );
  }

  if (!data?.bootstrapped || !data.bots.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h3 className="font-semibold text-lg mb-2">System Bots Not Initialized</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Bootstrap 3 platform-managed trading bots under the @Seif account. They will auto-rotate tickers weekly and self-optimize via continuous backtesting.
          </p>
          <Button
            onClick={() => bootstrap.mutateAsync().then(() => toast({ title: 'System bots created!' })).catch((e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))}
            disabled={bootstrap.isPending}
            className="gap-2"
          >
            <Rocket className="h-4 w-4" />
            {bootstrap.isPending ? 'Creating…' : 'Bootstrap System Bots'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground">
        <p><strong>Schedule:</strong> System bots run on the same 1-minute automation cycle as all deployed models. Ticker rotation checks happen daily (rotates weekly). Optimization runs when manually triggered or via daily scheduled checks. Owner trades are disabled — only subscriber trades are mirrored.</p>
      </div>
      {data.bots.map((bot) => (
        <BotCard key={bot.config.id} bot={bot} />
      ))}
    </div>
  );
}
