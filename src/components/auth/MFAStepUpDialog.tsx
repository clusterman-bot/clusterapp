import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2 } from 'lucide-react';

interface MFAStepUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factorId: string;
  title?: string;
  description?: string;
  onVerified: () => void;
}

export function MFAStepUpDialog({
  open,
  onOpenChange,
  factorId,
  title = 'Confirm your identity',
  description = 'Enter your 6-digit authenticator code to continue.',
  onVerified,
}: MFAStepUpDialogProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;

    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      setCode('');
      onOpenChange(false);
      onVerified();
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setCode('');
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            maxLength={6}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />

          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verify & Continue
          </Button>

          <Button variant="ghost" className="w-full" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
