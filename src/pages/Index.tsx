import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, Sparkles, LogIn } from 'lucide-react';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/trade', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-8 px-4 max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-7 w-7 text-primary" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Welcome to <span className="text-primary">Cluster</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Your AI-powered stock trading platform. Build strategies, follow models, and trade smarter.
          </p>
        </div>

        <div className="space-y-3 max-w-xs mx-auto">
          <Button 
            size="lg" 
            className="w-full text-lg h-14 gap-3" 
            onClick={() => navigate('/auth?mode=signup&tutorial=true')}
          >
            <Sparkles className="h-5 w-5" />
            First Time? Launch Tutorial!
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full text-lg h-14 gap-3" 
            onClick={() => navigate('/auth')}
          >
            <LogIn className="h-5 w-5" />
            Returning User? Log In
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Free to get started · No credit card required
        </p>
      </div>
    </div>
  );
}
