import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface StrategyConfig {
  risk_level: 'low' | 'medium' | 'high';
  position_size_percent: number;
  max_positions: number;
  stop_loss_percent: number;
  take_profit_percent: number;
}

export function useUpdateModelStrategy() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      modelId, 
      strategy 
    }: { 
      modelId: string; 
      strategy: Partial<StrategyConfig>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('models')
        .update({
          risk_level: strategy.risk_level,
          position_size_percent: strategy.position_size_percent,
          max_positions: strategy.max_positions,
          stop_loss_percent: strategy.stop_loss_percent,
          take_profit_percent: strategy.take_profit_percent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', modelId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['models', data.id] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      toast({
        title: 'Strategy Updated',
        description: 'Your model strategy has been updated.',
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

export function usePublishModel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      modelId, 
      isPublic 
    }: { 
      modelId: string; 
      isPublic: boolean;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('models')
        .update({
          is_public: isPublic,
          status: isPublic ? 'published' : 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', modelId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['models', data.id] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      toast({
        title: data.is_public ? 'Model Published' : 'Model Unpublished',
        description: data.is_public 
          ? 'Your model is now visible in the marketplace.' 
          : 'Your model has been set to draft.',
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
