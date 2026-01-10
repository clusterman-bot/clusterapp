import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Json } from '@/integrations/supabase/types';

export interface Model {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  strategy_overview: string | null;
  model_type: 'no-code' | 'sandbox';
  status: 'draft' | 'published' | 'archived';
  is_public: boolean;
  performance_fee_percent: number;
  total_subscribers: number;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  total_return: number | null;
  configuration: Json;
  created_at: string;
  updated_at: string;
}

export function useMyModels() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['models', 'my', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Model[];
    },
    enabled: !!user?.id,
  });
}

export function usePublicModels() {
  return useQuery({
    queryKey: ['models', 'public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('models')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('is_public', true)
        .eq('status', 'published')
        .order('total_subscribers', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useModel(id: string | undefined) {
  return useQuery({
    queryKey: ['models', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('models')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (model: { name: string; description?: string; model_type?: string; strategy_overview?: string; is_public?: boolean; performance_fee_percent?: number; configuration?: Json; user_id: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('models')
        .insert({
          name: model.name,
          description: model.description,
          model_type: model.model_type,
          strategy_overview: model.strategy_overview,
          is_public: model.is_public,
          performance_fee_percent: model.performance_fee_percent,
          configuration: model.configuration,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models', 'my', user?.id] });
    },
  });
}

export function useUpdateModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; description?: string; strategy_overview?: string; is_public?: boolean; status?: string; performance_fee_percent?: number } }) => {
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
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}

export function useDeleteModel() {
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
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}
