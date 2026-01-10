import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Backtest {
  id: string;
  model_id: string;
  user_id: string;
  name: string | null;
  start_date: string;
  end_date: string;
  initial_capital: number;
  benchmark: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  profit_factor: number | null;
  total_return: number | null;
  cagr: number | null;
  total_trades: number;
  equity_curve: Array<{ date: string; value: number }>;
  created_at: string;
  completed_at: string | null;
}

export interface Trade {
  id: string;
  backtest_id: string;
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  entry_date: string;
  exit_date: string | null;
  pnl: number | null;
  pnl_percent: number | null;
  status: 'open' | 'closed';
  created_at: string;
}

export function useBacktests(modelId: string | undefined) {
  return useQuery({
    queryKey: ['backtests', modelId],
    queryFn: async () => {
      if (!modelId) return [];
      
      const { data, error } = await supabase
        .from('backtests')
        .select('*')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Backtest[];
    },
    enabled: !!modelId,
  });
}

export function useBacktest(id: string | undefined) {
  return useQuery({
    queryKey: ['backtest', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('backtests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Backtest;
    },
    enabled: !!id,
  });
}

export function useTrades(backtestId: string | undefined) {
  return useQuery({
    queryKey: ['trades', backtestId],
    queryFn: async () => {
      if (!backtestId) return [];
      
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('backtest_id', backtestId)
        .order('entry_date', { ascending: false });
      
      if (error) throw error;
      return data as Trade[];
    },
    enabled: !!backtestId,
  });
}

export function useCreateBacktest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (backtest: { model_id: string; name?: string; start_date: string; end_date: string; initial_capital?: number; benchmark?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('backtests')
        .insert({
          model_id: backtest.model_id,
          name: backtest.name,
          start_date: backtest.start_date,
          end_date: backtest.end_date,
          initial_capital: backtest.initial_capital,
          benchmark: backtest.benchmark,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backtests', data.model_id] });
    },
  });
}
