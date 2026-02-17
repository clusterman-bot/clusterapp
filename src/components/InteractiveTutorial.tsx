import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  X, ChevronRight, ChevronLeft, Sparkles,
  LineChart, Briefcase, ClipboardList, Settings,
  TrendingUp, Search, Star, Bot
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  tip: string;
}

const steps: TutorialStep[] = [
  {
    title: "Welcome to Cluster! 🎉",
    description: "Cluster is your AI-powered stock trading platform. Let's walk through what you can do here.",
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    tip: "This tour takes about 1 minute. You can skip anytime.",
  },
  {
    title: "Trade Stocks",
    description: "Browse and search stocks in the Trade tab. View real-time prices, charts, and market data. Place buy and sell orders with just a few clicks.",
    icon: <LineChart className="h-8 w-8 text-primary" />,
    tip: "Start by exploring the stock list — tap any stock to see its detail page.",
  },
  {
    title: "Search & Discover",
    description: "Use the search bar to find any stock by name or ticker symbol. Filter by sector, price movers, or add stocks to your personal watchlist.",
    icon: <Search className="h-8 w-8 text-primary" />,
    tip: "Star your favorite stocks to track them in your Watchlist tab.",
  },
  {
    title: "Your Portfolio",
    description: "Track your holdings, see total portfolio value, and monitor profit/loss in real-time. The Portfolio page gives you a complete overview of your investments.",
    icon: <Briefcase className="h-8 w-8 text-primary" />,
    tip: "Your paper trading balance starts at $100,000 — practice risk-free!",
  },
  {
    title: "Manage Orders",
    description: "View all your pending, filled, and cancelled orders. Place market orders for instant execution or limit orders to buy at your target price.",
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
    tip: "Limit orders let you set the exact price you want to pay.",
  },
  {
    title: "AI Trading Models",
    description: "Discover AI-powered trading strategies built by developers. Subscribe to models that automatically trade on your behalf based on signals.",
    icon: <Bot className="h-8 w-8 text-primary" />,
    tip: "Each model shows its track record — check the win rate and returns.",
  },
  {
    title: "Connect Your Brokerage",
    description: "Link your Alpaca brokerage account to enable live or paper trading. Your API keys are encrypted and secure.",
    icon: <Settings className="h-8 w-8 text-primary" />,
    tip: "Start with a paper account to practice before going live.",
  },
  {
    title: "You're All Set! 🚀",
    description: "You now know the essentials of Cluster. Head to the Trade page to start exploring stocks and building your portfolio.",
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
    tip: "Remember: you can always access Settings from the nav bar.",
  },
];

interface InteractiveTutorialProps {
  onComplete: () => void;
}

export default function InteractiveTutorial({ onComplete }: InteractiveTutorialProps) {
  const [current, setCurrent] = useState(0);
  const step = steps[current];
  const progress = ((current + 1) / steps.length) * 100;
  const isLast = current === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-full max-w-md mx-4 relative overflow-hidden border-primary/20">
        {/* Progress */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">
              Step {current + 1} of {steps.length}
            </span>
            <button
              onClick={onComplete}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <CardContent className="pt-4 pb-6 space-y-5">
          {/* Icon + Title */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              {step.icon}
            </div>
            <h2 className="text-xl font-bold">{step.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Tip */}
          <div className="bg-accent/50 border border-accent rounded-lg p-3">
            <p className="text-xs text-accent-foreground flex items-start gap-2">
              <Star className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{step.tip}</span>
            </p>
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current
                    ? 'bg-primary w-6'
                    : i < current
                      ? 'bg-primary/40 w-2'
                      : 'bg-muted w-2'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent(c => c - 1)}
              disabled={current === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <Button
              size="sm"
              onClick={() => {
                if (isLast) {
                  onComplete();
                } else {
                  setCurrent(c => c + 1);
                }
              }}
              className="gap-1"
            >
              {isLast ? (
                <>
                  Start Trading
                  <TrendingUp className="h-4 w-4" />
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
