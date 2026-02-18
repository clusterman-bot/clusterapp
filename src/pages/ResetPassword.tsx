import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Shield, CheckCircle, Loader2 } from 'lucide-react';

type Step = 'loading' | 'mfa' | 'new-password' | 'done' | 'invalid';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Supabase redirects here with a recovery session in the URL hash.
  // onAuthStateChange fires with event = PASSWORD_RECOVERY once the token is exchanged.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        // Check if the user has MFA enrolled
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verified = factors?.totp?.find(f => f.status === 'verified');
        if (verified) {
          setMfaFactorId(verified.id);
          setStep('mfa');
        } else {
          setStep('new-password');
        }
      } else if (event === 'SIGNED_IN' && step === 'loading') {
        // If user somehow lands here already signed in without recovery flow
        setStep('invalid');
      }
    });

    // Timeout: if nothing fires in 5s, the link is invalid/expired
    const timeout = setTimeout(() => {
      setStep(prev => prev === 'loading' ? 'invalid' : prev);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [step]);

  const handleMFAVerify = async () => {
    if (!mfaFactorId || mfaCode.length !== 6) return;
    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;

      setStep('new-password');
    } catch (err: any) {
      toast({ title: 'Invalid code', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Password too short', description: 'Use at least 6 characters.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStep('done');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Verifying your reset link…</p>
        </div>
      </div>
    );
  }

  // ── Invalid / expired link ───────────────────────────────────────────────
  if (step === 'invalid') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-14 h-14 bg-destructive/10 rounded-full flex items-center justify-center mb-3">
              <KeyRound className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle>Link expired or invalid</CardTitle>
            <CardDescription>
              This password reset link has expired or has already been used. Request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/auth')}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── MFA step ─────────────────────────────────────────────────────────────
  if (step === 'mfa') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Verify your identity</CardTitle>
            <CardDescription>
              Your account has two-factor authentication enabled. Enter your authenticator code to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Authenticator code</Label>
              <Input
                id="mfa-code"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-3xl tracking-[0.5em] font-mono h-14"
                maxLength={6}
                autoFocus
              />
              <p className="text-xs text-center text-muted-foreground">
                Codes refresh every 30 seconds.
              </p>
            </div>
            <Button className="w-full" onClick={handleMFAVerify} disabled={loading || mfaCode.length !== 6}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify &amp; continue
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── New password form ─────────────────────────────────────────────────────
  if (step === 'new-password') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>Choose a strong password you haven't used before.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-3">
            <CheckCircle className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Password updated!</CardTitle>
          <CardDescription>Your password has been changed. You can now sign in with your new credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => navigate('/auth')}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
