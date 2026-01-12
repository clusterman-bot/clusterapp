import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { MainNav } from '@/components/MainNav';
import { BrokerageAccountsManager } from '@/components/brokerage/BrokerageAccountsManager';
import { Loader2 } from 'lucide-react';

export default function BrokerageSettings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="container py-6">
        <BrokerageAccountsManager />
      </main>
    </div>
  );
}
