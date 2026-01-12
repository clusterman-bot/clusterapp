import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, Key, ExternalLink, CheckCircle2, 
  AlertTriangle, Loader2, Eye, EyeOff,
  BookOpen, ArrowRight
} from 'lucide-react';
import { useConnectBrokerageAccount } from '@/hooks/useBrokerageAccounts';

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
  const [mode, setMode] = useState<'guided' | 'quick'>('guided');
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<'paper' | 'live'>(defaultAccountType);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('10000');
  const [perTradeLimit, setPerTradeLimit] = useState('1000');

  const connectAccount = useConnectBrokerageAccount();

  const handleConnect = async () => {
    await connectAccount.mutateAsync({
      apiKey,
      apiSecret,
      accountType,
      dailyLimit: parseFloat(dailyLimit),
      perTradeLimit: parseFloat(perTradeLimit),
    });

    // Reset and close on success
    setApiKey('');
    setApiSecret('');
    setStep(1);
    onOpenChange(false);
  };

  const resetModal = () => {
    setStep(1);
    setApiKey('');
    setApiSecret('');
    setShowSecret(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetModal();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Connect Your Alpaca Account
          </DialogTitle>
          <DialogDescription>
            Link your brokerage account to start trading with your own funds
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'guided' | 'quick')} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="guided">
              <BookOpen className="h-4 w-4 mr-2" />
              Guided Setup
            </TabsTrigger>
            <TabsTrigger value="quick">
              <Key className="h-4 w-4 mr-2" />
              Quick Connect
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guided" className="mt-4 space-y-4">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-6">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                  </div>
                  {s < 4 && (
                    <div className={`w-full h-1 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'}`} 
                      style={{ minWidth: '40px' }} 
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Create Account */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Create an Alpaca Account</CardTitle>
                  <CardDescription>
                    Alpaca is a commission-free trading platform that we integrate with
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <span className="text-lg font-bold text-primary">1</span>
                      </div>
                      <div>
                        <p className="font-medium">Visit Alpaca Markets</p>
                        <p className="text-sm text-muted-foreground">
                          Go to alpaca.markets and click "Sign Up"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <span className="text-lg font-bold text-primary">2</span>
                      </div>
                      <div>
                        <p className="font-medium">Complete Registration</p>
                        <p className="text-sm text-muted-foreground">
                          Enter your email, create a password, and verify your identity
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <span className="text-lg font-bold text-primary">3</span>
                      </div>
                      <div>
                        <p className="font-medium">Choose Account Type</p>
                        <p className="text-sm text-muted-foreground">
                          Select Paper Trading (practice) or Live Trading (real money)
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => window.open('https://alpaca.markets/signup', '_blank')}
                  >
                    Open Alpaca Sign Up <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => setMode('quick')}>
                      I already have an account
                    </Button>
                    <Button onClick={() => setStep(2)}>
                      Continue <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Generate API Keys */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Generate API Keys</CardTitle>
                  <CardDescription>
                    Create API keys to securely connect your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <span className="text-lg font-bold text-primary">1</span>
                      </div>
                      <div>
                        <p className="font-medium">Go to Paper Trading Dashboard</p>
                        <p className="text-sm text-muted-foreground">
                          In your Alpaca account, navigate to Paper Trading
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <span className="text-lg font-bold text-primary">2</span>
                      </div>
                      <div>
                        <p className="font-medium">Find API Keys Section</p>
                        <p className="text-sm text-muted-foreground">
                          Click on "View" or "Generate" under API Keys
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <span className="text-lg font-bold text-primary">3</span>
                      </div>
                      <div>
                        <p className="font-medium">Copy Your Keys</p>
                        <p className="text-sm text-muted-foreground">
                          Save both the API Key ID and Secret Key somewhere safe
                        </p>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> The Secret Key is only shown once. Make sure to copy it!
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setStep(3)}>
                      I have my API keys <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Enter Credentials */}
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 3: Enter Your API Keys</CardTitle>
                  <CardDescription>
                    Your keys are encrypted and stored securely
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
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
                              <span className="text-sm font-medium">Practice Mode</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Simulated trading with fake money
                            </p>
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Trade with actual funds
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="apiKey">API Key ID</Label>
                      <Input
                        id="apiKey"
                        type="text"
                        placeholder="PKXXXXXXXXXXXXXXXXXX"
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
                          placeholder="Enter your secret key"
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
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back
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

            {/* Step 4: Set Limits */}
            {step === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Step 4: Set Trading Limits</CardTitle>
                  <CardDescription>
                    Protect yourself with trading safeguards
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="dailyLimit">Daily Trading Limit ($)</Label>
                      <Input
                        id="dailyLimit"
                        type="number"
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(e.target.value)}
                        placeholder="10000"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum total value of trades per day
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="perTradeLimit">Per-Trade Limit ($)</Label>
                      <Input
                        id="perTradeLimit"
                        type="number"
                        value={perTradeLimit}
                        onChange={(e) => setPerTradeLimit(e.target.value)}
                        placeholder="1000"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum value for a single trade
                      </p>
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
                      Back
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
                          Connect Account
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="quick" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quick Connect</CardTitle>
                <CardDescription>
                  Enter your Alpaca API credentials to connect instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Account Type</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <Button
                      variant={accountType === 'paper' ? 'default' : 'outline'}
                      onClick={() => setAccountType('paper')}
                      className="justify-start"
                    >
                      <Badge variant="secondary" className="mr-2">Paper</Badge>
                      Practice
                    </Button>
                    <Button
                      variant={accountType === 'live' ? 'default' : 'outline'}
                      onClick={() => setAccountType('live')}
                      className="justify-start"
                    >
                      <Badge variant="destructive" className="mr-2">Live</Badge>
                      Real Money
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="apiKeyQuick">API Key ID</Label>
                  <Input
                    id="apiKeyQuick"
                    type="text"
                    placeholder="PKXXXXXXXXXXXXXXXXXX"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono"
                  />
                </div>

                <div>
                  <Label htmlFor="apiSecretQuick">Secret Key</Label>
                  <div className="relative">
                    <Input
                      id="apiSecretQuick"
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Enter your secret key"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dailyLimitQuick">Daily Limit ($)</Label>
                    <Input
                      id="dailyLimitQuick"
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="perTradeLimitQuick">Per-Trade Limit ($)</Label>
                    <Input
                      id="perTradeLimitQuick"
                      type="number"
                      value={perTradeLimit}
                      onChange={(e) => setPerTradeLimit(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  className="w-full"
                  onClick={handleConnect}
                  disabled={connectAccount.isPending || !apiKey || !apiSecret}
                >
                  {connectAccount.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying & Connecting...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Connect Account
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Need help? <button onClick={() => setMode('guided')} className="text-primary underline">
                    Follow our guided setup
                  </button>
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
