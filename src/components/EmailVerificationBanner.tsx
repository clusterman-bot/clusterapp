import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      const { error } = await supabase.functions.invoke('send-verification-email', {
        body: { email: user.email, userId: user.id },
      });
      if (error) throw error;
      toast({ title: 'Verification email sent!', description: 'Check your inbox for the verification link.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to resend verification email.', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="mb-6 border-2 border-destructive/30 bg-destructive/5">
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-sm">Email not verified</p>
              <p className="text-xs text-muted-foreground">
                You're in view-only mode. Verify your email to trade, post, and interact.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleResend} disabled={resending} className="shrink-0">
            <Mail className="h-4 w-4 mr-2" />
            {resending ? 'Sending...' : 'Resend Email'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
