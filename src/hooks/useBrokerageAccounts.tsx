import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface BrokerageAccount {
  id: string;
  user_id: string;
  broker_name: string;
  account_type: 'paper' | 'live';
  account_id: string | null;
  account_status: string | null;
  is_active: boolean;
  daily_trade_limit: number;
  per_trade_limit: number;
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
}

export interface TradingActivityLog {
  id: string;
  user_id: string;
  brokerage_account_id: string | null;
  action_type: string;
  symbol: string | null;
  quantity: number | null;
  side: string | null;
  order_type: string | null;
  status: string | null;
  amount: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Hook to fetch user's brokerage accounts
export function useBrokerageAccounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['brokerage-accounts', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_brokerage_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BrokerageAccount[];
    },
    enabled: !!user,
  });
}

// Hook to get active brokerage account for a specific type
export function useActiveBrokerageAccount(accountType: 'paper' | 'live') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['brokerage-account-active', user?.id, accountType],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_brokerage_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_type', accountType)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as BrokerageAccount | null;
    },
    enabled: !!user,
  });
}

// Hook to connect/add a brokerage account
export function useConnectBrokerageAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      apiKey: string;
      apiSecret: string;
      accountType: 'paper' | 'live';
      brokerName?: string;
      dailyLimit?: number;
      perTradeLimit?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Call edge function to verify credentials and encrypt
      const { data, error } = await supabase.functions.invoke('brokerage-accounts', {
        body: {
          action: 'connect',
          apiKey: params.apiKey,
          apiSecret: params.apiSecret,
          accountType: params.accountType,
          brokerName: params.brokerName || 'Alpaca',
          dailyLimit: params.dailyLimit || 10000,
          perTradeLimit: params.perTradeLimit || 1000,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to connect account');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerage-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['brokerage-account-active'] });
      toast.success('Brokerage account connected successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to connect account');
    },
  });
}

// Hook to disconnect/remove a brokerage account
export function useDisconnectBrokerageAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke('brokerage-accounts', {
        body: {
          action: 'disconnect',
          accountId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to disconnect account');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerage-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['brokerage-account-active'] });
      toast.success('Account disconnected');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect account');
    },
  });
}

// Hook to update trading limits
export function useUpdateTradingLimits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      accountId: string;
      dailyLimit: number;
      perTradeLimit: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('brokerage-accounts', {
        body: {
          action: 'update-limits',
          accountId: params.accountId,
          dailyLimit: params.dailyLimit,
          perTradeLimit: params.perTradeLimit,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to update limits');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerage-accounts'] });
      toast.success('Trading limits updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update limits');
    },
  });
}

// Hook to verify account credentials
export function useVerifyBrokerageAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke('brokerage-accounts', {
        body: {
          action: 'verify',
          accountId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to verify account');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brokerage-accounts'] });
      toast.success('Account verified successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to verify account');
    },
  });
}

// Hook to fetch trading activity logs
export function useTradingActivityLogs(limit: number = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['trading-activity-logs', user?.id, limit],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('trading_activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as TradingActivityLog[];
    },
    enabled: !!user,
  });
}
