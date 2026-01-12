import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrainingRun } from '@/hooks/useMLTraining';
import { CheckCircle, XCircle, Loader2, Clock, Trophy } from 'lucide-react';

interface TrainingProgressProps {
  trainingRun: TrainingRun | null;
  isLoading?: boolean;
}

export function TrainingProgress({ trainingRun, isLoading }: TrainingProgressProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-4">Loading training status...</p>
        </CardContent>
      </Card>
    );
  }

  if (!trainingRun) {
    return null;
  }

  const getStatusIcon = () => {
    switch (trainingRun.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (trainingRun.status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-600">Training...</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getProgress = () => {
    switch (trainingRun.status) {
      case 'completed':
        return 100;
      case 'running':
        return 50;
      case 'pending':
        return 10;
      default:
        return 0;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle>Training Progress</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          {trainingRun.ticker} · {trainingRun.start_date} to {trainingRun.end_date}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{getProgress()}%</span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </div>

        {trainingRun.status === 'completed' && trainingRun.results && (
          <div className="space-y-4">
            <h4 className="font-medium">Model Results</h4>
            <div className="grid gap-3">
              {Object.entries(trainingRun.results).map(([modelName, metrics]) => (
                <div
                  key={modelName}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    modelName === trainingRun.best_model_name
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {modelName === trainingRun.best_model_name && (
                      <Trophy className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium capitalize">
                      {modelName.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Accuracy: </span>
                      <span className="font-mono">{((metrics as any).accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">F1: </span>
                      <span className="font-mono">{((metrics as any).f1 * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Recall: </span>
                      <span className="font-mono">{((metrics as any).recall * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {trainingRun.best_model_name && (
              <div className="p-4 rounded-lg bg-green-600/10 border border-green-600/20">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Trophy className="h-5 w-5" />
                  <span className="font-medium">Best Model: {trainingRun.best_model_name.replace('_', ' ')}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Achieved {((trainingRun.best_model_metrics?.accuracy || 0) * 100).toFixed(1)}% accuracy
                </p>
              </div>
            )}
          </div>
        )}

        {trainingRun.status === 'failed' && trainingRun.error_message && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{trainingRun.error_message}</p>
          </div>
        )}

        {trainingRun.status === 'running' && (
          <div className="text-center py-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-muted-foreground mt-4">
              Training models... This may take a few minutes.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
