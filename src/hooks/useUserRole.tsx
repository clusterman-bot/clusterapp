import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'developer' | 'retail_trader';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export function useUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as UserRole | null;
    },
    enabled: !!user?.id,
  });
}

export function useIsAdmin() {
  const { data: role, isLoading } = useUserRole();
  return { isAdmin: role?.role === 'admin', isLoading };
}

export function useIsDeveloper() {
  const { data: role, isLoading } = useUserRole();
  return { isDeveloper: role?.role === 'developer', isLoading };
}

export function useIsRetailTrader() {
  const { data: role, isLoading } = useUserRole();
  return { isRetailTrader: role?.role === 'retail_trader', isLoading };
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (role: AppRole) => {
      // Wait for user to be available (max 3 seconds)
      let currentUser = user;
      let attempts = 0;
      while (!currentUser && attempts < 6) {
        await new Promise(resolve => setTimeout(resolve, 500));
        // Re-check auth state
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user ?? null;
        attempts++;
      }
      
      if (!currentUser?.id) {
        throw new Error('Not authenticated - please try again');
      }

      const { data: existing } = await supabase
        .from('user_roles' as any)
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('user_roles' as any)
          .update({ role })
          .eq('user_id', currentUser.id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as UserRole;
      } else {
        const { data, error } = await supabase
          .from('user_roles' as any)
          .insert({ user_id: currentUser.id, role })
          .select()
          .single();
        if (error) throw error;
        return data as unknown as UserRole;
      }
    },
    onSuccess: (_, __, ___) => {
      // Invalidate with a slight delay to ensure the query picks up the new data
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['user-role'] });
      }, 100);
    },
  });
}

export function useAllUsers() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin', 'all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: roles } = await supabase.from('user_roles' as any).select('*');
      const rolesMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

      return data.map(profile => ({
        ...profile,
        role: rolesMap.get(profile.id) || null,
      }));
    },
    enabled: isAdmin,
  });
}

export function useAdminStats() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const [usersResult, modelsResult, postsResult, subscriptionsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('models').select('id', { count: 'exact', head: true }),
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }),
      ]);
      return {
        totalUsers: usersResult.count || 0,
        totalModels: modelsResult.count || 0,
        totalPosts: postsResult.count || 0,
        totalSubscriptions: subscriptionsResult.count || 0,
      };
    },
    enabled: isAdmin,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { data: existing } = await supabase
        .from('user_roles' as any)
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('user_roles' as any)
          .update({ role })
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as UserRole;
      } else {
        const { data, error } = await supabase
          .from('user_roles' as any)
          .insert({ user_id: userId, role })
          .select()
          .single();
        if (error) throw error;
        return data as unknown as UserRole;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-users'] });
    },
  });
}

export function useAllModels() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ['admin', 'all-models'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('models')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
}

export function useAdminUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { status?: string; is_public?: boolean } }) => {
      const { data, error } = await supabase
        .from('models')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-models'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}

export function useAdminDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-models'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}
