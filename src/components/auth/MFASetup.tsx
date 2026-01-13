import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, Loader2, Copy, CheckCircle } from 'lucide-react';

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
}

export function MFASetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch existing MFA factors
  const fetchFactors = async () => {
    if (!user) return;
    
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.error('Error fetching MFA factors:', error);
      return;
    }
    
    setFactors(data.totp || []);
  };

  useEffect(() => {
    fetchFactors();
  }, [user]);

  const hasMFAEnabled = factors.some(f => f.status === 'verified');

  const handleEnrollMFA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (error: any) {
      toast({
        title: 'Failed to setup MFA',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!factorId || verifyCode.length !== 6) return;

    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode
      });

      if (verifyError) throw verifyError;

      toast({
        title: 'MFA Enabled!',
        description: 'Two-factor authentication has been successfully enabled for your account.'
      });

      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setVerifyCode('');
      setIsSetupOpen(false);
      fetchFactors();
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async (factorId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;

      toast({
        title: 'MFA Disabled',
        description: 'Two-factor authentication has been disabled.'
      });

      fetchFactors();
    } catch (error: any) {
      toast({
        title: 'Failed to disable MFA',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {hasMFAEnabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account by requiring a verification code in addition to your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasMFAEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">MFA is enabled</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your account is protected with two-factor authentication.
            </p>
            {factors.filter(f => f.status === 'verified').map((factor) => (
              <div key={factor.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{factor.friendly_name || 'Authenticator App'}</p>
                  <p className="text-xs text-muted-foreground">TOTP Authenticator</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleDisableMFA(factor.id)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setIsSetupOpen(true); handleEnrollMFA(); }}>
                <Shield className="h-4 w-4 mr-2" />
                Enable MFA
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </DialogDescription>
              </DialogHeader>

              {loading && !qrCode ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : qrCode ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img 
                      src={qrCode} 
                      alt="MFA QR Code" 
                      className="w-48 h-48 border rounded-lg"
                    />
                  </div>

                  {secret && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">
                        Can't scan? Enter this code manually:
                      </Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                          {secret}
                        </code>
                        <Button variant="outline" size="icon" onClick={copySecret}>
                          {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="verify-code">Enter verification code</Label>
                    <Input
                      id="verify-code"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-widest font-mono"
                      maxLength={6}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleVerifyMFA}
                    disabled={loading || verifyCode.length !== 6}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Verify & Enable
                  </Button>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
