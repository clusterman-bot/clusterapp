import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Code, LineChart, TrendingUp, Users, Zap, Target, 
  ChevronRight, ChevronLeft, X, Sparkles, ArrowRight
} from 'lucide-react';
import { AppRole } from '@/hooks/useUserRole';

interface OnboardingTourProps {
  role: AppRole;
  onComplete: () => void;
}

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  highlight?: string;
}

const developerSteps: TourStep[] = [
  {
    title: "Welcome, Developer! 🚀",
    description: "You're now part of the Cluster developer community. Let's show you how to build and monetize your trading strategies.",
    icon: <Sparkles className="h-8 w-8 text-primary" />,
  },
  {
    title: "Create Trading Models",
    description: "Head to the Dashboard and click 'New Model' to start building. Choose from ML-based models or rule-based strategies.",
    icon: <Code className="h-8 w-8 text-primary" />,
    action: "Go to Dashboard → New Model",
    highlight: "dashboard"
  },
  {
    title: "Train & Backtest",
    description: "Use our ML training pipeline to train models on historical data. Run backtests to see how your strategy would have performed.",
    icon: <Target className="h-8 w-8 text-primary" />,
    action: "Select a model → Run Backtest",
    highlight: "backtest"
  },
  {
    title: "Deploy & Earn",
    description: "Once your model is ready, publish it to the marketplace. Set performance fees and earn when traders subscribe to your strategy.",
    icon: <Zap className="h-8 w-8 text-primary" />,
    action: "Model Settings → Make Public",
    highlight: "publish"
  },
  {
    title: "Build Your Following",
    description: "Share your performance, post updates, and connect with traders in the community to grow your subscriber base.",
    icon: <Users className="h-8 w-8 text-primary" />,
    action: "Visit Feed & Explore",
    highlight: "social"
  }
];

const traderSteps: TourStep[] = [
  {
    title: "Welcome, Trader! 📈",
    description: "You're ready to discover and subscribe to top-performing trading strategies. Let's get you started.",
    icon: <Sparkles className="h-8 w-8 text-primary" />,
  },
  {
    title: "Explore the Marketplace",
    description: "Browse our collection of AI trading models. Filter by performance, risk level, and asset class to find strategies that match your goals.",
    icon: <LineChart className="h-8 w-8 text-primary" />,
    action: "Go to Marketplace",
    highlight: "marketplace"
  },
  {
    title: "Connect Your Brokerage",
    description: "Link your Alpaca account (paper or live) to enable automated trading. Your credentials are encrypted and secure.",
    icon: <Target className="h-8 w-8 text-primary" />,
    action: "Settings → Brokerage",
    highlight: "brokerage"
  },
  {
    title: "Subscribe to Models",
    description: "When you find a model you trust, subscribe to it. The model will automatically execute trades in your connected account.",
    icon: <Zap className="h-8 w-8 text-primary" />,
    action: "Model Details → Subscribe",
    highlight: "subscribe"
  },
  {
    title: "Track Performance",
    description: "Monitor your portfolio, view trade history, and track the performance of your subscribed models all in one place.",
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
    action: "Visit Dashboard",
    highlight: "portfolio"
  }
];

export default function OnboardingTour({ role, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  const steps = role === 'developer' ? developerSteps : traderSteps;
  const totalSteps = steps.length;
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem('onboarding_completed', 'true');
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-full max-w-lg mx-4 relative overflow-hidden">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            {step.icon}
          </div>
          <CardTitle className="text-2xl">{step.title}</CardTitle>
          <CardDescription className="text-base mt-2">
            {step.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step.action && (
            <div className="bg-muted/50 rounded-lg p-4 border border-dashed border-border">
              <p className="text-sm font-medium text-primary flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                {step.action}
              </p>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep 
                    ? 'bg-primary w-6' 
                    : index < currentStep 
                      ? 'bg-primary/50' 
                      : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <Button onClick={handleNext} className="gap-2">
              {currentStep === totalSteps - 1 ? (
                <>
                  Get Started
                  <Sparkles className="h-4 w-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
