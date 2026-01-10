import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModel } from '@/hooks/useModels';
import { useCreateBacktest } from '@/hooks/useBacktests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, ArrowLeft, Play, Calendar, DollarSign } from 'lucide-react';

export default function RunBacktest() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: model, isLoading: modelLoading } = useModel(id!);
  const createBacktest = useCreateBacktest();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');
  const [initialCapital, setInitialCapital] = useState('100000');
  const [benchmark, setBenchmark] = useState('SPY');

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (modelLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!model || model.user_id !== user.id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Model not found or access denied</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const handleRunBacktest = async () => {
    try {
      await createBacktest.mutateAsync({
        model_id: id!,
        user_id: user.id,
        name: name || `Backtest ${new Date().toLocaleDateString()}`,
        start_date: startDate,
        end_date: endDate,
        initial_capital: parseFloat(initialCapital),
        benchmark,
        status: 'running',
      });
      toast({ 
        title: 'Backtest Started', 
        description: 'Your backtest is now running. Results will appear shortly.' 
      });
      navigate(`/models/${id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center h-16">
          <Button variant="ghost" onClick={() => navigate(`/models/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2 ml-4">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Cluster</span>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Run Backtest</h1>
            <p className="text-muted-foreground">
              Configure and run a historical simulation for <span className="font-medium">{model.name}</span>
            </p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Time Period
                </CardTitle>
                <CardDescription>
                  Select the date range for your backtest
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Backtest Name (optional)</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Q1 2023 Test"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Start Date</Label>
                    <Input
                      id="start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">End Date</Label>
                    <Input
                      id="end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Capital & Benchmark
                </CardTitle>
                <CardDescription>
                  Set your initial capital and comparison benchmark
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="capital">Initial Capital ($)</Label>
                  <Input
                    id="capital"
                    type="number"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    min="1000"
                    step="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Benchmark</Label>
                  <Select value={benchmark} onValueChange={setBenchmark}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPY">SPY (S&P 500)</SelectItem>
                      <SelectItem value="QQQ">QQQ (Nasdaq 100)</SelectItem>
                      <SelectItem value="IWM">IWM (Russell 2000)</SelectItem>
                      <SelectItem value="BTC">BTC (Bitcoin)</SelectItem>
                      <SelectItem value="none">No Benchmark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Play className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Ready to run</h3>
                    <p className="text-sm text-muted-foreground">
                      Your backtest will simulate {model.name} from {startDate} to {endDate} 
                      with ${parseInt(initialCapital).toLocaleString()} initial capital.
                      Results typically complete within a few minutes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => navigate(`/models/${id}`)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleRunBacktest}
                disabled={createBacktest.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                {createBacktest.isPending ? 'Starting...' : 'Run Backtest'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
