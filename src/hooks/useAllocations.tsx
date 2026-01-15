import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Allocation {
  id: string;
  user_id: string;
  subscription_id: string;
  model_id: string;
  allocated_amount: number;
  current_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AllocationWithModel extends Allocation {
  models: {
    id: string;
    name: string;
    description: string | null;
    total_return: number | null;
    sharpe_ratio: number | null;
    profiles: {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}

export function useMyAllocations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['allocations', 'my', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('allocations')
        .select(`
          *,
          models (
            id,
            name,
            description,
            total_return,
            sharpe_ratio,
            profiles:user_id (
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as AllocationWithModel[];
    },
    enabled: !!user?.id,
  });
}

export function usePaperBalance() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['paper-balance', user?.id],
    queryFn: async () => {
      if (!user?.id) return { paper_balance: 100000, allocated_balance: 0 };

      const { data, error } = await supabase
        .from('profiles')
        .select('paper_balance, allocated_balance')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return {
        paper_balance: data?.paper_balance ?? 100000,
        allocated_balance: data?.allocated_balance ?? 0,
      };
    },
    enabled: !!user?.id,
  });
}

export function useCreateAllocation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      subscriptionId, 
      modelId, 
      amount 
    }: { 
      subscriptionId: string; 
      modelId: string; 
      amount: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current paper balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('paper_balance, allocated_balance')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const availableBalance = (profile?.paper_balance ?? 100000) - (profile?.allocated_balance ?? 0);
      if (amount > availableBalance) {
        throw new Error(`Insufficient balance. Available: $${availableBalance.toLocaleString()}`);
      }

      // Create allocation
      const { data: allocation, error: allocationError } = await supabase
        .from('allocations')
        .insert({
          user_id: user.id,
          subscription_id: subscriptionId,
          model_id: modelId,
          allocated_amount: amount,
          current_value: amount,
          is_active: true,
        })
        .select()
        .single();

      if (allocationError) throw allocationError;

      // Update allocated balance
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          allocated_balance: (profile?.allocated_balance ?? 0) + amount,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      return allocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['paper-balance'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast({
        title: 'Allocation Created',
        description: 'Your paper trading money has been allocated to this model.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Allocation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateAllocation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      allocationId, 
      newAmount 
    }: { 
      allocationId: string; 
      newAmount: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current allocation and profile
      const { data: allocation, error: allocError } = await supabase
        .from('allocations')
        .select('*')
        .eq('id', allocationId)
        .eq('user_id', user.id)
        .single();

      if (allocError) throw allocError;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('paper_balance, allocated_balance')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const difference = newAmount - allocation.allocated_amount;
      const availableBalance = (profile?.paper_balance ?? 100000) - (profile?.allocated_balance ?? 0);
      
      if (difference > availableBalance) {
        throw new Error(`Insufficient balance. Available: $${availableBalance.toLocaleString()}`);
      }

      // Update allocation
      const { error: updateAllocError } = await supabase
        .from('allocations')
        .update({
          allocated_amount: newAmount,
          current_value: allocation.current_value + difference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', allocationId);

      if (updateAllocError) throw updateAllocError;

      // Update profile allocated balance
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          allocated_balance: (profile?.allocated_balance ?? 0) + difference,
        })
        .eq('id', user.id);

      if (updateProfileError) throw updateProfileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['paper-balance'] });
      toast({
        title: 'Allocation Updated',
        description: 'Your allocation has been updated.',
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

export function useRemoveAllocation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (allocationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current allocation
      const { data: allocation, error: allocError } = await supabase
        .from('allocations')
        .select('*')
        .eq('id', allocationId)
        .eq('user_id', user.id)
        .single();

      if (allocError) throw allocError;

      // Return funds to paper balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('allocated_balance')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Deactivate allocation
      const { error: updateError } = await supabase
        .from('allocations')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', allocationId);

      if (updateError) throw updateError;

      // Return funds
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          allocated_balance: Math.max(0, (profile?.allocated_balance ?? 0) - allocation.current_value),
        })
        .eq('id', user.id);

      if (profileUpdateError) throw profileUpdateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['paper-balance'] });
      toast({
        title: 'Allocation Removed',
        description: 'Your funds have been returned to your paper balance.',
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

// Get allocation for a specific subscription
export function useAllocationForSubscription(subscriptionId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['allocation', subscriptionId],
    queryFn: async () => {
      if (!user?.id || !subscriptionId) return null;

      const { data, error } = await supabase
        .from('allocations')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as Allocation | null;
    },
    enabled: !!user?.id && !!subscriptionId,
  });
}
