import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainNav } from '@/components/MainNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Shield, Bell, FileText } from 'lucide-react';

export default function SMSConsent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consents, setConsents] = useState({
    tradingAlerts: false,
    securityAlerts: true, // Pre-checked as it's critical
    serviceUpdates: false,
    marketing: false,
    termsAccepted: false,
    privacyAccepted: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConsentChange = (key: keyof typeof consents) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in to manage SMS preferences',
        variant: 'destructive',
      });
      return;
    }

    if (!consents.termsAccepted || !consents.privacyAccepted) {
      toast({
        title: 'Required consents missing',
        description: 'Please accept the Terms of Service and Privacy Policy',
        variant: 'destructive',
      });
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Store consent record in database for regulatory compliance (TCPA, GDPR)
      const { error } = await supabase
        .from('user_sms_consents')
        .upsert({
          user_id: user.id,
          phone_number: phoneNumber,
          trading_alerts: consents.tradingAlerts,
          security_alerts: consents.securityAlerts,
          service_updates: consents.serviceUpdates,
          marketing: consents.marketing,
          terms_accepted: consents.termsAccepted,
          privacy_accepted: consents.privacyAccepted,
          consent_timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          consent_method: 'web_form',
        }, {
          onConflict: 'user_id,phone_number',
        });

      if (error) throw error;

      toast({
        title: 'Preferences saved',
        description: 'Your SMS communication preferences have been recorded',
      });

      navigate('/profile');
    } catch (error: any) {
      console.error('Failed to save SMS consent:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              SMS Communication Preferences
            </CardTitle>
            <CardDescription>
              Manage your text message preferences and provide consent for communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Standard message and data rates may apply
              </p>
            </div>

            {/* Message Types */}
            <div className="space-y-4">
              <h3 className="font-medium">Message Types</h3>
              
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id="security"
                  checked={consents.securityAlerts}
                  onCheckedChange={() => handleConsentChange('securityAlerts')}
                />
                <div className="space-y-1">
                  <Label htmlFor="security" className="flex items-center gap-2 cursor-pointer">
                    <Shield className="h-4 w-4 text-green-500" />
                    Security Alerts (Recommended)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Two-factor authentication codes, login alerts, and security notifications
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id="trading"
                  checked={consents.tradingAlerts}
                  onCheckedChange={() => handleConsentChange('tradingAlerts')}
                />
                <div className="space-y-1">
                  <Label htmlFor="trading" className="flex items-center gap-2 cursor-pointer">
                    <Bell className="h-4 w-4 text-blue-500" />
                    Trading Alerts
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Trade executions, model signals, and portfolio updates
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id="updates"
                  checked={consents.serviceUpdates}
                  onCheckedChange={() => handleConsentChange('serviceUpdates')}
                />
                <div className="space-y-1">
                  <Label htmlFor="updates" className="cursor-pointer">Service Updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Platform updates, maintenance notifications, and new features
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id="marketing"
                  checked={consents.marketing}
                  onCheckedChange={() => handleConsentChange('marketing')}
                />
                <div className="space-y-1">
                  <Label htmlFor="marketing" className="cursor-pointer">Marketing & Promotions</Label>
                  <p className="text-xs text-muted-foreground">
                    Special offers, new model recommendations, and promotional content
                  </p>
                </div>
              </div>
            </div>

            {/* Legal Consents */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Required Agreements
              </h3>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={consents.termsAccepted}
                  onCheckedChange={() => handleConsentChange('termsAccepted')}
                />
                <Label htmlFor="terms" className="text-sm cursor-pointer">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" className="text-primary underline">
                    Terms of Service
                  </a>
                </Label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="privacy"
                  checked={consents.privacyAccepted}
                  onCheckedChange={() => handleConsentChange('privacyAccepted')}
                />
                <Label htmlFor="privacy" className="text-sm cursor-pointer">
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" className="text-primary underline">
                    Privacy Policy
                  </a>{' '}
                  and consent to receive automated text messages
                </Label>
              </div>
            </div>

            {/* Opt-out Notice */}
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p className="font-medium mb-1">How to Opt Out:</p>
              <p>Reply STOP to any message to unsubscribe from all texts. Reply HELP for help. Message frequency varies. Consent is not required for purchase.</p>
            </div>

            <Button 
              className="w-full" 
              onClick={handleSubmit}
              disabled={isSubmitting || !consents.termsAccepted || !consents.privacyAccepted}
            >
              {isSubmitting ? 'Saving...' : 'Save Preferences'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
