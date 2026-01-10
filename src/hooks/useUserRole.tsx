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

export function useSetUserRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (role: AppRole) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('user_roles' as any)
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('user_roles' as any)
          .update({ role })
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as UserRole;
      } else {
        const { data, error } = await supabase
          .from('user_roles' as any)
          .insert({ user_id: user.id, role })
          .select()
          .single();
        if (error) throw error;
        return data as unknown as UserRole;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-role', user?.id] });
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
