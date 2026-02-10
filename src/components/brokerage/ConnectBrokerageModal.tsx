import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, Key, ExternalLink, CheckCircle2, 
  AlertTriangle, Loader2, Eye, EyeOff,
  ArrowRight, ArrowLeft
} from 'lucide-react';
import { useConnectBrokerageAccount } from '@/hooks/useBrokerageAccounts';

const EXCHANGES = [
  { id: 'alpaca', name: 'Alpaca', description: 'Commission-free stock & crypto trading API' },
  { id: 'tradier', name: 'Tradier', description: 'Brokerage API for equities and options trading' },
] as const;

type ExchangeId = typeof EXCHANGES[number]['id'];

const EXCHANGE_STEPS: Record<ExchangeId, { signUp: { url: string; steps: string[] }; apiKey: { steps: string[]; keyPlaceholder: string; secretPlaceholder: string } }> = {
  alpaca: {
    signUp: {
      url: 'https://alpaca.markets/signup',
      steps: [
        'Go to alpaca.markets and click "Sign Up"',
        'Enter your email, create a password, and verify your identity',
        'Choose Paper Trading (practice) or Live Trading (real money)',
      ],
    },
    apiKey: {
      steps: [
        'In your Alpaca dashboard, navigate to Paper or Live Trading',
        'Click on "View" or "Generate" under API Keys',
        'Copy both the API Key ID and Secret Key — the secret is only shown once!',
      ],
      keyPlaceholder: 'PKXXXXXXXXXXXXXXXXXX',
      secretPlaceholder: 'Enter your Alpaca secret key',
    },
  },
  tradier: {
    signUp: {
      url: 'https://brokerage.tradier.com/signup',
      steps: [
        'Go to tradier.com and click "Open an Account"',
        'Complete your application with personal and financial information',
        'Fund your account or use the sandbox for paper trading',
      ],
    },
    apiKey: {
      steps: [
        'Log into your Tradier dashboard at developer.tradier.com',
        'Navigate to Account → API Access and generate a new access token',
        'Copy the Access Token — this serves as both your key and secret',
      ],
      keyPlaceholder: 'Enter your Tradier access token',
      secretPlaceholder: 'Enter your Tradier account ID',
    },
  },
};

interface ConnectBrokerageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountType?: 'paper' | 'live';
}

export function ConnectBrokerageModal({ 
  open, 
  onOpenChange, 
  defaultAccountType = 'paper' 
}: ConnectBrokerageModalProps) {
  const [step, setStep] = useState(1);
  const [exchange, setExchange] = useState<ExchangeId | ''>('');
  const [accountType, setAccountType] = useState<'paper' | 'live'>(defaultAccountType);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const connectAccount = useConnectBrokerageAccount();

  const selectedExchange = EXCHANGES.find(e => e.id === exchange);
  const exchangeConfig = exchange ? EXCHANGE_STEPS[exchange] : null;

  const handleConnect = async () => {
    if (!exchange) return;
    await connectAccount.mutateAsync({
      apiKey,
      apiSecret,
      accountType,
      brokerName: selectedExchange?.name || exchange,
    });

    resetModal();
    onOpenChange(false);
  };

  const resetModal = () => {
    setStep(1);
    setExchange('');
    setApiKey('');
    setApiSecret('');
    setShowSecret(false);
  };

  const totalSteps = 4;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) resetModal();
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Connect Exchange Account
          </DialogTitle>
          <DialogDescription>
            Link your brokerage or exchange account to start trading
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mt-4 mb-2">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < totalSteps && (
                <div className={`w-full h-1 mx-2 transition-colors ${step > s ? 'bg-primary' : 'bg-muted'}`} 
                  style={{ minWidth: '40px' }} 
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choose Exchange */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Choose Your Exchange</CardTitle>
              <CardDescription>Select which exchange or brokerage you want to connect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={exchange} onValueChange={(v) => setExchange(v as ExchangeId)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an exchange..." />
                </SelectTrigger>
                <SelectContent>
                  {EXCHANGES.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{ex.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedExchange && (
                <p className="text-sm text-muted-foreground">{selectedExchange.description}</p>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!exchange}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Create Account */}
        {step === 2 && exchangeConfig && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Create a {selectedExchange?.name} Account</CardTitle>
              <CardDescription>
                Follow these steps to set up your {selectedExchange?.name} account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {exchangeConfig.signUp.steps.map((text, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="bg-primary/10 p-2 rounded-full shrink-0">
                      <span className="text-lg font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm mt-1">{text}</p>
                  </div>
                ))}
              </div>

              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => window.open(exchangeConfig.signUp.url, '_blank')}
              >
                Open {selectedExchange?.name} Sign Up <ExternalLink className="h-4 w-4 ml-2" />
              </Button>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button onClick={() => setStep(3)}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Enter API Keys */}
        {step === 3 && exchangeConfig && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Enter Your API Keys</CardTitle>
              <CardDescription>
                Generate API keys from your {selectedExchange?.name} account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 mb-4">
                {exchangeConfig.apiKey.steps.map((text, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="bg-primary/10 p-1.5 rounded-full shrink-0">
                      <span className="text-sm font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm mt-0.5">{text}</p>
                  </div>
                ))}
              </div>

              <div>
                <Label>Account Type</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Card 
                    className={`cursor-pointer transition-all ${
                      accountType === 'paper' ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                    onClick={() => setAccountType('paper')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Paper</Badge>
                        <span className="text-sm font-medium">Practice</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Simulated trading</p>
                    </CardContent>
                  </Card>
                  <Card 
                    className={`cursor-pointer transition-all ${
                      accountType === 'live' ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                    onClick={() => setAccountType('live')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Live</Badge>
                        <span className="text-sm font-medium">Real Money</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Trade with real funds</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div>
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="text"
                  placeholder={exchangeConfig.apiKey.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div>
                <Label htmlFor="apiSecret">Secret Key</Label>
                <div className="relative">
                  <Input
                    id="apiSecret"
                    type={showSecret ? 'text' : 'password'}
                    placeholder={exchangeConfig.apiKey.secretPlaceholder}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    className="font-mono pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button 
                  onClick={() => setStep(4)}
                  disabled={!apiKey || !apiSecret}
                >
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Confirm & Connect */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Confirm & Connect</CardTitle>
              <CardDescription>Review your details and connect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Exchange</span>
                  <span className="text-sm font-medium">{selectedExchange?.name}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Account Type</span>
                  <Badge variant={accountType === 'paper' ? 'secondary' : 'destructive'}>
                    {accountType === 'paper' ? 'Paper' : 'Live'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">API Key</span>
                  <span className="text-sm font-mono">{apiKey.slice(0, 8)}...{apiKey.slice(-4)}</span>
                </div>
              </div>

              <Alert className="bg-primary/5 border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription>
                  Your API keys are encrypted before storage. We never store them in plain text.
                </AlertDescription>
              </Alert>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button 
                  onClick={handleConnect}
                  disabled={connectAccount.isPending}
                >
                  {connectAccount.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Connect {selectedExchange?.name}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
