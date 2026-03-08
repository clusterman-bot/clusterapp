import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModel } from '@/hooks/useModels';
import { useCreateBacktest } from '@/hooks/useBacktests';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Play, Calendar, DollarSign } from 'lucide-react';

export default function RunBacktest() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: model, isLoading: modelLoading } = useModel(id!);
  const createBacktest = useCreateBacktest();

  const getDateString = (d: Date) => d.toISOString().split('T')[0];
  const lastMarketDay = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return d;
  };

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(() => { const d = lastMarketDay(); d.setMonth(d.getMonth() - 6); return getDateString(d); });
  const [endDate, setEndDate] = useState(() => getDateString(lastMarketDay()));
  const [initialCapital, setInitialCapital] = useState('100000');
  const [benchmark, setBenchmark] = useState('SPY');

  const DATE_PRESETS = [
    { label: '1M', months: 1 },
    { label: '3M', months: 3 },
    { label: '6M', months: 6 },
    { label: '1Y', months: 12 },
    { label: '2Y', months: 24 },
  ];
  const applyPreset = (months: number) => {
    const end = lastMarketDay();
    const start = new Date(end); start.setMonth(start.getMonth() - months);
    setStartDate(getDateString(start));
    setEndDate(getDateString(end));
  };

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
      <MainNav />

      <main className="container py-8">
        <BackButton fallbackPath={`/models/${id}`} className="mb-6" />

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
                {/* Quick presets */}
                <div className="flex gap-2 flex-wrap">
                  {DATE_PRESETS.map(p => (
                    <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p.months)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
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
