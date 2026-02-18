import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Mail, CheckCircle, AtSign, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MFAChallenge } from '@/components/auth/MFAChallenge';
import { useTour } from '@/contexts/TourContext';

type AuthMode = 'signup' | 'login' | 'verify-email' | 'mfa-challenge' | 'forgot-password' | 'forgot-sent';

const REMEMBER_ME_KEY = 'cluster_remember_me';
const REMEMBER_ME_DURATION = 60 * 60 * 1000; // 1 hour in ms

function isRemembered(): boolean {
  const stored = localStorage.getItem(REMEMBER_ME_KEY);
  if (!stored) return false;
  const timestamp = parseInt(stored, 10);
  return Date.now() - timestamp < REMEMBER_ME_DURATION;
}

function setRemembered() {
  localStorage.setItem(REMEMBER_ME_KEY, Date.now().toString());
}

function clearRemembered() {
  localStorage.removeItem(REMEMBER_ME_KEY);
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const showTutorial = searchParams.get('tutorial') === 'true';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startTour } = useTour();
  // Ref to prevent proceed() from running more than once per login
  const proceedingRef = useRef(false);

  const justSignedOut = searchParams.get('signout') === 'true';

  useEffect(() => {
    if (justSignedOut) {
      clearRemembered();
      return;
    }
    if (authLoading) return;
    if (!user) {
      // Reset the guard when user logs out
      proceedingRef.current = false;
      return;
    }
    // Prevent multiple simultaneous or repeated executions
    if (proceedingRef.current) return;

    proceedingRef.current = true;

    const proceed = async () => {
      try {
        // 1. Check email verification first
        const { data: profile } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('id', user.id)
          .single();

        if (profile?.email_verified === false) {
          setPendingEmail(user.email || '');
          setMode('verify-email');
          proceedingRef.current = false;
          return;
        }

        // 2. If remembered within 1 hour, skip MFA and auto-login
        if (isRemembered()) {
          navigate('/trade', { replace: true });
          return;
        }

        // 3. Check if user has a verified MFA factor
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');

        if (verifiedFactor) {
          setMfaFactorId(verifiedFactor.id);
          setMode('mfa-challenge');
          proceedingRef.current = false;
          return;
        }

        // 4. No MFA enrolled — proceed to app immediately
        navigate('/trade', { replace: true });
        if (showTutorial) {
          setTimeout(() => startTour(), 600);
        }
      } catch (e) {
        console.error('Auth proceed error:', e);
        proceedingRef.current = false;
      }
    };

    proceed();
  }, [user, authLoading, navigate, justSignedOut, showTutorial, startTour]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      // useEffect handles MFA check and redirect from here
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  const handleMFASuccess = () => {
    if (rememberMe) setRemembered();
    navigate('/trade', { replace: true });
  };

  const handleMFACancel = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    setMode('login');
    setMfaFactorId(null);
    proceedingRef.current = false;
    setLoading(false);
    toast({ title: 'MFA required', description: 'You must complete MFA verification to sign in.', variant: 'destructive' });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast({ title: 'Username required', description: 'Please choose a user handle.', variant: 'destructive' });
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      toast({ title: 'Invalid handle', description: 'Use 3-20 characters: letters, numbers, or underscores.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password, username);
      if (error) throw error;
      setPendingEmail(email);
      setMode('verify-email');
      toast({ title: 'Check your email!', description: 'We sent you a verification link to confirm your account.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Email required', description: 'Enter your account email.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMode('forgot-sent');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
    }
  };

  // MFA Challenge screen
  if (mode === 'mfa-challenge' && mfaFactorId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <MFAChallenge
          factorId={mfaFactorId}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />
      </div>
    );
  }

  // Email verification screen
  if (mode === 'verify-email') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription className="text-base">We sent a verification link to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted rounded-lg p-4">
              <p className="font-medium text-foreground">{pendingEmail}</p>
            </div>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">Click the link in your email to verify your account</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">After verification, you'll be redirected back here to sign in</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">Check your spam folder if you don't see the email</p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-4">Already verified your email?</p>
              <Button onClick={() => { setMode('login'); proceedingRef.current = false; }} className="w-full">Sign In</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot password form
  if (mode === 'forgot-password') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/favicon.png" alt="Cluster" className="h-8 w-8" />
              <span className="text-2xl font-bold">Cluster</span>
            </div>
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>Enter your email and we'll send you a reset link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline">
                Back to sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forgot password sent confirmation
  if (mode === 'forgot-sent') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your inbox</CardTitle>
            <CardDescription className="text-base">We sent a password reset link to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted rounded-lg p-4">
              <p className="font-medium text-foreground">{email}</p>
            </div>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">Click the link in the email to reset your password</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">If MFA is enabled you'll be asked to verify first</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">Check your spam folder if you don't see it</p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <Button variant="ghost" onClick={() => setMode('login')} className="w-full">Back to sign in</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <img src="/favicon.png" alt="Cluster" className="h-8 w-8" />
                <span className="text-2xl font-bold">Cluster</span>
              </div>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>Choose a handle and start trading</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">User Handle</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="your_handle"
                      className="pl-9"
                      required
                      minLength={3}
                      maxLength={20}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">3-20 characters: letters, numbers, underscores</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button variant="outline" className="w-full flex items-center justify-center gap-2" onClick={handleGoogleSignIn} disabled={loading}>
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {loading ? 'Connecting...' : 'Continue with Google'}
              </Button>

              <div className="mt-4 text-center text-sm">
                <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline">
                  Already have an account? Sign in
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
    );
  }

  // Login form (default)
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
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
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                Remember me for 1 hour (auto-login after MFA)
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button variant="outline" className="w-full flex items-center justify-center gap-2" onClick={handleGoogleSignIn} disabled={loading}>
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </Button>

          <div className="mt-4 text-center text-sm space-y-2">
            <div>
              <button type="button" onClick={() => setMode('forgot-password')} className="text-muted-foreground hover:text-foreground hover:underline">
                Forgot your password?
              </button>
            </div>
            <div>
              <button type="button" onClick={() => setMode('signup')} className="text-primary hover:underline">
                Don't have an account? Sign up
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
