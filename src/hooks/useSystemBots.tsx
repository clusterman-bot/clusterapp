import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsAlpha } from './useAlpha';

interface SystemBotConfig {
  id: string;
  model_id: string;
  sector: string;
  ticker_pool: string[];
  current_ticker: string | null;
  last_rotation_at: string | null;
  last_optimization_at: string | null;
  optimization_generation: number;
  rotation_interval_days: number;
  is_active: boolean;
  created_at: string;
}

interface SystemBotModel {
  id: string;
  name: string;
  ticker: string | null;
  total_subscribers: number | null;
  total_return: number | null;
  sharpe_ratio: number | null;
  win_rate: number | null;
  max_drawdown: number | null;
  status: string | null;
  indicators_config: any;
}

interface SystemBotDeployment {
  status: string;
  last_signal_at: string | null;
  total_signals: number | null;
  total_trades: number | null;
}

export interface SystemBot {
  config: SystemBotConfig;
  model: SystemBotModel | null;
  deployment: SystemBotDeployment | null;
}

export function useSystemBots() {
  const { data: isAlpha } = useIsAlpha();

  return useQuery({
    queryKey: ['system-bots', 'status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-bots', {
        body: { action: 'status' },
      });
      if (error) throw error;
      return data as { bots: SystemBot[]; bootstrapped: boolean };
    },
    enabled: !!isAlpha,
    refetchInterval: 60_000,
  });
}

export function useBootstrapSystemBots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-bots', {
        body: { action: 'bootstrap' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-bots'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}

export function useRotateSystemBotTickers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ force = true }: { force?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke('system-bots', {
        body: { action: 'rotate-tickers', force },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-bots'] });
    },
  });
}

export function useOptimizeSystemBots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-bots', {
        body: { action: 'optimize' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-bots'] });
    },
  });
}

export function useUpdateSystemBotConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      config_id: string;
      model_id?: string;
      updates?: Partial<Pick<SystemBotConfig, 'ticker_pool' | 'rotation_interval_days' | 'is_active'>>;
      model_updates?: { name?: string; description?: string };
    }) => {
      const { data, error } = await supabase.functions.invoke('system-bots', {
        body: { action: 'update-config', ...params },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-bots'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });
}
