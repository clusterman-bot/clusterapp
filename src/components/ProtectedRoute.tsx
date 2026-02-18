import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const [mfaChecking, setMfaChecking] = useState(true);
  const [mfaPassed, setMfaPassed] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMfaChecking(false);
      return;
    }

    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      // If user has MFA enrolled but hasn't completed the challenge yet
      if (data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2') {
        setMfaPassed(false);
      } else {
        setMfaPassed(true);
      }
      setMfaChecking(false);
    });
  }, [user, authLoading]);

  if (authLoading || mfaChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!mfaPassed) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
