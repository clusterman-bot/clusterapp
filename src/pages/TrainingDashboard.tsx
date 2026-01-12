import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingRuns, useValidationRuns, TrainingRun } from '@/hooks/useMLTraining';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Clock,
  Trophy,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export default function TrainingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: trainingRuns, isLoading: trainingLoading } = useTrainingRuns();
  const { data: validationRuns, isLoading: validationLoading } = useValidationRuns();

  if (!user) {
    navigate('/auth');
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-600">Running</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const completedRuns = trainingRuns?.filter(r => r.status === 'completed') || [];
  const runningRuns = trainingRuns?.filter(r => r.status === 'running' || r.status === 'pending') || [];

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      
      <main className="container py-8">
        <BackButton fallbackPath="/dashboard" className="mb-6" />
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Training Dashboard</h1>
              <p className="text-muted-foreground">Monitor your ML model training runs</p>
            </div>
          </div>
          <Button onClick={() => navigate('/models/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Training
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Runs</p>
                  <p className="text-2xl font-bold">{trainingRuns?.length || 0}</p>
                </div>
                <Brain className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{completedRuns.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">{runningRuns.length}</p>
                </div>
                <Loader2 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                  <p className="text-2xl font-bold">
                    {completedRuns.length > 0
                      ? `${(
                          completedRuns.reduce(
                            (acc, r) => acc + (r.best_model_metrics?.accuracy || 0),
                            0
                          ) / completedRuns.length * 100
                        ).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
                <Trophy className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Runs</TabsTrigger>
            <TabsTrigger value="running">In Progress ({runningRuns.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedRuns.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <TrainingRunsList 
              runs={trainingRuns || []} 
              isLoading={trainingLoading}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="running" className="mt-6">
            <TrainingRunsList 
              runs={runningRuns} 
              isLoading={trainingLoading}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <TrainingRunsList 
              runs={completedRuns} 
              isLoading={trainingLoading}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TrainingRunsList({ 
  runs, 
  isLoading,
  getStatusIcon,
  getStatusBadge
}: { 
  runs: TrainingRun[];
  isLoading: boolean;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground mt-4">Loading training runs...</p>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No training runs found</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/models/new'}>
            Start Your First Training
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <Card key={run.id} className="hover:border-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  {getStatusIcon(run.status)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{run.ticker}</h3>
                    {getStatusBadge(run.status)}
                    {run.best_model_name && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-yellow-500" />
                        {run.best_model_name.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {run.start_date} to {run.end_date}
                    </span>
                    <span>
                      Started {format(new Date(run.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
              </div>

              {run.status === 'completed' && run.best_model_metrics && (
                <div className="text-right">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                      <p className="font-mono font-semibold text-green-600">
                        {(run.best_model_metrics.accuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">F1 Score</p>
                      <p className="font-mono font-semibold">
                        {(run.best_model_metrics.f1 * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Recall</p>
                      <p className="font-mono font-semibold">
                        {(run.best_model_metrics.recall * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {run.status === 'running' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Training in progress...</span>
                </div>
              )}
            </div>

            {run.status === 'completed' && run.results && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">All Model Results</p>
                <div className="flex gap-4">
                  {Object.entries(run.results).map(([name, metrics]) => (
                    <div 
                      key={name} 
                      className={`px-3 py-2 rounded-lg text-sm ${
                        name === run.best_model_name 
                          ? 'bg-yellow-500/10 border border-yellow-500/30' 
                          : 'bg-muted'
                      }`}
                    >
                      <span className="capitalize font-medium">{name.replace('_', ' ')}</span>
                      <span className="text-muted-foreground ml-2">
                        {((metrics as any).accuracy * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
