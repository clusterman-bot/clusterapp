import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSetUserRole, useUserRole, AppRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Code, LineChart, CheckCircle } from 'lucide-react';

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const { data: existingRole, isLoading: roleLoading } = useUserRole();
  const setUserRole = useSetUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);

  // Redirect users appropriately
  useEffect(() => {
    if (authLoading || roleLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // If user already has a role, redirect to appropriate dashboard
    if (existingRole) {
      if (existingRole.role === 'admin') {
        navigate('/admin');
      } else if (existingRole.role === 'retail_trader') {
        navigate('/trader-dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, existingRole, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || existingRole) {
    return null;
  }

  const handleSelectRole = async () => {
    if (!selectedRole) {
      toast({ title: 'Select a role', description: 'Please choose how you want to use Cluster', variant: 'destructive' });
      return;
    }

    try {
      await setUserRole.mutateAsync(selectedRole);
      toast({ title: 'Welcome!', description: `You're now set up as a ${selectedRole === 'developer' ? 'Developer' : 'Retail Trader'}` });
      // Redirect based on role
      if (selectedRole === 'retail_trader') {
        navigate('/trader-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center h-16">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Cluster</span>
          </div>
        </div>
      </header>

      <main className="container py-12">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Welcome to Cluster!</h1>
          <p className="text-xl text-muted-foreground">
            Choose how you want to use the platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
          <Card 
            className={`cursor-pointer transition-all ${
              selectedRole === 'developer' 
                ? 'border-primary ring-2 ring-primary ring-offset-2' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedRole('developer')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                {selectedRole === 'developer' && (
                  <CheckCircle className="h-6 w-6 text-primary" />
                )}
              </div>
              <CardTitle className="mt-4">Developer / Quant</CardTitle>
              <CardDescription>
                Build and monetize AI trading models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Create trading strategies (code or no-code)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Run backtests with professional metrics
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Publish models and earn performance fees
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Build your following and reputation
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${
              selectedRole === 'retail_trader' 
                ? 'border-primary ring-2 ring-primary ring-offset-2' 
                : 'hover:border-primary/50'
            }`}
            onClick={() => setSelectedRole('retail_trader')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                {selectedRole === 'retail_trader' && (
                  <CheckCircle className="h-6 w-6 text-primary" />
                )}
              </div>
              <CardTitle className="mt-4">Retail Trader</CardTitle>
              <CardDescription>
                Subscribe to proven trading strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Discover top-performing models
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Subscribe to strategies you trust
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Follow developers and get updates
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Track your portfolio performance
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            onClick={handleSelectRole}
            disabled={!selectedRole || setUserRole.isPending}
            className="min-w-[200px]"
          >
            {setUserRole.isPending ? 'Setting up...' : 'Continue'}
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            You can always change your role later in settings
          </p>
        </div>
      </main>
    </div>
  );
}
