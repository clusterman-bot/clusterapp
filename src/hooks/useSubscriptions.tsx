import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Subscription {
  id: string;
  subscriber_id: string;
  model_id: string;
  performance_fee_percent: number;
  status: 'active' | 'cancelled';
  subscribed_at: string;
  cancelled_at: string | null;
  total_pnl: number | null;
  total_fees_paid: number | null;
}

export interface SubscriptionWithModel extends Subscription {
  models: {
    id: string;
    name: string;
    description: string | null;
    total_return: number | null;
    sharpe_ratio: number | null;
    max_drawdown: number | null;
    win_rate: number | null;
    profiles: {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      is_verified: boolean | null;
    };
  };
}

export function useMySubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscriptions', 'my', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          models (
            id,
            name,
            description,
            total_return,
            sharpe_ratio,
            max_drawdown,
            win_rate,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url,
              is_verified
            )
          )
        `)
        .eq('subscriber_id', user.id)
        .eq('status', 'active')
        .order('subscribed_at', { ascending: false });

      if (error) throw error;
      return data as unknown as SubscriptionWithModel[];
    },
    enabled: !!user?.id,
  });
}

export function useSubscribeToModel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ modelId, performanceFee }: { modelId: string; performanceFee: number }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check if any subscription row already exists (active or cancelled)
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('id, status')
        .eq('subscriber_id', user.id)
        .eq('model_id', modelId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') throw new Error('Already subscribed to this model');

        // Reactivate a previously cancelled subscription
        const { data, error } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            cancelled_at: null,
            performance_fee_percent: performanceFee,
            subscribed_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // No existing row — insert fresh
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          subscriber_id: user.id,
          model_id: modelId,
          performance_fee_percent: performanceFee,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}

export function useUnsubscribeFromModel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', subscriptionId)
        .eq('subscriber_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}

export function useIsSubscribed(modelId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscriptions', 'check', user?.id, modelId],
    queryFn: async () => {
      if (!user?.id || !modelId) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('subscriber_id', user.id)
        .eq('model_id', modelId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!modelId,
  });
}
