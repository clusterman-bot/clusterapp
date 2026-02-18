import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MainNav } from '@/components/MainNav';
import { Button } from '@/components/ui/button';

// /models/new now goes directly to the AI Chat Builder
export default function ModelBuilderHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/trade/ai-builder', { replace: true });
    }
  }, [user, navigate]);

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

  return null;
}
