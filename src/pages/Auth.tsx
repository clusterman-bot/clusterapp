import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Redirect authenticated users appropriately
  useEffect(() => {
    if (!user) return;
    
    // If we just signed up, always go to onboarding
    if (justSignedUp) {
      navigate('/onboarding', { replace: true });
      return;
    }
    
    // Wait for role to be checked
    if (roleLoading) return;
    
    // If no role, go to onboarding
    if (!userRole) {
      navigate('/onboarding', { replace: true });
      return;
    }
    
    // Route based on role
    if (userRole.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (userRole.role === 'retail_trader') {
      navigate('/trader-dashboard', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [user, userRole, roleLoading, navigate, justSignedUp]);

  // Show loading while checking auth state
  if (user && (roleLoading || justSignedUp)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If already logged in with role, the useEffect will handle redirect
  if (user && userRole) {
    return null;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        // useEffect will handle redirect
      } else {
        const usernameError = validateUsername(username);
        if (usernameError) {
          throw new Error(usernameError);
        }
        const { error } = await signUp(email, password, username.trim());
        if (error) throw error;
        setJustSignedUp(true); // Mark that we just signed up
        toast({ title: 'Account created!', description: 'Let\'s set up your profile.' });
        // The useEffect will now redirect to onboarding
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setJustSignedUp(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">Cluster</span>
          </div>
          <CardTitle>{isLogin ? 'Welcome back' : 'Create account'}</CardTitle>
          <CardDescription>
            {isLogin ? 'Sign in to your account' : 'Start building AI trading models'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="quantmaster" required={!isLogin} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
