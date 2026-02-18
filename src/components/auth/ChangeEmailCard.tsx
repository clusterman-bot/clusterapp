import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/useProfile';
import { MFAStepUpDialog } from '@/components/auth/MFAStepUpDialog';
import { checkAAL2StepUp } from '@/hooks/useAAL2StepUp';

export function ChangeEmailCard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { toast } = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpFactorId, setStepUpFactorId] = useState<string | null>(null);

  const isVerified = !!profile?.email_verified;

  const performEmailChange = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ email_verified: false })
        .eq('id', user!.id);

      try {
        await supabase.functions.invoke('send-verification-email', {
          body: { email: newEmail, userId: user!.id },
        });
      } catch (e) {
        console.error('Failed to send verification email:', e);
      }

      toast({
        title: 'Verification email sent',
        description: `We sent a verification link to ${newEmail}. Please verify to continue using the app.`,
      });
      setNewEmail('');
    } catch (error: any) {
      toast({ title: 'Failed to update email', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || newEmail === user?.email) {
      toast({ title: 'Please enter a different email', variant: 'destructive' });
      return;
    }

    const { needsStepUp, factorId } = await checkAAL2StepUp();
    if (needsStepUp && factorId) {
      setStepUpFactorId(factorId);
      setStepUpOpen(true);
      return;
    }

    await performEmailChange();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Address
          </CardTitle>
          <CardDescription>Change your account email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-foreground font-medium">{user?.email}</p>
            {isVerified ? (
              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" /> Verified
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Unverified
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-email">New Email Address</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="newemail@example.com"
            />
          </div>

          <Button
            onClick={handleChangeEmail}
            disabled={isUpdating || !newEmail}
            className="w-full"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Email'
            )}
          </Button>

          {!isVerified && (
            <p className="text-xs text-destructive">
              Your email is not verified. You must verify your email to use the app.
            </p>
          )}
        </CardContent>
      </Card>

      {stepUpFactorId && (
        <MFAStepUpDialog
          open={stepUpOpen}
          onOpenChange={setStepUpOpen}
          factorId={stepUpFactorId}
          title="Confirm your identity"
          description="Enter your authenticator code to change your email address."
          onVerified={performEmailChange}
        />
      )}
    </>
  );
}
