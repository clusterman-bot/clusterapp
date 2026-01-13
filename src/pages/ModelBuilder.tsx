import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useCreateModel } from '@/hooks/useModels';
import { useStartTraining, useStopTraining, useTrainingRun, useTrainingRealtimeUpdates, useStartValidation, useValidationRuns, IndicatorsConfig as IndicatorsConfigType, HyperparametersConfig as HyperparametersConfigType } from '@/hooks/useMLTraining';
import { useSandboxExecute, useValidateSandboxCode } from '@/hooks/useSandbox';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { IndicatorsConfig } from '@/components/ml/IndicatorsConfig';
import { HyperparametersConfig } from '@/components/ml/HyperparametersConfig';
import { ModelSelection } from '@/components/ml/ModelSelection';
import { TrainingProgress } from '@/components/ml/TrainingProgress';
import { CodeTerminal } from '@/components/CodeTerminal';
import { Code, Brain, Calendar, TrendingUp, Rocket, FlaskConical, CheckCircle2, StopCircle, Upload, Key, Plus, Trash2, Zap, AlertCircle } from 'lucide-react';

type ModelType = 'sandbox' | 'ml';

const defaultIndicators: IndicatorsConfigType = {
  sma: { enabled: true, windows: [5, 10, 20, 50] },
  rsi: { enabled: true, period: 14 },
  bollinger: { enabled: true, window: 20, std: 2 },
  volatility: { enabled: true, window: 20 },
  sma_deviation: { enabled: true },
};

const defaultHyperparameters: HyperparametersConfigType = {
  random_forest: { n_estimators: 100, max_depth: 10, min_samples_split: 2 },
  gradient_boosting: { n_estimators: 100, learning_rate: 0.1, max_depth: 3 },
  logistic_regression: { C: 1.0, max_iter: 1000 },
};

export default function ModelBuilder() {
  const { user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createModel = useCreateModel();
  const startTraining = useStartTraining();
  const stopTraining = useStopTraining();
  const startValidation = useStartValidation();
  const sandboxExecute = useSandboxExecute();
  const validateCode = useValidateSandboxCode();
  
  // Only developers can create models (not admins)
  const canCreateModels = userRole?.role === 'developer';
  
  // Redirect admins away from model creation
  useEffect(() => {
    if (!roleLoading && userRole?.role === 'admin') {
      toast({ 
        title: 'Access Denied', 
        description: 'Administrators cannot create trading models',
        variant: 'destructive' 
      });
      navigate('/admin', { replace: true });
    }
  }, [userRole, roleLoading, navigate, toast]);

  const [modelType, setModelType] = useState<ModelType | null>(null);
  const [activeTab, setActiveTab] = useState('config');
  
  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [strategyOverview, setStrategyOverview] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [performanceFee, setPerformanceFee] = useState('20');

  // ML Configuration
  const [ticker, setTicker] = useState('AAPL');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');
  const [horizon, setHorizon] = useState(5);
  const [theta, setTheta] = useState(0.01);
  const [indicators, setIndicators] = useState<IndicatorsConfigType>(defaultIndicators);
  const [hyperparameters, setHyperparameters] = useState<HyperparametersConfigType>(defaultHyperparameters);
  const [selectedModels, setSelectedModels] = useState({ rf: true, gb: true, lr: true });
  const [demoMode, setDemoMode] = useState(true); // Demo mode for testing without API limits
  
  // Training state
  const [trainingRunId, setTrainingRunId] = useState<string | null>(null);
  const { data: trainingRun, isLoading: trainingLoading } = useTrainingRun(trainingRunId || undefined);
  useTrainingRealtimeUpdates(trainingRunId || undefined);

  // Validation state
  const [validationStartDate, setValidationStartDate] = useState('2024-01-01');
  const [validationEndDate, setValidationEndDate] = useState('2024-06-01');
  const { data: validationRuns, isLoading: validationRunsLoading } = useValidationRuns(trainingRunId || undefined);

  // Sandbox code state
  const [sandboxCode, setSandboxCode] = useState(`import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier

def generate_signals(data: pd.DataFrame) -> pd.DataFrame:
    """
    Generate trading signals based on your custom logic.
    
    Args:
        data: DataFrame with OHLCV columns (open, high, low, close, volume)
    
    Returns:
        DataFrame with 'signal' column: 1 (buy), -1 (sell), 0 (hold)
    """
    # Calculate simple moving averages
    data['sma_20'] = data['close'].rolling(window=20).mean()
    data['sma_50'] = data['close'].rolling(window=50).mean()
    
    # Generate signals based on SMA crossover
    data['signal'] = 0
    data.loc[data['sma_20'] > data['sma_50'], 'signal'] = 1
    data.loc[data['sma_20'] < data['sma_50'], 'signal'] = -1
    
    return data
`);

  // Custom API configurations
  const [customApis, setCustomApis] = useState<Array<{ name: string; endpoint: string; apiKey: string }>>([]);
  const [newApiName, setNewApiName] = useState('');
  const [newApiEndpoint, setNewApiEndpoint] = useState('');
  const [newApiKey, setNewApiKey] = useState('');

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; size: number; type: string }>>([]);

  const handleAddApi = () => {
    if (newApiName && newApiEndpoint) {
      setCustomApis([...customApis, { name: newApiName, endpoint: newApiEndpoint, apiKey: newApiKey }]);
      setNewApiName('');
      setNewApiEndpoint('');
      setNewApiKey('');
    }
  };

  const handleRemoveApi = (index: number) => {
    setCustomApis(customApis.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }));
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!roleLoading && userRole && !canCreateModels) {
      toast({ 
        title: 'Access Denied', 
        description: 'Only developers can create models.', 
        variant: 'destructive' 
      });
      navigate('/dashboard');
    }
  }, [userRole, roleLoading, canCreateModels, navigate, toast]);

  if (!user || roleLoading) {
    return null;
  }

  if (!canCreateModels) {
    return null;
  }

  const handleStartTraining = async () => {
    if (!ticker.trim()) {
      toast({ title: 'Error', description: 'Ticker symbol is required', variant: 'destructive' });
      return;
    }

    if (!selectedModels.rf && !selectedModels.gb && !selectedModels.lr) {
      toast({ title: 'Error', description: 'Select at least one model to train', variant: 'destructive' });
      return;
    }

    try {
      const result = await startTraining.mutateAsync({
        ticker: ticker.toUpperCase(),
        start_date: startDate,
        end_date: endDate,
        indicators,
        hyperparameters,
        horizon,
        theta,
        demo_mode: demoMode,
        limit: demoMode ? 5 : undefined,
      });
      
      setTrainingRunId(result.training_run_id);
      setActiveTab('training');
      toast({ 
        title: demoMode ? 'Demo Training Started' : 'Training Started', 
        description: demoMode 
          ? 'Using simulated data (5 data points) - no API calls needed.' 
          : 'Your model is now being trained with live data.'
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Model name is required', variant: 'destructive' });
      return;
    }

    const configuration = modelType === 'ml' ? {
      ticker,
      startDate,
      endDate,
      horizon,
      theta,
      indicators: JSON.parse(JSON.stringify(indicators)),
      hyperparameters: JSON.parse(JSON.stringify(hyperparameters)),
      selectedModels,
      trainingRunId,
    } : {};

    try {
      await createModel.mutateAsync({
        name,
        description,
        strategy_overview: strategyOverview,
        model_type: modelType || 'no-code',
        is_public: isPublic,
        performance_fee_percent: parseFloat(performanceFee),
        configuration: configuration as any,
        user_id: user.id,
      });
      toast({ title: 'Success', description: 'Model created successfully!' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Model type selection screen
  if (!modelType) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-8">
          <BackButton fallbackPath="/dashboard" className="mb-6" />
          
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Create New Model</h1>
            <p className="text-muted-foreground mb-8">Choose how you want to build your trading strategy</p>

            <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
              {/* ML Training Card */}
              <Card 
                className="cursor-pointer hover:border-primary transition-colors border-2"
                onClick={() => setModelType('ml')}
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>ML Model Training</CardTitle>
                  <CardDescription>
                    Train machine learning models using our professional training engines with real market data.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Random Forest, Gradient Boosting, LR</li>
                    <li>• Technical indicators (SMA, RSI, BB)</li>
                    <li>• Hyperparameter tuning</li>
                    <li>• Validation & backtesting</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Sandbox Card */}
              <Card 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setModelType('sandbox')}
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Code className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Sandbox Mode</CardTitle>
                  <CardDescription>
                    Write custom Python code that runs in an isolated container.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Full Python environment</li>
                    <li>• Custom indicators & logic</li>
                    <li>• Access to pandas, numpy, sklearn</li>
                    <li>• Complete control over execution</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ML Model Builder
  if (modelType === 'ml') {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-8">
          <Button variant="ghost" onClick={() => setModelType(null)} className="mb-6">
            ← Back to type selection
          </Button>

          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">ML Model Training</h1>
                <p className="text-muted-foreground">Configure and train your machine learning trading model</p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="indicators">Indicators</TabsTrigger>
                <TabsTrigger value="models">Models & Params</TabsTrigger>
                <TabsTrigger value="training">Training</TabsTrigger>
                <TabsTrigger value="validation" disabled={!trainingRun || trainingRun.status !== 'completed'}>
                  Validation
                </TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-6">
                {/* Data Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Market Data Configuration
                    </CardTitle>
                    <CardDescription>
                      Select the ticker and date range for training data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Demo Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${demoMode ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                          {demoMode ? <Zap className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                        </div>
                        <div>
                          <Label className="text-sm font-medium">
                            {demoMode ? 'Demo Mode (Recommended for Testing)' : 'Live Data Mode'}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {demoMode 
                              ? 'Uses 5 simulated data points - no API calls, instant results' 
                              : 'Uses Polygon API - may hit rate limits on free tier (5/min)'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={demoMode}
                        onCheckedChange={setDemoMode}
                      />
                    </div>
                    
                    {!demoMode && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Polygon free tier allows only 5 API calls/minute. Consider using Demo Mode for testing.</span>
                      </div>
                    )}
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Ticker Symbol</Label>
                        <Input
                          value={ticker}
                          onChange={(e) => setTicker(e.target.value.toUpperCase())}
                          placeholder="AAPL"
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Label Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Signal Generation (Labeling)
                    </CardTitle>
                    <CardDescription>
                      Configure how BUY/SELL/HOLD labels are generated
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Horizon (minutes)</Label>
                        <Input
                          type="number"
                          value={horizon}
                          onChange={(e) => setHorizon(parseInt(e.target.value) || 5)}
                          min={1}
                          max={60}
                        />
                        <p className="text-xs text-muted-foreground">
                          Look-ahead period in minutes for calculating future returns
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Theta (threshold)</Label>
                        <Input
                          type="number"
                          step="0.005"
                          value={theta}
                          onChange={(e) => setTheta(parseFloat(e.target.value) || 0.01)}
                          min={0.001}
                          max={0.1}
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum price change to trigger BUY/SELL signal
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Basic Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Model Information</CardTitle>
                    <CardDescription>Name and describe your model</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Model Name</Label>
                      <Input 
                        value={name} 
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., AAPL Momentum Strategy v1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of your strategy..."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button onClick={() => setActiveTab('indicators')}>
                    Next: Configure Indicators →
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="indicators" className="space-y-6">
                <IndicatorsConfig config={indicators} onChange={setIndicators} />
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab('config')}>
                    ← Back
                  </Button>
                  <Button onClick={() => setActiveTab('models')}>
                    Next: Select Models →
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="models" className="space-y-6">
                <ModelSelection selectedModels={selectedModels} onChange={setSelectedModels} />
                <HyperparametersConfig 
                  config={hyperparameters} 
                  onChange={setHyperparameters}
                  selectedModels={selectedModels}
                />
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab('indicators')}>
                    ← Back
                  </Button>
                  <Button 
                    onClick={handleStartTraining}
                    disabled={startTraining.isPending}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    {startTraining.isPending ? 'Starting...' : 'Start Training'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="training" className="space-y-6">
                <TrainingProgress trainingRun={trainingRun || null} isLoading={trainingLoading} />
                
                {/* Stop Training Button - shown when training is in progress */}
                {trainingRun && (trainingRun.status === 'pending' || trainingRun.status === 'running') && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="animate-pulse">
                          <div className="h-6 w-6 rounded-full bg-destructive/20 flex items-center justify-center">
                            <div className="h-3 w-3 rounded-full bg-destructive" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">Training in Progress</p>
                          <p className="text-sm text-muted-foreground">
                            You can stop the training if needed
                          </p>
                        </div>
                        <Button 
                          variant="destructive"
                          onClick={async () => {
                            if (!trainingRunId) return;
                            try {
                              await stopTraining.mutateAsync(trainingRunId);
                              toast({ title: 'Training Stopped', description: 'The training run has been cancelled.' });
                            } catch (error: any) {
                              toast({ title: 'Error', description: error.message, variant: 'destructive' });
                            }
                          }}
                          disabled={stopTraining.isPending}
                        >
                          <StopCircle className="h-4 w-4 mr-2" />
                          {stopTraining.isPending ? 'Stopping...' : 'Stop Training'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {trainingRun?.status === 'completed' && (
                  <Card className="border-green-500/50 bg-green-500/5">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                        <div>
                          <p className="font-medium">Training Complete!</p>
                          <p className="text-sm text-muted-foreground">
                            Best model: {trainingRun.best_model_name} • 
                            Accuracy: {((trainingRun.best_model_metrics?.accuracy || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                        <Button 
                          className="ml-auto"
                          onClick={() => setActiveTab('validation')}
                        >
                          <FlaskConical className="h-4 w-4 mr-2" />
                          Proceed to Validation
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!trainingRun && (
                  <div className="text-center py-12">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Configure your model and start training to see results here
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab('config')}
                    >
                      Go to Configuration
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="validation" className="space-y-6">
                {/* Validation Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FlaskConical className="h-5 w-5 text-primary" />
                      Validation Configuration
                    </CardTitle>
                    <CardDescription>
                      Test your trained model on out-of-sample data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Validation Start Date</Label>
                        <Input
                          type="date"
                          value={validationStartDate}
                          onChange={(e) => setValidationStartDate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Should be after training end date ({endDate})
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Validation End Date</Label>
                        <Input
                          type="date"
                          value={validationEndDate}
                          onChange={(e) => setValidationEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      onClick={async () => {
                        if (!trainingRunId) return;
                        try {
                          await startValidation.mutateAsync({
                            training_run_id: trainingRunId,
                            start_date: validationStartDate,
                            end_date: validationEndDate,
                          });
                          toast({ title: 'Validation Started', description: 'Your model is being validated.' });
                        } catch (error: any) {
                          toast({ title: 'Error', description: error.message, variant: 'destructive' });
                        }
                      }}
                      disabled={startValidation.isPending || !trainingRunId}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      <FlaskConical className="h-4 w-4 mr-2" />
                      {startValidation.isPending ? 'Starting Validation...' : 'Run Validation'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Validation Results */}
                {validationRunsLoading ? (
                  <Card>
                    <CardContent className="py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      </div>
                    </CardContent>
                  </Card>
                ) : validationRuns && validationRuns.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Validation Results</CardTitle>
                      <CardDescription>Performance on out-of-sample data</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {validationRuns.map((run) => (
                        <div key={run.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">
                              {run.start_date} → {run.end_date}
                            </span>
                            <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                              run.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                              run.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                              run.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {run.status}
                            </span>
                          </div>
                          
                          {run.status === 'completed' && run.metrics && (
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Accuracy</p>
                                <p className="text-lg font-semibold">
                                  {(run.metrics.accuracy * 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Precision</p>
                                <p className="text-lg font-semibold">
                                  {(run.metrics.precision * 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Recall</p>
                                <p className="text-lg font-semibold">
                                  {(run.metrics.recall * 100).toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">F1 Score</p>
                                <p className="text-lg font-semibold">
                                  {(run.metrics.f1 * 100).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {run.status === 'completed' && run.signal_distribution && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm font-medium mb-2">Signal Distribution</p>
                              <div className="flex gap-4">
                                <span className="text-green-500">BUY: {run.signal_distribution.BUY}</span>
                                <span className="text-red-500">SELL: {run.signal_distribution.SELL}</span>
                                <span className="text-muted-foreground">HOLD: {run.signal_distribution.HOLD}</span>
                              </div>
                            </div>
                          )}
                          
                          {run.status === 'failed' && run.error_message && (
                            <p className="text-sm text-red-500">{run.error_message}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        No validation runs yet. Configure dates above and run validation.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Publishing Settings - After Validation */}
                {validationRuns && validationRuns.some(r => r.status === 'completed') && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Publishing Settings</CardTitle>
                        <CardDescription>Configure how others can access your model</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Make Public</Label>
                            <p className="text-sm text-muted-foreground">Allow others to subscribe</p>
                          </div>
                          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                        </div>
                        {isPublic && (
                          <div className="space-y-2">
                            <Label>Performance Fee (%)</Label>
                            <Input 
                              type="number" 
                              value={performanceFee} 
                              onChange={(e) => setPerformanceFee(e.target.value)}
                              min="0"
                              max="50"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex gap-4">
                      <Button variant="outline" className="flex-1" onClick={() => setModelType(null)}>
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1" 
                        onClick={handleCreate} 
                        disabled={createModel.isPending}
                      >
                        {createModel.isPending ? 'Saving...' : 'Save Model'}
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    );
  }

  // Sandbox mode flow
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container py-8">
        <Button variant="ghost" onClick={() => setModelType(null)} className="mb-6">
          ← Back to type selection
        </Button>

        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium capitalize">{modelType} Mode</span>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold mb-2">Configure Your Model</h1>
            <p className="text-muted-foreground">Set up your trading strategy details</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Model Name</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Momentum Alpha Strategy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Short Description</Label>
                <Textarea 
                  id="description" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your strategy..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overview">Strategy Overview</Label>
                <Textarea 
                  id="overview" 
                  value={strategyOverview} 
                  onChange={(e) => setStrategyOverview(e.target.value)}
                  placeholder="Detailed explanation of how your model works..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Python Code Editor
              </CardTitle>
              <CardDescription>Write your custom trading logic. Code runs in an isolated container with limited packages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                <FlaskConical className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium">Isolated Container Execution</span>
                  <p className="text-xs mt-1">Your code runs in a secure sandbox with 30s timeout, 256MB memory limit. Allowed: pandas, numpy, sklearn, ta, scipy.</p>
                </div>
              </div>
              {/* Code Terminal Display */}
              <div className="mb-4">
                <CodeTerminal 
                  code={sandboxCode} 
                  language="python" 
                  maxHeight="300px"
                />
              </div>
              
              {/* Editable Code Area */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Edit Code:</label>
                <textarea
                  value={sandboxCode}
                  onChange={(e) => setSandboxCode(e.target.value)}
                  className="w-full h-64 bg-zinc-950 text-zinc-100 rounded-lg p-4 font-mono text-sm resize-y border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                  spellCheck={false}
                  placeholder="Write your Python trading logic here..."
                />
              </div>
              
              <Button 
                variant="outline" 
                onClick={async () => {
                  try {
                    const result = await sandboxExecute.mutateAsync({ code: sandboxCode, demo_mode: true });
                    if (result.success) {
                      toast({ title: 'Execution Complete', description: `Generated ${result.result?.total_days || 0} signals in ${result.execution_time_ms}ms` });
                    }
                  } catch (error: any) {
                    toast({ title: 'Execution Failed', description: error.message, variant: 'destructive' });
                  }
                }}
                disabled={sandboxExecute.isPending}
              >
                <Rocket className="h-4 w-4 mr-2" />
                {sandboxExecute.isPending ? 'Executing...' : 'Test in Container'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Custom API Integrations
              </CardTitle>
              <CardDescription>Connect external APIs for data feeds or services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {customApis.length > 0 && (
                <div className="space-y-2">
                  {customApis.map((api, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                      <div>
                        <p className="font-medium">{api.name}</p>
                        <p className="text-sm text-muted-foreground">{api.endpoint}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveApi(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="space-y-3 pt-2 border-t">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">API Name</Label>
                    <Input
                      placeholder="e.g., Alpha Vantage"
                      value={newApiName}
                      onChange={(e) => setNewApiName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Endpoint URL</Label>
                    <Input
                      placeholder="https://api.example.com"
                      value={newApiEndpoint}
                      onChange={(e) => setNewApiEndpoint(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">API Key (optional)</Label>
                  <Input
                    type="password"
                    placeholder="Your API key"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddApi}
                  disabled={!newApiName || !newApiEndpoint}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add API
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                File Uploads
              </CardTitle>
              <CardDescription>Upload data files, models, or configuration files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted p-3 rounded-lg">
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop files here, or click to browse
                </p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept=".csv,.json,.pkl,.h5,.py,.txt"
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Choose Files
                  </label>
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: CSV, JSON, Pickle, HDF5, Python, TXT
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publishing Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Make Public</Label>
                  <p className="text-sm text-muted-foreground">Allow others to discover and subscribe to your model</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              {isPublic && (
                <div className="space-y-2">
                  <Label htmlFor="fee">Performance Fee (%)</Label>
                  <Input 
                    id="fee" 
                    type="number" 
                    value={performanceFee} 
                    onChange={(e) => setPerformanceFee(e.target.value)}
                    min="0"
                    max="50"
                  />
                  <p className="text-sm text-muted-foreground">
                    You'll receive this percentage of subscriber profits.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" className="flex-1" onClick={() => setModelType(null)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleCreate} disabled={createModel.isPending}>
              {createModel.isPending ? 'Creating...' : 'Create Model'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
