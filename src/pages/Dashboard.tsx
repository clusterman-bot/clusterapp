import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useMyModels } from '@/hooks/useModels';
import { MainNav } from '@/components/MainNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Users, DollarSign, BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: models, isLoading } = useMyModels();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />

      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Manage your trading models</p>
          </div>
          <Button onClick={() => navigate('/models/new')}>
            <Plus className="mr-2 h-4 w-4" /> New Model
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{models?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.total_followers || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-profit">
                ${profile?.total_earnings?.toFixed(2) || '0.00'}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Models</CardTitle>
            <CardDescription>Create and manage your trading strategies</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : models && models.length > 0 ? (
              <div className="space-y-4">
                {models.map((model) => (
                  <div 
                    key={model.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" 
                    onClick={() => navigate(`/models/${model.id}`)}
                  >
                    <div>
                      <h3 className="font-medium">{model.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {model.model_type} • {model.status}
                      </p>
                    </div>
                    <div className="text-right">
                      {model.total_return !== null && (
                        <span className={model.total_return >= 0 ? 'text-profit' : 'text-loss'}>
                          {model.total_return >= 0 ? '+' : ''}{(model.total_return * 100).toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No models yet. Create your first trading model!
                </p>
                <Button onClick={() => navigate('/models/new')}>
                  <Plus className="mr-2 h-4 w-4" /> Create Model
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}