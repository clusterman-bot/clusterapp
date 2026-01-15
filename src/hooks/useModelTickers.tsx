import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface ModelTicker {
  id: string;
  model_id: string;
  ticker: string;
  weight: number;
  is_active: boolean;
  created_at: string;
}

export function useModelTickers(modelId: string | undefined) {
  return useQuery({
    queryKey: ['model-tickers', modelId],
    queryFn: async () => {
      if (!modelId) return [];

      const { data, error } = await supabase
        .from('model_tickers')
        .select('*')
        .eq('model_id', modelId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ModelTicker[];
    },
    enabled: !!modelId,
  });
}

export function useAddModelTicker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      modelId, 
      ticker, 
      weight = 1.0 
    }: { 
      modelId: string; 
      ticker: string; 
      weight?: number;
    }) => {
      const { data, error } = await supabase
        .from('model_tickers')
        .insert({
          model_id: modelId,
          ticker: ticker.toUpperCase(),
          weight,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This ticker is already added to the model');
        }
        throw error;
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-tickers', variables.modelId] });
      toast({
        title: 'Ticker Added',
        description: `${variables.ticker.toUpperCase()} has been added to the model.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Ticker',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateModelTicker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      tickerId, 
      updates 
    }: { 
      tickerId: string; 
      updates: { weight?: number; is_active?: boolean };
    }) => {
      const { data, error } = await supabase
        .from('model_tickers')
        .update(updates)
        .eq('id', tickerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['model-tickers', data.model_id] });
      toast({
        title: 'Ticker Updated',
        description: 'Ticker settings have been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveModelTicker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ tickerId, modelId }: { tickerId: string; modelId: string }) => {
      const { error } = await supabase
        .from('model_tickers')
        .delete()
        .eq('id', tickerId);

      if (error) throw error;
      return { tickerId, modelId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-tickers', variables.modelId] });
      toast({
        title: 'Ticker Removed',
        description: 'The ticker has been removed from the model.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Removal Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
