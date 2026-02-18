import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, Sliders, ArrowRight, Zap, Brain } from 'lucide-react';

export default function ModelBuilderHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <MainNav />
        <main className="container py-12 text-center">
          <p className="text-muted-foreground mb-4">Sign in to create a trading model.</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container max-w-3xl py-10">
        <div className="flex items-center gap-4 mb-8">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bot className="h-7 w-7 text-primary" />
              Create a Model
            </h1>
            <p className="text-muted-foreground mt-1">
              Choose how you want to build your trading model
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* AI Chat Builder */}
          <Card
            className="group cursor-pointer border-2 hover:border-primary/60 transition-all hover:shadow-lg"
            onClick={() => navigate('/trade/ai-builder')}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  Recommended
                </Badge>
              </div>
              <CardTitle className="text-xl">AI Chat Builder</CardTitle>
              <CardDescription>
                Describe your strategy in plain English — the AI generates a fully configured trading bot in seconds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Natural language prompts
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Multi-turn refinement
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Deploy directly to any stock
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Post to Community Marketplace
                </li>
              </ul>
              <Button className="w-full group-hover:bg-primary/90 transition-colors" size="sm">
                Start with AI
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Manual ML Builder */}
          <Card
            className="group cursor-pointer border-2 hover:border-primary/60 transition-all hover:shadow-lg"
            onClick={() => navigate('/models/builder')}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                  <Brain className="h-6 w-6 text-foreground" />
                </div>
                <Badge variant="outline">Advanced</Badge>
              </div>
              <CardTitle className="text-xl">ML Model Builder</CardTitle>
              <CardDescription>
                Manually configure indicators, train ML models on historical data, and backtest before publishing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
                  Full indicator configuration
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
                  ML training (Random Forest, XGBoost…)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
                  Backtesting & validation
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
                  Sandbox code execution
                </li>
              </ul>
              <Button variant="outline" className="w-full" size="sm">
                Build manually
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Both builders let you publish your model to the Community Marketplace after creation.
        </p>
      </main>
    </div>
  );
}
