import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface StockAutomation {
  id: string;
  user_id: string;
  symbol: string;
  is_active: boolean;
  allow_shorting: boolean;
  indicators: {
    rsi: { enabled: boolean; periods: number[] };
    sma: { enabled: boolean; windows: number[] };
    ema: { enabled: boolean; windows: number[] };
    bollinger: { enabled: boolean; window: number; std: number };
    sma_deviation: { enabled: boolean; window: number };
  };
  rsi_oversold: number;
  rsi_overbought: number;
  horizon_minutes: number;
  theta: number;
  position_size_percent: number;
  max_quantity: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  max_investment_amount: number | null;
  current_invested_amount: number;
  last_checked_at: string | null;
  last_signal_at: string | null;
  total_signals: number;
  total_trades: number;
  self_improve_enabled: boolean;
  min_win_rate: number;
  max_drawdown_threshold: number;
  max_consecutive_losses: number;
  last_optimization_at: string | null;
  optimization_generation: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationSignal {
  id: string;
  automation_id: string;
  user_id: string;
  symbol: string;
  signal_type: string;
  confidence: number;
  price_at_signal: number;
  indicator_snapshot: any;
  trade_executed: boolean;
  alpaca_order_id: string | null;
  executed_price: number | null;
  error_message: string | null;
  created_at: string;
}

export function useStockAutomation(symbol?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['stock-automation', symbol],
    queryFn: async () => {
      if (!user || !symbol) return null;
      const { data, error } = await supabase
        .from('stock_automations')
        .select('*')
        .eq('user_id', user.id)
        .eq('symbol', symbol.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data as unknown as StockAutomation | null;
    },
    enabled: !!user && !!symbol,
  });
}

export function useMyAutomations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-automations'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('stock_automations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as StockAutomation[];
    },
    enabled: !!user,
  });
}

export function useUpsertAutomation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<StockAutomation> & { symbol: string }) => {
      if (!user) throw new Error('Not authenticated');
      const payload = { ...config, user_id: user.id, symbol: config.symbol.toUpperCase() };

      const { data, error } = await supabase
        .from('stock_automations')
        .upsert(payload as any, { onConflict: 'user_id,symbol' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stock-automation', data.symbol] });
      queryClient.invalidateQueries({ queryKey: ['my-automations'] });
      toast({ title: 'Automation saved', description: `Configuration for ${data.symbol} updated.` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useToggleAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('stock_automations')
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-automations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-automation'] });
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stock_automations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-automations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-automation'] });
      toast({ title: 'Automation deleted' });
    },
  });
}

export function useResetInvestedAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stock_automations')
        .update({ current_invested_amount: 0 } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-automations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-automation'] });
      toast({ title: 'Budget reset', description: 'Current invested amount has been reset to $0.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useAutomationSignals(automationId?: string) {
  return useQuery({
    queryKey: ['automation-signals', automationId],
    queryFn: async () => {
      if (!automationId) return [];
      const { data, error } = await supabase
        .from('automation_signals')
        .select('*')
        .eq('automation_id', automationId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AutomationSignal[];
    },
    enabled: !!automationId,
    refetchInterval: 30000,
  });
}

export interface OptimizationLog {
  id: string;
  automation_id: string;
  user_id: string;
  trigger_reason: string;
  stage: string;
  old_config: any;
  new_config: any;
  old_metrics: any;
  new_metrics: any;
  status: string;
  created_at: string;
}

export function useOptimizationLogs(automationId?: string) {
  return useQuery({
    queryKey: ['optimization-logs', automationId],
    queryFn: async () => {
      if (!automationId) return [];
      const { data, error } = await supabase
        .from('bot_optimization_logs')
        .select('*')
        .eq('automation_id', automationId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as OptimizationLog[];
    },
    enabled: !!automationId,
  });
}
