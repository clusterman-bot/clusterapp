import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModel, useDeleteModel } from '@/hooks/useModels';
import { useBacktests } from '@/hooks/useBacktests';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, Play, Trash2, Edit, Users, 
  BarChart3, TrendingDown, Target, Calendar 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ModelDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: model, isLoading } = useModel(id!);
  const { data: backtests } = useBacktests(id!);
  const deleteModel = useDeleteModel();

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Model not found</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isOwner = model.user_id === user.id;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    try {
      await deleteModel.mutateAsync(model.id);
      toast({ title: 'Deleted', description: 'Model deleted successfully' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Mock equity curve data for visualization
  const equityCurve = backtests?.[0]?.equity_curve as Array<{ date: string; value: number }> || [
    { date: '2024-01', value: 100000 },
    { date: '2024-02', value: 105000 },
    { date: '2024-03', value: 102000 },
    { date: '2024-04', value: 115000 },
    { date: '2024-05', value: 118000 },
    { date: '2024-06', value: 125000 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-8">
        <BackButton fallbackPath="/dashboard" className="mb-4" />
        
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{model.name}</h1>
              <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>
                {model.status}
              </Badge>
              {model.is_public && <Badge variant="outline">Public</Badge>}
            </div>
            <p className="text-muted-foreground">{model.description}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {model.model_type} • Created {new Date(model.created_at!).toLocaleDateString()}
            </p>
          </div>
          {isOwner && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/models/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Return</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(model.total_return || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                {((model.total_return || 0) * 100).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(model.sharpe_ratio || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-loss">
                {((model.max_drawdown || 0) * 100).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{((model.win_rate || 0) * 100).toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="backtests">Backtests</TabsTrigger>
            <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Equity Curve</CardTitle>
                <CardDescription>Portfolio value over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))' 
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backtests">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Backtest History</CardTitle>
                  <CardDescription>Historical performance simulations</CardDescription>
                </div>
                {isOwner && (
                  <Button onClick={() => navigate(`/models/${id}/backtest`)}>
                    <Play className="mr-2 h-4 w-4" /> Run Backtest
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {backtests && backtests.length > 0 ? (
                  <div className="space-y-4">
                    {backtests.map((backtest) => (
                      <div 
                        key={backtest.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{backtest.name || 'Unnamed Backtest'}</p>
                            <p className="text-sm text-muted-foreground">
                              {backtest.start_date} to {backtest.end_date}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Return</p>
                            <p className={`font-medium ${(backtest.total_return || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {((backtest.total_return || 0) * 100).toFixed(2)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Sharpe</p>
                            <p className="font-medium">{(backtest.sharpe_ratio || 0).toFixed(2)}</p>
                          </div>
                          <Badge variant={backtest.status === 'completed' ? 'default' : 'secondary'}>
                            {backtest.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No backtests yet.</p>
                    {isOwner && (
                      <Button onClick={() => navigate(`/models/${id}/backtest`)}>
                        <Play className="mr-2 h-4 w-4" /> Run First Backtest
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscribers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Subscribers
                </CardTitle>
                <CardDescription>
                  {model.total_subscribers || 0} users subscribed to this model
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(model.total_subscribers || 0) > 0 ? (
                  <p className="text-muted-foreground">Subscriber details coming soon...</p>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No subscribers yet.</p>
                    {model.is_public && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Share your model to attract subscribers!
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Model Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">Visibility</p>
                    <p className="text-sm text-muted-foreground">
                      {model.is_public ? 'Public - visible to all users' : 'Private - only you can see this'}
                    </p>
                  </div>
                  <Badge variant={model.is_public ? 'default' : 'secondary'}>
                    {model.is_public ? 'Public' : 'Private'}
                  </Badge>
                </div>
                {model.is_public && (
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium">Performance Fee</p>
                      <p className="text-sm text-muted-foreground">
                        Charged to subscribers on profitable trades
                      </p>
                    </div>
                    <span className="font-medium">{model.performance_fee_percent}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">Strategy Overview</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {model.strategy_overview || 'No overview provided'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
