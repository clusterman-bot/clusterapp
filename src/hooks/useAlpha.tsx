import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useIsAlpha() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-is-alpha', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) return false;
      return (data as any)?.role === 'alpha';
    },
    enabled: !!user?.id,
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings' as any)
        .select('key, value');
      if (error) throw error;
      const settings: Record<string, boolean> = {};
      for (const row of (data as any[]) || []) {
        settings[row.key] = row.value === 'true';
      }
      return settings;
    },
    staleTime: 30_000,
  });
}

export function useUpdatePlatformSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase
        .from('platform_settings' as any)
        .update({ value: value ? 'true' : 'false', updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
  });
}

export function useMuteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, muted }: { userId: string; muted: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_muted: muted } as any)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-users'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useFreezeTrading() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, frozen }: { userId: string; frozen: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ trading_frozen: frozen } as any)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-users'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useSetRoleForUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data: existing } = await supabase
        .from('user_roles' as any)
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_roles' as any)
          .update({ role })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles' as any)
          .insert({ user_id: userId, role });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alpha', 'all-users'] });
    },
  });
}

export function useAllUsersForAlpha() {
  const { data: isAlpha } = useIsAlpha();

  return useQuery({
    queryKey: ['alpha', 'all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_muted, trading_frozen, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: roles } = await supabase
        .from('user_roles' as any)
        .select('user_id, role');
      const rolesMap = new Map(((roles as any[]) || []).map((r: any) => [r.user_id, r.role]));

      return data.map((p: any) => ({
        ...p,
        role: rolesMap.get(p.id) || null,
      }));
    },
    enabled: !!isAlpha,
  });
}
