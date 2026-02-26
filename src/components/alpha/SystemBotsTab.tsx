import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Bot, Play, RefreshCw, Zap, TrendingUp, TrendingDown,
  Users, Clock, BarChart3, XCircle, Settings2, Rocket,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function BotCard({ bot }: { bot: SystemBot }) {
  const { toast } = useToast();
  const updateConfig = useUpdateSystemBotConfig();
  const rotateTickers = useRotateSystemBotTickers();
  const optimizeBots = useOptimizeSystemBots();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(bot.model?.name ?? '');
  const [tickerInput, setTickerInput] = useState('');

  const model = bot.model;
  const cfg = bot.config;
  const deploy = bot.deployment;
  const totalReturn = model?.total_return ?? 0;
  const isPositive = totalReturn >= 0;

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
      await updateConfig.mutateAsync({
        config_id: cfg.id,
        updates: { is_active: active },
      });
      toast({ title: active ? 'Bot activated' : 'Bot deactivated' });
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
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 w-56"
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                />
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
              {isPositive ? '+' : ''}{(totalReturn * 100).toFixed(1)}%
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
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => rotateTickers.mutateAsync({ force: true }).then(() => toast({ title: 'Rotation triggered' })).catch((e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }))}
              disabled={rotateTickers.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${rotateTickers.isPending ? 'animate-spin' : ''}`} />
              Rotate Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
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
            <Input
              placeholder="Add ticker"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTicker())}
              className="w-28 h-8"
            />
            <Button size="sm" variant="outline" onClick={addTicker} disabled={!tickerInput.trim()}>Add</Button>
          </div>
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
    <div className="space-y-4">
      {data.bots.map((bot) => (
        <BotCard key={bot.config.id} bot={bot} />
      ))}
    </div>
  );
}
