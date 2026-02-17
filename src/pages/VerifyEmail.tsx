import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const uid = searchParams.get('uid');

    if (!token || !uid) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-email-token', {
          body: { token, uid },
        });

        if (error) throw error;

        if (data?.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data?.error || 'Verification failed.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Something went wrong.');
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{
              backgroundColor: status === 'success' ? 'hsl(var(--primary) / 0.1)' :
                status === 'error' ? 'hsl(0 84% 60% / 0.1)' : 'hsl(var(--muted))',
            }}
          >
            {status === 'loading' && <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />}
            {status === 'success' && <CheckCircle className="h-8 w-8 text-primary" />}
            {status === 'error' && <XCircle className="h-8 w-8 text-destructive" />}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Verifying...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message || 'Please wait while we verify your email...'}</p>
          {status === 'success' && (
            <Button onClick={() => navigate('/trade', { replace: true })} className="w-full">
              Start Trading
            </Button>
          )}
          {status === 'error' && (
            <Button onClick={() => navigate('/auth', { replace: true })} variant="outline" className="w-full">
              Back to Sign In
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
