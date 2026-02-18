import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useModel, useUpdateModel, useDeleteModel } from '@/hooks/useModels';
import { useModelSignals, useDeployedModel, useDeployModel, useStopModel, useSignalRealtimeUpdates } from '@/hooks/useDeployedModels';
import { useIsSubscribed } from '@/hooks/useSubscriptions';
import { useBacktests } from '@/hooks/useBacktests';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { ModelSubscribeButton } from '@/components/ModelSubscribeButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  TrendingUp, TrendingDown, Users, Shield, Wallet,
  BarChart3, Target, Zap, Activity, AlertTriangle,
  CheckCircle, Clock, ArrowUpRight, ArrowDownRight,
  Sparkles, Code2, Pause, Play, Trash2, Settings2,
  Rocket, Square, RefreshCw, Radio
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass?: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass || ''}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ModelDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: model, isLoading } = useModel(id!);
  const { data: signals } = useModelSignals(id!);
  useSignalRealtimeUpdates(id);
  const { data: subscription } = useIsSubscribed(id);
  const { data: backtests } = useBacktests(id!, false);
  const { data: deployedModel, isLoading: deployLoading } = useDeployedModel(id);
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const deployModel = useDeployModel();
  const stopModel = useStopModel();
  const [runningSignal, setRunningSignal] = useState(false);

  const handleDeploy = async () => {
    if (!model) return;
    await deployModel.mutateAsync(model.id);
  };

  const handleStop = async () => {
    if (!model) return;
    await stopModel.mutateAsync(model.id);
  };

  const handleRunNow = async () => {
    if (!model) return;
    setRunningSignal(true);
    try {
      const response = await supabase.functions.invoke('run-automations', { body: { modelId: model.id } });
      if (response.error) throw new Error(response.error.message);
      toast({ title: 'Signal cycle triggered', description: 'Check the signals list below in a moment.' });
    } catch (err: any) {
      toast({ title: 'Failed to trigger signal', description: err.message, variant: 'destructive' });
    } finally {
      setRunningSignal(false);
    }
  };

  const handlePauseResume = async () => {
    if (!model) return;
    const newStatus = model.status === 'published' ? 'draft' : 'published';
    try {
      await updateModel.mutateAsync({ id: model.id, updates: { status: newStatus } });
      toast({ title: newStatus === 'published' ? 'Model resumed' : 'Model paused', description: newStatus === 'published' ? 'Your model is now live on the marketplace.' : 'Your model is hidden from the marketplace.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update model status.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!model) return;
    try {
      await deleteModel.mutateAsync(model.id);
      toast({ title: 'Model deleted', description: 'Your model has been removed from the marketplace.' });
      navigate('/community');
    } catch {
      toast({ title: 'Error', description: 'Failed to delete model.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container max-w-4xl py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container max-w-4xl py-8 flex flex-col items-center justify-center gap-4 min-h-[60vh]">
          <AlertTriangle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Model not found</p>
          <p className="text-sm text-muted-foreground">This model may have been removed or made private.</p>
          <BackButton fallbackPath="/community" />
        </main>
      </div>
    );
  }

  const developer = (model as any).profiles;
  const isOwner = user?.id === model.user_id;
  const isSubscribed = !!subscription;

  const totalReturn = model.total_return ?? 0;
  const isPositiveReturn = totalReturn >= 0;
  const sharpe = model.sharpe_ratio ?? null;
  const winRate = model.win_rate ?? null;
  const maxDrawdown = model.max_drawdown ?? null;

  // Best backtest equity curve
  const latestBacktest = backtests?.[0];
  const equityCurve = (latestBacktest?.equity_curve as Array<{ date: string; value: number }> | null) || [];

  // All signals for accurate counts, most recent 10 displayed
  const allSignals = signals ?? [];
  const recentSignals = allSignals.slice(0, 10);

  // Signal counts from ALL signals (not just recent 10)
  const buyCount = allSignals.filter(s => s.signal_type === 'BUY').length;
  const sellCount = allSignals.filter(s => s.signal_type === 'SELL').length;
  const executedCount = allSignals.filter(s => s.status === 'executed').length;

  // Risk tier
  const riskLevel = (model as any).risk_level ?? 'medium';
  const riskColor =
    riskLevel === 'low' ? 'text-profit' :
    riskLevel === 'high' ? 'text-loss' : 'text-chart-4';

  // AI-generated indicators from model configuration
  const config = (model as any).configuration ?? {};
  const indicatorsSource = config.indicators ?? config;
  const customIndicators: any[] =
    (indicatorsSource.custom && Array.isArray(indicatorsSource.custom) ? indicatorsSource.custom : null) ??
    (Array.isArray(config.custom_indicators) ? config.custom_indicators : null) ??
    [];

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container max-w-4xl py-8 space-y-8">
        <BackButton fallbackPath="/community" className="mb-2" />

        {/* ── Hero ── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold leading-tight">{model.name}</h1>
              {model.is_public && (
                <Badge variant="secondary" className="text-xs">Public</Badge>
              )}
              {isSubscribed && (
                <Badge className="text-xs gap-1">
                  <CheckCircle className="h-3 w-3" /> Subscribed
                </Badge>
              )}
            </div>

            {model.description && (
              <p className="text-muted-foreground text-sm mt-1">{model.description}</p>
            )}

            {(model as any).strategy_overview && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                {(model as any).strategy_overview}
              </p>
            )}

            {/* Developer */}
            {developer && (
              <button
                className="flex items-center gap-2 mt-4 group"
                onClick={() => navigate(`/profile/${developer.id}`)}
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={developer.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {(developer.display_name || developer.username || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {developer.display_name || developer.username}
                </span>
                {developer.is_verified && (
                  <Shield className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
            )}

            <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
              <span>Model type: <span className="capitalize font-medium text-foreground">{model.model_type}</span></span>
              <span>·</span>
              <span>Risk: <span className={`font-medium capitalize ${riskColor}`}>{riskLevel}</span></span>
              {(model as any).ticker && (
                <>
                  <span>·</span>
                  <span>Trades <span className="font-medium text-foreground">{(model as any).ticker}</span></span>
                </>
              )}
            </div>
          </div>

          {/* Subscribe CTA for non-owners */}
          {!isOwner && model.is_public && (
            <div className="flex flex-col items-end gap-2 shrink-0">
              <ModelSubscribeButton
                modelId={model.id}
                modelName={model.name}
                performanceFee={model.performance_fee_percent ?? 0}
                minAllocation={(model as any).min_allocation ?? 100}
                maxAllocation={(model as any).max_allocation ?? 10000}
                size="lg"
              />
              <p className="text-xs text-muted-foreground text-right">
                {model.total_subscribers ?? 0} subscriber{model.total_subscribers !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Owner controls */}
          {isOwner && (
            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Marketplace visibility badge */}
              <Badge variant={model.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                <Settings2 className="h-3 w-3 mr-1" />
                {model.status === 'published' ? 'Published' : model.status === 'draft' ? 'Draft' : model.status}
              </Badge>
              {/* Trading deployment status */}
              <Badge
                variant={deployedModel?.status === 'running' ? 'default' : 'secondary'}
                className={`text-xs ${deployedModel?.status === 'running' ? 'bg-profit text-profit-foreground' : ''}`}
              >
                <Radio className="h-3 w-3 mr-1" />
                {deployedModel?.status === 'running' ? 'Trading Live' : deployedModel?.status === 'stopped' ? 'Trading Stopped' : 'Not Deployed'}
              </Badge>
              <div className="flex gap-2 flex-wrap justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePauseResume}
                  disabled={updateModel.isPending}
                  className="gap-1.5"
                >
                  {model.status === 'published' ? (
                    <><Pause className="h-3.5 w-3.5" /> Pause</>
                  ) : (
                    <><Play className="h-3.5 w-3.5" /> Resume</>
                  )}
                </Button>
                {/* Deploy / Stop trading */}
                {deployedModel?.status === 'running' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStop}
                    disabled={stopModel.isPending}
                    className="gap-1.5 border-loss/40 text-loss hover:bg-loss/10"
                  >
                    <Square className="h-3.5 w-3.5" /> Stop Trading
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleDeploy}
                    disabled={deployModel.isPending || deployLoading}
                    className="gap-1.5"
                  >
                    <Rocket className="h-3.5 w-3.5" /> Deploy
                  </Button>
                )}
                {/* Run Now (only when deployed) */}
                {deployedModel?.status === 'running' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRunNow}
                    disabled={runningSignal}
                    className="gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${runningSignal ? 'animate-spin' : ''}`} /> Run Now
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-1.5">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete model?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove <strong>{model.name}</strong> from the marketplace. All subscribers will lose access. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {deployedModel?.last_signal_at && (
                <p className="text-xs text-muted-foreground text-right">
                  Last signal: {new Date(deployedModel.last_signal_at).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground text-right">
                {model.total_subscribers ?? 0} subscriber{model.total_subscribers !== 1 ? 's' : ''}
              </p>
            </div>
          )}

        </div>

        <Separator />

        {/* ── Key Metrics ── */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Performance</h2>
            {latestBacktest?.status === 'completed' && (model.total_return != null || model.win_rate != null) && (
              <span className="text-xs text-muted-foreground">
                Based on backtest: {latestBacktest.start_date} → {latestBacktest.end_date}
              </span>
            )}
            {allSignals.length > 0 && model.win_rate != null && !latestBacktest && (
              <span className="text-xs text-muted-foreground">Based on live signals</span>
            )}
          </div>

          {/* No metrics yet callout */}
          {model.total_return == null && model.win_rate == null && model.sharpe_ratio == null ? (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                {isOwner ? (
                  <>
                    <p className="text-sm font-medium">No performance data yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Run a backtest to populate metrics — they'll appear here and on the marketplace automatically.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Performance data not yet available</p>
                    <p className="text-xs text-muted-foreground mt-1">The model creator hasn't run a backtest yet.</p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Return"
                value={model.total_return != null ? `${isPositiveReturn ? '+' : ''}${(totalReturn * 100).toFixed(2)}%` : '—'}
                icon={isPositiveReturn ? TrendingUp : TrendingDown}
                colorClass={model.total_return != null ? (isPositiveReturn ? 'text-profit' : 'text-loss') : undefined}
                sub="Since inception"
              />
              <StatCard
                label="Sharpe Ratio"
                value={sharpe != null ? sharpe.toFixed(2) : '—'}
                icon={BarChart3}
                colorClass={sharpe != null && sharpe >= 1 ? 'text-profit' : undefined}
                sub="Risk-adjusted return"
              />
              <StatCard
                label="Win Rate"
                value={winRate != null ? `${(winRate * 100).toFixed(1)}%` : '—'}
                icon={Target}
                colorClass={winRate != null && winRate >= 0.5 ? 'text-profit' : 'text-loss'}
                sub="Winning trades"
              />
              <StatCard
                label="Max Drawdown"
                value={maxDrawdown != null ? `-${(maxDrawdown * 100).toFixed(2)}%` : '—'}
                icon={AlertTriangle}
                colorClass="text-loss"
                sub="Worst peak-to-trough"
              />
            </div>
          )}
        </div>

        {/* ── Capital Requirements ── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Capital & Exposure</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Min Allocation</span>
                </div>
                <p className="text-xl font-bold">
                  ${((model as any).min_allocation ?? 100).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Max Allocation</span>
                </div>
                <p className="text-xl font-bold">
                  ${((model as any).max_allocation ?? 10000).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Max Exposure / Trade</span>
                </div>
                <p className="text-xl font-bold">
                  {(model as any).max_exposure_percent != null
                    ? `${(model as any).max_exposure_percent}%`
                    : `${(model as any).position_size_percent ?? 10}%`}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Equity Curve ── */}
        {equityCurve.length <= 1 && isOwner && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Equity Curve</h2>
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No backtest run yet</p>
                <p className="text-xs text-muted-foreground mt-1">Go to the Model Builder and run a backtest — the equity curve and performance metrics will appear here automatically.</p>
              </CardContent>
            </Card>
          </div>
        )}
        {equityCurve.length > 1 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Equity Curve
              {latestBacktest && (
                <span className="ml-2 text-xs font-normal normal-case">
                  ({latestBacktest.start_date} → {latestBacktest.end_date})
                </span>
              )}
            </h2>
            <Card>
              <CardContent className="pt-5">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-muted-foreground text-xs" tick={{ fontSize: 11 }} />
                      <YAxis className="text-muted-foreground" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(v: number) => [`$${v.toLocaleString()}`, 'Portfolio']}
                      />
                      {equityCurve[0]?.value && (
                        <ReferenceLine
                          y={equityCurve[0].value}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="4 4"
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={isPositiveReturn ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Recent Signals ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Signals
              </h2>
              {allSignals.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {allSignals.length} total · {executedCount} executed · {buyCount} buy / {sellCount} sell
                </p>
              )}
            </div>
            {recentSignals.length > 0 && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-profit" /> {buyCount} buy
                </span>
                <span className="flex items-center gap-1">
                  <ArrowDownRight className="h-3.5 w-3.5 text-loss" /> {sellCount} sell
                </span>
              </div>
            )}
          </div>

          {recentSignals.length > 0 ? (
            <Card>
              <CardContent className="pt-4 pb-2">
                <div className="divide-y divide-border">
                  {recentSignals.map((signal) => (
                    <div key={signal.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            signal.signal_type === 'BUY' ? 'default' :
                            signal.signal_type === 'SELL' ? 'destructive' : 'secondary'
                          }
                          className="w-14 justify-center text-xs"
                        >
                          {signal.signal_type}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{signal.ticker}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(signal.generated_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        {signal.price_at_signal != null && (
                          <div>
                            <p className="text-xs text-muted-foreground">Price</p>
                            <p className="text-sm font-medium">${signal.price_at_signal.toFixed(2)}</p>
                          </div>
                        )}
                        {signal.confidence != null && (
                          <div>
                            <p className="text-xs text-muted-foreground">Confidence</p>
                            <p className="text-sm font-medium">{(signal.confidence * 100).toFixed(0)}%</p>
                          </div>
                        )}
                        <Badge
                          variant={signal.status === 'executed' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {signal.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No signals generated yet.</p>
                {isOwner ? (
                  deployedModel?.status === 'running' ? (
                    <p className="text-xs text-muted-foreground mt-1">Your model is deployed. Click "Run Now" to trigger a signal cycle manually, or wait for the next automatic cycle.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Click <strong>Deploy</strong> above to start live trading — signals will appear here once the model is running.</p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Signals appear here once the model owner deploys it for live trading.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── AI-Generated Indicators ── */}
        {customIndicators.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-Generated Indicators
            </h2>
            <div className="space-y-3">
              {customIndicators.map((indicator: any, i: number) => (
                <Card key={i}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 shrink-0">
                          <Code2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{indicator.name ?? `Custom Indicator ${i + 1}`}</p>
                          {indicator.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{indicator.description}</p>
                          )}
                          {indicator.signal_logic && (
                            <div className="mt-2 p-2 rounded bg-muted/50 font-mono text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                              {indicator.signal_logic}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary">
                          <Sparkles className="h-3 w-3" /> AI
                        </Badge>
                        {indicator.weight != null && (
                          <span className="text-xs text-muted-foreground">Weight: {indicator.weight}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}


        {isSubscribed && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Your Subscription
            </h2>
            <Card>
              <CardContent className="pt-5 flex items-center gap-4">
                <CheckCircle className="h-8 w-8 text-profit shrink-0" />
                <div>
                  <p className="font-medium">You are subscribed to this model</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    All future signals will be mirrored to your connected brokerage account automatically.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Community stat ── */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground pb-4">
          <Users className="h-4 w-4" />
          <span>{model.total_subscribers ?? 0} active subscriber{model.total_subscribers !== 1 ? 's' : ''}</span>
        </div>
      </main>
    </div>
  );
}
