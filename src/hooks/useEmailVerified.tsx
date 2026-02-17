import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

export function useEmailVerified() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const isLoading = authLoading || profileLoading;
  const isVerified = !!profile?.email_verified;
  const isLoggedIn = !!user;

  return { isVerified, isLoggedIn, isLoading, user, profile };
}
