import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useCreateModel } from '@/hooks/useModels';
import { useStartTraining, useTrainingRun, useTrainingRealtimeUpdates, IndicatorsConfig as IndicatorsConfigType, HyperparametersConfig as HyperparametersConfigType } from '@/hooks/useMLTraining';
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
import { Code, Blocks, Brain, Calendar, TrendingUp, Rocket } from 'lucide-react';

type ModelType = 'sandbox' | 'no-code' | 'ml';

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
  const { user } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createModel = useCreateModel();
  const startTraining = useStartTraining();
  
  const canCreateModels = userRole?.role === 'developer' || userRole?.role === 'admin';

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
  
  // Training state
  const [trainingRunId, setTrainingRunId] = useState<string | null>(null);
  const { data: trainingRun, isLoading: trainingLoading } = useTrainingRun(trainingRunId || undefined);
  useTrainingRealtimeUpdates(trainingRunId || undefined);

  // No-code configuration
  const [entryCondition, setEntryCondition] = useState('');
  const [exitCondition, setExitCondition] = useState('');
  const [assetClass, setAssetClass] = useState('stocks');
  const [timeframe, setTimeframe] = useState('daily');

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
      });
      
      setTrainingRunId(result.training_run_id);
      setActiveTab('training');
      toast({ title: 'Training Started', description: 'Your model is now being trained.' });
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
    } : modelType === 'no-code' ? {
      entryCondition,
      exitCondition,
      assetClass,
      timeframe,
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

            <div className="grid md:grid-cols-3 gap-6">
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

              {/* No-Code Card */}
              <Card 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setModelType('no-code')}
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Blocks className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>No-Code Builder</CardTitle>
                  <CardDescription>
                    Use our visual strategy builder with pre-built indicators.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Drag-and-drop interface</li>
                    <li>• Pre-built indicators</li>
                    <li>• Visual condition builder</li>
                    <li>• Instant backtesting</li>
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
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="indicators">Indicators</TabsTrigger>
                <TabsTrigger value="models">Models & Params</TabsTrigger>
                <TabsTrigger value="training">Training</TabsTrigger>
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
                        <Label>Horizon (days)</Label>
                        <Input
                          type="number"
                          value={horizon}
                          onChange={(e) => setHorizon(parseInt(e.target.value) || 5)}
                          min={1}
                          max={30}
                        />
                        <p className="text-xs text-muted-foreground">
                          Look-ahead period for calculating future returns
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
                
                {trainingRun?.status === 'completed' && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Publishing Settings</CardTitle>
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
            </Tabs>
          </div>
        </main>
      </div>
    );
  }

  // Original sandbox/no-code flow
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container py-8">
        <Button variant="ghost" onClick={() => setModelType(null)} className="mb-6">
          ← Back to type selection
        </Button>

        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-2">
            {modelType === 'sandbox' ? <Code className="h-5 w-5 text-primary" /> : <Blocks className="h-5 w-5 text-primary" />}
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

          {modelType === 'no-code' && (
            <Card>
              <CardHeader>
                <CardTitle>Strategy Configuration</CardTitle>
                <CardDescription>Define your entry and exit conditions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Asset Class</Label>
                    <Select value={assetClass} onValueChange={setAssetClass}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stocks">Stocks</SelectItem>
                        <SelectItem value="crypto">Crypto</SelectItem>
                        <SelectItem value="forex">Forex</SelectItem>
                        <SelectItem value="commodities">Commodities</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timeframe</Label>
                    <Select value={timeframe} onValueChange={setTimeframe}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1m">1 Minute</SelectItem>
                        <SelectItem value="5m">5 Minutes</SelectItem>
                        <SelectItem value="1h">1 Hour</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry">Entry Condition</Label>
                  <Textarea 
                    id="entry" 
                    value={entryCondition} 
                    onChange={(e) => setEntryCondition(e.target.value)}
                    placeholder="e.g., RSI crosses above 30 AND price above 50-day MA"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exit">Exit Condition</Label>
                  <Textarea 
                    id="exit" 
                    value={exitCondition} 
                    onChange={(e) => setExitCondition(e.target.value)}
                    placeholder="e.g., RSI crosses below 70 OR 10% profit target hit"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {modelType === 'sandbox' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  Sandbox Environment
                </CardTitle>
                <CardDescription>Your code will run in an isolated Python environment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                  <p className="text-muted-foreground"># Your strategy code will be configured after creation</p>
                  <p className="text-muted-foreground"># Available libraries: pandas, numpy, sklearn, ta</p>
                  <p className="mt-4 text-foreground">def generate_signals(data):</p>
                  <p className="text-foreground ml-4">    # Your logic here</p>
                  <p className="text-foreground ml-4">    return signals</p>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Full code editor available after model creation.
                </p>
              </CardContent>
            </Card>
          )}

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
