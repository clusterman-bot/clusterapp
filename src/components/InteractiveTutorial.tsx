import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  X, ChevronRight, Sparkles, TrendingUp, Shield,
  CheckCircle2, ArrowRight, ExternalLink, Eye, EyeOff,
  Loader2, FlaskConical, Zap
} from 'lucide-react';
import { useConnectBrokerageAccount } from '@/hooks/useBrokerageAccounts';
import { useTradingMode } from '@/hooks/useTradingMode';

type Step = 'welcome' | 'trading-mode' | 'brokerage' | 'brokerage-keys' | 'done';

interface InteractiveTutorialProps {
  onComplete: () => void;
}

export default function InteractiveTutorial({ onComplete }: InteractiveTutorialProps) {
  const navigate = useNavigate();
  const { setMode } = useTradingMode();
  const connectAccount = useConnectBrokerageAccount();

  const [step, setStep] = useState<Step>('welcome');
  const [selectedMode, setSelectedMode] = useState<'paper' | 'live' | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [brokerageConnected, setBrokerageConnected] = useState(false);

  const handleModeSelect = (mode: 'paper' | 'live') => {
    setSelectedMode(mode);
    setMode(mode);
  };

  const handleConnectBrokerage = async () => {
    if (!apiKey || !apiSecret || !selectedMode) return;
    try {
      await connectAccount.mutateAsync({
        apiKey,
        apiSecret,
        accountType: selectedMode,
        brokerName: 'Alpaca',
      });
      setBrokerageConnected(true);
      setStep('done');
    } catch {
      // error toast handled by hook
    }
  };

  const handleFinish = () => {
    onComplete();
    navigate('/trade', { replace: true });
  };

  const stepOrder: Step[] = ['welcome', 'trading-mode', 'brokerage', 'done'];
  const currentIdx = stepOrder.indexOf(step === 'brokerage-keys' ? 'brokerage' : step);
  const totalSteps = stepOrder.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <Card className="w-full max-w-lg relative overflow-hidden border-border shadow-2xl">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((currentIdx + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Close / skip */}
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Skip setup"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ─── WELCOME ─── */}
        {step === 'welcome' && (
          <>
            <CardHeader className="text-center pt-10 pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to Cluster! 🎉</CardTitle>
              <CardDescription className="text-base mt-2">
                Let's get you set up to start trading in under 2 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="space-y-3">
                {[
                  { icon: <FlaskConical className="h-4 w-4 text-primary" />, text: 'Choose paper or live trading' },
                  { icon: <Shield className="h-4 w-4 text-primary" />, text: 'Connect your Alpaca brokerage account' },
                  { icon: <TrendingUp className="h-4 w-4 text-primary" />, text: 'Start trading stocks instantly' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                    {item.icon}
                    <span className="text-sm font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full h-12 text-base gap-2 mt-2" onClick={() => setStep('trading-mode')}>
                Let's Get Started <ChevronRight className="h-5 w-5" />
              </Button>
              <button
                onClick={onComplete}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip setup and explore on my own
              </button>
            </CardContent>
          </>
        )}

        {/* ─── TRADING MODE ─── */}
        {step === 'trading-mode' && (
          <>
            <CardHeader className="pt-10 pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">1</span>
                Step 1 of 3
              </div>
              <CardTitle className="text-xl">How do you want to trade?</CardTitle>
              <CardDescription>
                You can always switch between paper and live trading later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleModeSelect('paper')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedMode === 'paper'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <Badge variant="secondary" className="text-xs">Recommended</Badge>
                  </div>
                  <p className="font-semibold text-sm">Paper Trading</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Practice with $100,000 in virtual money. Zero risk.
                  </p>
                </button>
                <button
                  onClick={() => handleModeSelect('live')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedMode === 'live'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-destructive" />
                    <Badge variant="destructive" className="text-xs">Real Money</Badge>
                  </div>
                  <p className="font-semibold text-sm">Live Trading</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Trade with real funds from your brokerage account.
                  </p>
                </button>
              </div>

              {selectedMode === 'live' && (
                <Alert className="border-destructive/30 bg-destructive/5">
                  <AlertDescription className="text-xs text-destructive">
                    Live trading involves real money. Only use funds you can afford to lose.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full h-11 gap-2"
                disabled={!selectedMode}
                onClick={() => setStep('brokerage')}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </>
        )}

        {/* ─── BROKERAGE INTRO ─── */}
        {step === 'brokerage' && (
          <>
            <CardHeader className="pt-10 pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">2</span>
                Step 2 of 3
              </div>
              <CardTitle className="text-xl">Connect your Alpaca account</CardTitle>
              <CardDescription>
                Alpaca is a free brokerage that powers Cluster's trading. You'll need an account to place orders.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="space-y-3">
                {[
                  'Go to alpaca.markets and sign up for free',
                  `Choose "${selectedMode === 'live' ? 'Live' : 'Paper'} Trading" in your dashboard`,
                  'Navigate to API Keys and generate a new key pair',
                  'Come back here and paste your keys below',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
                    <span className="bg-primary/10 text-primary font-bold text-xs rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm">{text}</p>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => window.open('https://alpaca.markets/signup', '_blank')}
              >
                Open Alpaca Sign Up <ExternalLink className="h-4 w-4" />
              </Button>

              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep('trading-mode')}>
                  Back
                </Button>
                <Button className="flex-1 gap-2" onClick={() => setStep('brokerage-keys')}>
                  I have my keys <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* ─── BROKERAGE KEYS ─── */}
        {step === 'brokerage-keys' && (
          <>
            <CardHeader className="pt-10 pb-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]">2</span>
                Step 2 of 3
              </div>
              <CardTitle className="text-xl">Enter your API keys</CardTitle>
              <CardDescription>
                Keys are encrypted end-to-end. We never store them in plain text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">API Key ID</Label>
                  <Input
                    id="apiKey"
                    type="text"
                    placeholder="PKXXXXXXXXXXXXXXXXXX"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apiSecret">Secret Key</Label>
                  <div className="relative">
                    <Input
                      id="apiSecret"
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Your Alpaca secret key"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      className="font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Alert className="border-primary/20 bg-primary/5">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  Your keys are encrypted before being stored. Cluster cannot trade without your explicit actions.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setStep('brokerage')}>
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!apiKey || !apiSecret || connectAccount.isPending}
                  onClick={handleConnectBrokerage}
                >
                  {connectAccount.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <button
                onClick={() => setStep('done')}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now — I'll connect later
              </button>
            </CardContent>
          </>
        )}

        {/* ─── DONE ─── */}
        {step === 'done' && (
          <>
            <CardHeader className="text-center pt-10 pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">You're all set! 🚀</CardTitle>
              <CardDescription className="text-base mt-2">
                {brokerageConnected
                  ? 'Your brokerage is connected and you\'re ready to trade.'
                  : 'You can connect your brokerage anytime from Settings.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">
                    Trading mode set to{' '}
                    <span className="font-semibold">
                      {selectedMode === 'live' ? 'Live Trading 💸' : 'Paper Trading 🧪'}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  {brokerageConnected ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border-2 border-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm">
                    {brokerageConnected ? 'Alpaca account connected ✓' : 'Brokerage not connected yet (you can do this later)'}
                  </span>
                </div>
              </div>

              <Button className="w-full h-12 text-base gap-2 mt-2" onClick={handleFinish}>
                <Sparkles className="h-5 w-5" />
                Start Trading
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
