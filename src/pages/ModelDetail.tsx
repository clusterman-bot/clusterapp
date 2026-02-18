import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModel } from '@/hooks/useModels';
import { useModelSignals } from '@/hooks/useDeployedModels';
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
import {
  TrendingUp, TrendingDown, Users, Shield, Wallet,
  BarChart3, Target, Zap, Activity, AlertTriangle,
  CheckCircle, Clock, ArrowUpRight, ArrowDownRight
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
  const { data: subscription } = useIsSubscribed(id);
  const { data: backtests } = useBacktests(id!);

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

  // Recent signals (last 10)
  const recentSignals = signals?.slice(0, 10) ?? [];

  // Signal counts from recent signals
  const buyCount = recentSignals.filter(s => s.signal_type === 'BUY').length;
  const sellCount = recentSignals.filter(s => s.signal_type === 'SELL').length;

  // Risk tier
  const riskLevel = (model as any).risk_level ?? 'medium';
  const riskColor =
    riskLevel === 'low' ? 'text-profit' :
    riskLevel === 'high' ? 'text-loss' : 'text-chart-4';

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

          {/* Subscribe CTA */}
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
        </div>

        <Separator />

        {/* ── Key Metrics ── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Return"
              value={`${isPositiveReturn ? '+' : ''}${(totalReturn * 100).toFixed(2)}%`}
              icon={isPositiveReturn ? TrendingUp : TrendingDown}
              colorClass={isPositiveReturn ? 'text-profit' : 'text-loss'}
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
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Signals
            </h2>
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
                <p className="text-xs text-muted-foreground mt-1">Signals appear here once the model is live.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Subscriber stats (if subscribed) ── */}
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
