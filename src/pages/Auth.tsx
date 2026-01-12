import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, useSetUserRole, AppRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Code, LineChart, ArrowLeft } from 'lucide-react';

type AuthMode = 'select' | 'developer-signup' | 'trader-signup' | 'login';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const setUserRole = useSetUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Check if user just signed out (indicated by 'signout' param)
  const justSignedOut = searchParams.get('signout') === 'true';

  // Redirect authenticated users appropriately (but not if they just signed out)
  useEffect(() => {
    // If user just signed out, don't redirect - wait for auth state to clear
    if (justSignedOut) return;
    // Wait for auth to finish loading
    if (authLoading) return;
    if (!user) return;
    
    // Wait for role to finish loading, but don't wait forever
    if (roleLoading) return;
    
    // Route based on role (default to dashboard if no role found)
    if (userRole?.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (userRole?.role === 'retail_trader') {
      navigate('/trader-dashboard', { replace: true });
    } else {
      // Default to dashboard for developers or users without a role yet
      navigate('/dashboard', { replace: true });
    }
  }, [user, userRole, authLoading, roleLoading, navigate, justSignedOut]);

  // Show loading while checking auth state (only when not coming from signout)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If user is logged in (and not just signed out), show loading while redirect happens
  if (user && !justSignedOut && !roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  const validateUsername = (username: string): string | null => {
    const trimmed = username.trim();
    if (!trimmed) {
      return 'Username is required';
    }
    if (trimmed.length < 3 || trimmed.length > 30) {
      return 'Username must be 3-30 characters';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return null;
  };

  const handleSignUp = async (e: React.FormEvent, role: AppRole) => {
    e.preventDefault();
    setLoading(true);

    try {
      const usernameError = validateUsername(username);
      if (usernameError) {
        throw new Error(usernameError);
      }
      
      const { error } = await signUp(email, password, username.trim());
      if (error) throw error;
      
      // Set the role immediately after signup
      await setUserRole.mutateAsync(role);
      
      toast({ 
        title: 'Account created!', 
        description: `Welcome to Cluster as a ${role === 'developer' ? 'Developer' : 'Retail Trader'}!` 
      });
      
      // Redirect based on role
      if (role === 'retail_trader') {
        navigate('/trader-dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      
      // Navigate immediately after successful login
      // The dashboard pages will handle role-based routing
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
  };

  // Role selection screen
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/favicon.png" alt="Cluster" className="h-10 w-10" />
              <span className="text-3xl font-bold">Cluster</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to Cluster</h1>
            <p className="text-muted-foreground">Choose how you want to join</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Developer Card */}
            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-lg"
              onClick={() => { resetForm(); setMode('developer-signup'); }}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Developer / Quant</CardTitle>
                <CardDescription>Build and monetize AI trading models</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Create trading strategies
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Run backtests with professional metrics
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Publish models and earn fees
                  </li>
                </ul>
                <Button className="w-full mt-4">Sign Up as Developer</Button>
              </CardContent>
            </Card>

            {/* Retail Trader Card */}
            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-lg"
              onClick={() => { resetForm(); setMode('trader-signup'); }}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <LineChart className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Retail Trader</CardTitle>
                <CardDescription>Subscribe to proven trading strategies</CardDescription>
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
                    Trade stocks and track portfolio
                  </li>
                </ul>
                <Button className="w-full mt-4">Sign Up as Trader</Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <button 
              type="button" 
              onClick={() => { resetForm(); setMode('login'); }} 
              className="text-primary hover:underline"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sign up forms (Developer or Trader)
  if (mode === 'developer-signup' || mode === 'trader-signup') {
    const role: AppRole = mode === 'developer-signup' ? 'developer' : 'retail_trader';
    const roleLabel = mode === 'developer-signup' ? 'Developer / Quant' : 'Retail Trader';
    const RoleIcon = mode === 'developer-signup' ? Code : LineChart;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <button 
              onClick={() => setMode('select')} 
              className="absolute left-4 top-4 p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <RoleIcon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <CardTitle>Create {roleLabel} Account</CardTitle>
            <CardDescription>
              {mode === 'developer-signup' 
                ? 'Start building AI trading models' 
                : 'Start discovering trading strategies'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSignUp(e, role)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder={mode === 'developer-signup' ? 'quantmaster' : 'trader123'} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="you@example.com" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required 
                  minLength={6} 
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || setUserRole.isPending}>
                {loading || setUserRole.isPending ? 'Creating account...' : `Create ${roleLabel} Account`}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm space-y-2">
              <button 
                type="button" 
                onClick={() => setMode('login')} 
                className="text-primary hover:underline"
              >
                Already have an account? Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Login form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <button 
            onClick={() => setMode('select')} 
            className="absolute left-4 top-4 p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/favicon.png" alt="Cluster" className="h-8 w-8" />
            <span className="text-2xl font-bold">Cluster</span>
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="you@example.com" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
                minLength={6} 
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button 
              type="button" 
              onClick={() => setMode('select')} 
              className="text-primary hover:underline"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
