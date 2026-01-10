import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Users, Zap } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && user) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Cluster</span>
          </div>
          <Button onClick={() => navigate('/auth')}>Get Started</Button>
        </div>
      </header>

      <main>
        <section className="container py-24 text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Build. Backtest. <span className="text-primary">Monetize.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Create AI-powered trading models, validate with professional backtesting, and earn performance fees from your subscribers.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>Start Building</Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/explore')}>Explore Models</Button>
          </div>
        </section>

        <section className="container py-16">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sandbox or No-Code</h3>
              <p className="text-muted-foreground">Run custom code in isolated containers or use our visual strategy builder.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Professional Backtesting</h3>
              <p className="text-muted-foreground">Comprehensive metrics: Sharpe ratio, max drawdown, win rate, and more.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Performance Fees</h3>
              <p className="text-muted-foreground">Monetize your strategies with performance-based fees from subscribers.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}