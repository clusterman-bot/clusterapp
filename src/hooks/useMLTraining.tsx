import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useEffect } from 'react';

export interface IndicatorsConfig {
  sma: { enabled: boolean; windows: number[] };
  rsi: { enabled: boolean; period: number };
  bollinger: { enabled: boolean; window: number; std: number };
  volatility: { enabled: boolean; window: number };
  sma_deviation: { enabled: boolean };
}

export interface HyperparametersConfig {
  random_forest: {
    n_estimators: number;
    max_depth: number;
    min_samples_split: number;
  };
  gradient_boosting: {
    n_estimators: number;
    learning_rate: number;
    max_depth: number;
  };
  logistic_regression: {
    C: number;
    max_iter: number;
  };
}

export interface TrainingRun {
  id: string;
  model_id: string | null;
  user_id: string;
  ticker: string;
  start_date: string;
  end_date: string;
  indicators_enabled: any;
  hyperparameters: any;
  results: Record<string, { accuracy: number; f1: number; recall: number }> | null;
  best_model_name: string | null;
  best_model_metrics: { accuracy: number; f1: number; recall: number } | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ValidationRun {
  id: string;
  training_run_id: string | null;
  model_id: string | null;
  user_id: string;
  start_date: string;
  end_date: string;
  metrics: { accuracy: number; f1: number; recall: number; precision: number };
  signal_distribution: { BUY: number; SELL: number; HOLD: number };
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function useTrainingRuns(modelId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['training_runs', user?.id, modelId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('training_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (modelId) {
        query = query.eq('model_id', modelId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as TrainingRun[];
    },
    enabled: !!user?.id,
  });
}

export function useTrainingRun(id: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['training_run', id],
    queryFn: async () => {
      if (!id || !user?.id) return null;
      
      const { data, error } = await supabase
        .from('training_runs')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data as TrainingRun;
    },
    enabled: !!id && !!user?.id,
    refetchInterval: (query) => {
      // Poll every 2 seconds if training is in progress
      const data = query.state.data;
      if (data && (data.status === 'pending' || data.status === 'running')) {
        return 2000;
      }
      return false;
    },
  });
}

export function useStartTraining() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (config: {
      model_id?: string;
      ticker: string;
      start_date: string;
      end_date: string;
      indicators: IndicatorsConfig;
      hyperparameters: HyperparametersConfig;
      horizon: number;
      theta: number;
      demo_mode?: boolean;
      limit?: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      
      console.log(`Starting training - Demo mode: ${config.demo_mode}, Limit: ${config.limit}`);
      
      const response = await supabase.functions.invoke('ml-backend/train', {
        body: config,
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training_runs'] });
    },
  });
}

export function useStopTraining() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (trainingRunId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const response = await supabase.functions.invoke('ml-backend/stop', {
        body: { training_run_id: trainingRunId },
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training_runs'] });
    },
  });
}

export function useValidationRuns(trainingRunId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['validation_runs', user?.id, trainingRunId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('validation_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (trainingRunId) {
        query = query.eq('training_run_id', trainingRunId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ValidationRun[];
    },
    enabled: !!user?.id,
  });
}

export function useStartValidation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (config: {
      model_id?: string;
      training_run_id: string;
      start_date: string;
      end_date: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const response = await supabase.functions.invoke('ml-backend/validate', {
        body: config,
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation_runs'] });
    },
  });
}

export function useFetchMarketData() {
  return useMutation({
    mutationFn: async (params: {
      ticker: string;
      start_date: string;
      end_date: string;
      timespan?: string;
    }) => {
      const response = await supabase.functions.invoke('fetch-market-data', {
        body: params,
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
  });
}

// Real-time subscription for training status updates
export function useTrainingRealtimeUpdates(trainingRunId: string | undefined) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!trainingRunId) return;
    
    const channel = supabase
      .channel(`training_run_${trainingRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'training_runs',
          filter: `id=eq.${trainingRunId}`,
        },
        (payload) => {
          console.log('Training run updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['training_run', trainingRunId] });
          queryClient.invalidateQueries({ queryKey: ['training_runs'] });
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [trainingRunId, queryClient]);
}
