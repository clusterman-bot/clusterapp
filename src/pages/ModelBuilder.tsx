import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCreateModel } from '@/hooks/useModels';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Code, Blocks, Zap } from 'lucide-react';

type ModelType = 'sandbox' | 'no-code';

export default function ModelBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createModel = useCreateModel();

  const [modelType, setModelType] = useState<ModelType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [strategyOverview, setStrategyOverview] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [performanceFee, setPerformanceFee] = useState('20');

  // No-code configuration
  const [entryCondition, setEntryCondition] = useState('');
  const [exitCondition, setExitCondition] = useState('');
  const [assetClass, setAssetClass] = useState('stocks');
  const [timeframe, setTimeframe] = useState('daily');

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Model name is required', variant: 'destructive' });
      return;
    }

    const configuration = modelType === 'no-code' ? {
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
        configuration,
        user_id: user.id,
      });
      toast({ title: 'Success', description: 'Model created successfully!' });
      navigate('/dashboard');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (!modelType) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />

        <main className="container py-8">
          <BackButton fallbackPath="/dashboard" className="mb-6" />
          
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">Create New Model</h1>
            <p className="text-muted-foreground mb-8">Choose how you want to build your trading strategy</p>

            <div className="grid md:grid-cols-2 gap-6">
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
                    Write custom Python code that runs in an isolated container. Full flexibility for advanced strategies.
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
                    Use our visual strategy builder with pre-built indicators and conditions. No coding required.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>• Drag-and-drop interface</li>
                    <li>• Pre-built indicators (MA, RSI, MACD)</li>
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
                  <Zap className="h-5 w-5 text-primary" />
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
