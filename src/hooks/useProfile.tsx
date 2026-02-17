import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  trading_philosophy: string | null;
  experience_level: string;
  user_type: string;
  is_verified: boolean;
  email_verified: boolean;
  total_followers: number;
  total_following: number;
  total_earnings: number;
  twitter_handle: string | null;
  linkedin_url: string | null;
  github_handle: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user?.id,
  });
}

export function useProfileById(userId: string | undefined, currentUserId?: string) {
  const isOwnProfile = userId === currentUserId;
  
  return useQuery({
    queryKey: ['profile', userId, isOwnProfile],
    queryFn: async () => {
      if (!userId) return null;
      
      // Own profile: use base table for full access
      if (isOwnProfile) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        return data as Profile;
      }
      
      // Other profiles: use public_profiles view for privacy
      const { data, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });
}
