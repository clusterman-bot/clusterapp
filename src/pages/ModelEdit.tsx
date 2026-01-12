import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModel, useUpdateModel } from '@/hooks/useModels';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Settings } from 'lucide-react';

export default function ModelEdit() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: model, isLoading } = useModel(id);
  const updateModel = useUpdateModel();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [strategyOverview, setStrategyOverview] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [performanceFee, setPerformanceFee] = useState('20');
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    if (model) {
      setName(model.name || '');
      setDescription(model.description || '');
      setStrategyOverview(model.strategy_overview || '');
      setIsPublic(model.is_public || false);
      setPerformanceFee(String(model.performance_fee_percent || 20));
      setStatus(model.status || 'draft');
    }
  }, [model]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (model && user && model.user_id !== user.id) {
      toast({ title: 'Access Denied', description: 'You can only edit your own models.', variant: 'destructive' });
      navigate(`/models/${id}`);
    }
  }, [model, user, id, navigate, toast]);

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

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Model name is required', variant: 'destructive' });
      return;
    }

    try {
      await updateModel.mutateAsync({
        id: model.id,
        updates: {
          name,
          description,
          strategy_overview: strategyOverview,
          is_public: isPublic,
          performance_fee_percent: parseFloat(performanceFee),
          status,
        },
      });
      toast({ title: 'Success', description: 'Model updated successfully!' });
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
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Edit Model</h1>
              <p className="text-muted-foreground">Update your model settings</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Model Details</CardTitle>
              <CardDescription>Update the basic information about your model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Model Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Trading Strategy"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of your model..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategy">Strategy Overview</Label>
                <Textarea
                  id="strategy"
                  value={strategyOverview}
                  onChange={(e) => setStrategyOverview(e.target.value)}
                  placeholder="Explain your trading strategy in detail..."
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fee">Performance Fee (%)</Label>
                <Input
                  id="fee"
                  type="number"
                  min="0"
                  max="50"
                  value={performanceFee}
                  onChange={(e) => setPerformanceFee(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The percentage of profits you'll earn from subscribers
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Make Public</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow others to discover and subscribe to your model
                  </p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSave} disabled={updateModel.isPending} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {updateModel.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => navigate(`/models/${id}`)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
