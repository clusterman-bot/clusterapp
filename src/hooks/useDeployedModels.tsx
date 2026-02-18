import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface DeployedModel {
  id: string;
  model_id: string;
  user_id: string;
  status: 'running' | 'stopped' | 'error';
  last_signal_at: string | null;
  total_signals: number;
  total_trades: number;
  config: Record<string, any> | null;
  error_message: string | null;
  deployed_at: string;
  updated_at: string;
  models?: {
    name: string;
    ticker: string | null;
  };
}

export interface ModelSignal {
  id: string;
  model_id: string;
  ticker: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number | null;
  price_at_signal: number | null;
  quantity: number;
  metadata: Record<string, any> | null;
  generated_at: string;
  executed_at: string | null;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
}

export interface SubscriberTrade {
  id: string;
  subscription_id: string;
  signal_id: string;
  user_id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  executed_price: number | null;
  pnl: number | null;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  alpaca_order_id: string | null;
  error_message: string | null;
  created_at: string;
  executed_at: string | null;
}

export function useDeployedModel(modelId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['deployed-model', modelId],
    queryFn: async () => {
      if (!modelId) return null;

      const { data, error } = await supabase
        .from('deployed_models')
        .select('*, models(name, ticker)')
        .eq('model_id', modelId)
        .maybeSingle();

      if (error) throw error;
      return data as DeployedModel | null;
    },
    enabled: !!modelId,
  });
}

export function useMyDeployedModels() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['deployed-models', 'my', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('deployed_models')
        .select('*, models(name, ticker)')
        .eq('user_id', user.id)
        .order('deployed_at', { ascending: false });

      if (error) throw error;
      return data as DeployedModel[];
    },
    enabled: !!user?.id,
  });
}

export function useModelSignals(modelId: string | undefined) {
  return useQuery({
    queryKey: ['model-signals', modelId],
    queryFn: async () => {
      if (!modelId) return [];

      const { data, error } = await supabase
        .from('model_signals')
        .select('*')
        .eq('model_id', modelId)
        .order('generated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ModelSignal[];
    },
    enabled: !!modelId,
  });
}

export function useMySubscriberTrades() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscriber-trades', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('subscriber_trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as SubscriberTrade[];
    },
    enabled: !!user?.id,
  });
}

export function useUpdateDeploymentConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, config }: { id: string; config: Record<string, any> }) => {
      const { error } = await supabase
        .from('deployed_models')
        .update({ config })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployed-model'] });
      queryClient.invalidateQueries({ queryKey: ['deployed-models'] });
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

export function useDeployModel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (modelId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('trading-bot/deploy', {
        body: { modelId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployed-model'] });
      queryClient.invalidateQueries({ queryKey: ['deployed-models'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      toast({
        title: 'Model Deployed',
        description: 'Your trading bot is now live and actively trading.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Deployment Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useStopModel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (modelId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('trading-bot/stop', {
        body: { modelId },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployed-model'] });
      queryClient.invalidateQueries({ queryKey: ['deployed-models'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      toast({
        title: 'Model Stopped',
        description: 'Your trading bot has been stopped.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Stop Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useGenerateSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ modelId, marketData }: { modelId: string; marketData?: any }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('trading-bot/generate-signal', {
        body: { modelId, marketData },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-signals'] });
      queryClient.invalidateQueries({ queryKey: ['deployed-model'] });
      queryClient.invalidateQueries({ queryKey: ['subscriber-trades'] });
    },
  });
}

// Real-time subscription to signals
export function useSignalRealtimeUpdates(modelId: string | undefined) {
  const queryClient = useQueryClient();

  useQuery({
    queryKey: ['signal-realtime', modelId],
    queryFn: async () => {
      if (!modelId) return null;

      const channel = supabase
        .channel(`signals-${modelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'model_signals',
            filter: `model_id=eq.${modelId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['model-signals', modelId] });
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    },
    enabled: !!modelId,
  });
}

// Real-time subscription to subscriber trades
export function useTradeRealtimeUpdates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useQuery({
    queryKey: ['trades-realtime', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const channel = supabase
        .channel(`trades-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriber_trades',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['subscriber-trades', user.id] });
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    },
    enabled: !!user?.id,
  });
}
