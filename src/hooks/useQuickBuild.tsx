import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface QuickBuildRun {
  id: string;
  user_id: string;
  symbol: string;
  status: string;
  ai_analysis: any;
  indicators_config: any;
  hyperparameters: any;
  training_period: string | null;
  validation_period: string | null;
  training_run_id: string | null;
  validation_run_id: string | null;
  model_id: string | null;
  results: any;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function useStartQuickBuild() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (symbol: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('quick-build', {
        body: { symbol },
      });

      if (response.error) throw response.error;
      return response.data as { run_id: string; training_run_id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick_build_runs'] });
    },
  });
}

export function useQuickBuildRun(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['quick_build_run', id],
    queryFn: async () => {
      if (!id || !user?.id) return null;

      const { data, error } = await supabase
        .from('quick_build_runs')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data as QuickBuildRun;
    },
    enabled: !!id && !!user?.id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && !['completed', 'failed'].includes(data.status)) {
        return 2000;
      }
      return false;
    },
  });
}

export function useQuickBuildRuns(symbol?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['quick_build_runs', user?.id, symbol],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('quick_build_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (symbol) {
        query = query.eq('symbol', symbol.toUpperCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QuickBuildRun[];
    },
    enabled: !!user?.id,
  });
}
