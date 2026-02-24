import { useState } from 'react';
import { Zap, CheckCircle2, Loader2, AlertCircle, ChevronDown, ChevronUp, Cpu, BarChart3, Code, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useStartQuickBuild, useQuickBuildRun, useQuickBuildRuns } from '@/hooks/useQuickBuild';
import { useTrainingRun, type TrainingRun } from '@/hooks/useMLTraining';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface QuickBuildPanelProps {
  symbol: string;
}

const STEPS = [
  { key: 'analyzing', label: 'Analyzing Data', icon: BarChart3 },
  { key: 'training', label: 'Training Models', icon: Cpu },
  { key: 'validating', label: 'Validating', icon: CheckCircle2 },
  { key: 'completed', label: 'Complete', icon: Rocket },
];

function StepperProgress({ status }: { status: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const isFailed = status === 'failed';

  return (
    <div className="flex items-center gap-1 w-full my-4">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentIdx;
        const isDone = i < currentIdx || status === 'completed';

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${
                  isDone
                    ? 'bg-primary text-primary-foreground'
                    : isActive && !isFailed
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : isFailed && isActive
                    ? 'bg-destructive/20 text-destructive border-2 border-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : isActive && !isFailed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] text-center ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 rounded ${isDone ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ModelComparisonTable({ results }: { results: Record<string, { accuracy: number; f1: number; recall: number }> }) {
  const entries = Object.entries(results);
  const best = entries.reduce((b, [n, m]) => (m.accuracy > (b.metrics?.accuracy || 0) ? { name: n, metrics: m } : b), { name: '', metrics: null as any });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-muted-foreground font-medium">Model</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Accuracy</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">F1</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium">Recall</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, metrics]) => (
            <tr key={name} className={`border-b border-border/50 ${name === best.name ? 'bg-primary/5' : ''}`}>
              <td className="py-2 px-3 flex items-center gap-2">
                <span className="font-mono text-xs">{name.replace(/_/g, ' ')}</span>
                {name === best.name && <Badge variant="default" className="text-[10px] px-1.5 py-0">Best</Badge>}
              </td>
              <td className="text-right py-2 px-3 font-mono">{(metrics.accuracy * 100).toFixed(1)}%</td>
              <td className="text-right py-2 px-3 font-mono">{(metrics.f1 * 100).toFixed(1)}%</td>
              <td className="text-right py-2 px-3 font-mono">{(metrics.recall * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuickBuildPanel({ symbol }: QuickBuildPanelProps) {
  const navigate = useNavigate();
  const startBuild = useStartQuickBuild();
  const { data: pastRuns } = useQuickBuildRuns(symbol);
  const [activeRunId, setActiveRunId] = useState<string | undefined>();
  const { data: activeRun } = useQuickBuildRun(activeRunId);
  const { data: trainingRun } = useTrainingRun(activeRun?.training_run_id ?? undefined);
  const [showCode, setShowCode] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  // If there's an in-progress run and we don't have one selected, pick it
  const latestInProgress = pastRuns?.find((r) => !['completed', 'failed'].includes(r.status));
  const runId = activeRunId || latestInProgress?.id;
  const run = activeRun || latestInProgress;

  const handleStart = async () => {
    try {
      const result = await startBuild.mutateAsync(symbol);
      setActiveRunId(result.run_id);
      toast.success('Quick Build started!');
    } catch {
      toast.error('Failed to start Quick Build');
    }
  };

  const isRunning = run && !['completed', 'failed'].includes(run.status);
  const isComplete = run?.status === 'completed';
  const isFailed = run?.status === 'failed';
  const trainingResults = trainingRun?.results as Record<string, { accuracy: number; f1: number; recall: number }> | null;

  const configCode = run
    ? JSON.stringify(
        {
          symbol: run.symbol,
          indicators: run.indicators_config,
          hyperparameters: run.hyperparameters,
          training_period: run.training_period,
          validation_period: run.validation_period,
          best_model: trainingRun?.best_model_name,
          best_model_metrics: trainingRun?.best_model_metrics,
        },
        null,
        2
      )
    : '';

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Quick Build
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!run && (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              AI will analyze {symbol}'s market data, select optimal indicators, train Random Forest, Gradient Boosting & Logistic Regression models, then validate the best one.
            </p>
            <Button onClick={handleStart} disabled={startBuild.isPending} className="w-full">
              {startBuild.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              Build Best Bot
            </Button>
          </div>
        )}

        {isRunning && (
          <>
            <StepperProgress status={run.status} />
            <Progress value={STEPS.findIndex((s) => s.key === run.status) * 33} className="h-1" />
            <p className="text-xs text-muted-foreground text-center">This may take a few moments…</p>
          </>
        )}

        {isFailed && (
          <div className="text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{run.error_message || 'Quick Build failed'}</p>
            <Button onClick={handleStart} variant="outline" size="sm">
              <Zap className="mr-2 h-3 w-3" /> Try Again
            </Button>
          </div>
        )}

        {isComplete && (
          <>
            <StepperProgress status="completed" />

            {/* AI Reasoning */}
            {run.ai_analysis?.reasoning && (
              <Collapsible open={showReasoning} onOpenChange={setShowReasoning}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                    AI Analysis Reasoning
                    {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {run.ai_analysis.reasoning}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Custom Indicators */}
            {run.indicators_config?.custom_indicators?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5 text-primary" />
                  Custom Indicators ({run.indicators_config.custom_indicators.length})
                </h4>
                <div className="space-y-2">
                  {run.indicators_config.custom_indicators.map((ind: { name: string; description: string; code: string }, i: number) => (
                    <div key={i} className="bg-muted/50 rounded-md p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium text-foreground">{ind.name}</span>
                        <Badge variant="secondary" className="text-[10px]">AI Generated</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{ind.description}</p>
                      <pre className="bg-background rounded p-2 text-[11px] font-mono overflow-x-auto">{ind.code}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Model Comparison */}
            {trainingResults && (
              <div>
                <h4 className="text-sm font-medium mb-2">Model Comparison</h4>
                <ModelComparisonTable results={trainingResults} />
              </div>
            )}

            {/* Periods */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded p-2">
                <span className="text-muted-foreground">Training</span>
                <p className="font-mono mt-0.5">{run.training_period}</p>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <span className="text-muted-foreground">Validation</span>
                <p className="font-mono mt-0.5">{run.validation_period}</p>
              </div>
            </div>

            {/* Full Code */}
            <Collapsible open={showCode} onOpenChange={setShowCode}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <Code className="h-3 w-3" /> View Full Configuration
                  </span>
                  {showCode ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto font-mono max-h-64 overflow-y-auto">
                  {configCode}
                </pre>
              </CollapsibleContent>
            </Collapsible>

            {/* Deploy button */}
            <Button
              className="w-full"
              onClick={() => navigate(`/trade/stocks/${symbol}/automate`)}
            >
              <Rocket className="mr-2 h-4 w-4" /> Deploy This Bot
            </Button>
          </>
        )}

        {/* Past runs list */}
        {pastRuns && pastRuns.length > 0 && !isRunning && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground mb-2">Previous Quick Builds</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {pastRuns.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRunId(r.id)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded flex justify-between items-center hover:bg-muted/50 transition-colors ${
                    r.id === runId ? 'bg-muted' : ''
                  }`}
                >
                  <span className="font-mono">{new Date(r.created_at).toLocaleDateString()}</span>
                  <Badge variant={r.status === 'completed' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {r.status}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
