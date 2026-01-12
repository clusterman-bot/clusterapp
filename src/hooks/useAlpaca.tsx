import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useTradingMode } from './useTradingMode';
import { useBrokerageAccounts } from './useBrokerageAccounts';

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  cash: number;
  buying_power: number;
  portfolio_value: number;
  equity: number;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  qty: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
  avg_entry_price: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: string;
  side: string;
  type: string;
  status: string;
  filled_qty: string;
  filled_avg_price: string | null;
  created_at: string;
}

export interface AlpacaAsset {
  symbol: string;
  name: string;
  exchange: string;
  asset_class: string;
  tradable: boolean;
  fractionable: boolean;
}

export interface AlpacaQuote {
  symbol: string;
  bid?: number;
  ask?: number;
  price: number;
  timestamp?: string;
}

// Fetch Alpaca account info - only when brokerage is connected
export function useAlpacaAccount() {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  const { data: brokerageAccounts } = useBrokerageAccounts();
  
  // Check if user has the right type of account connected
  const accountType = isPaper ? 'paper' : 'live';
  const hasConnectedAccount = brokerageAccounts?.some(
    acc => acc.account_type === accountType && acc.is_active
  );
  
  return useQuery({
    queryKey: ['alpaca-account', user?.id, isPaper],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/account', {
        body: { isPaper },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.account as AlpacaAccount;
    },
    enabled: !!user && !!hasConnectedAccount,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });
}

// Fetch Alpaca positions - only when brokerage is connected
export function useAlpacaPositions() {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  const { data: brokerageAccounts } = useBrokerageAccounts();
  
  const accountType = isPaper ? 'paper' : 'live';
  const hasConnectedAccount = brokerageAccounts?.some(
    acc => acc.account_type === accountType && acc.is_active
  );
  
  return useQuery({
    queryKey: ['alpaca-positions', user?.id, isPaper],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/positions', {
        body: { isPaper },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.positions as AlpacaPosition[];
    },
    enabled: !!user && !!hasConnectedAccount,
    refetchInterval: 30000,
    retry: false,
  });
}

// Search for stocks via Alpaca - only when any brokerage is connected
export function useAlpacaSearch(query: string) {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  const { data: brokerageAccounts } = useBrokerageAccounts();
  
  const hasAnyConnectedAccount = brokerageAccounts && brokerageAccounts.length > 0;
  
  return useQuery({
    queryKey: ['alpaca-search', query],
    queryFn: async () => {
      if (!query || query.length < 1) return [];
      
      const { data, error } = await supabase.functions.invoke('alpaca-trading/search-assets', {
        body: { isPaper, query, limit: 30 },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.assets as AlpacaAsset[];
    },
    enabled: !!user && query.length >= 1 && !!hasAnyConnectedAccount,
    staleTime: 60000, // Cache for 1 minute
    retry: false,
  });
}

// Get real-time quote for a symbol - only when brokerage is connected
export function useAlpacaQuote(symbol: string | undefined) {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  const { data: brokerageAccounts } = useBrokerageAccounts();
  
  const hasAnyConnectedAccount = brokerageAccounts && brokerageAccounts.length > 0;
  
  return useQuery({
    queryKey: ['alpaca-quote', symbol],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/get-quote', {
        body: { isPaper, symbol },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.quote as AlpacaQuote;
    },
    enabled: !!user && !!symbol && !!hasAnyConnectedAccount,
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: false,
  });
}

// Place order via Alpaca
export function useAlpacaPlaceOrder() {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (order: {
      stockId: string;
      symbol: string;
      quantity: number;
      side: 'buy' | 'sell';
      orderType: 'market' | 'limit' | 'stop_loss';
      limitPrice?: number;
      stopPrice?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/place-order', {
        body: {
          isPaper,
          stockId: order.stockId,
          symbol: order.symbol,
          quantity: order.quantity,
          side: order.side,
          orderType: order.orderType,
          limitPrice: order.limitPrice,
          stopPrice: order.stopPrice,
        },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.order as AlpacaOrder;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['alpaca-account'] });
      queryClient.invalidateQueries({ queryKey: ['alpaca-positions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      
      toast({
        title: `${isPaper ? '[PAPER]' : '[LIVE]'} Order ${data.status}`,
        description: `${variables.side.toUpperCase()} ${variables.quantity} ${variables.symbol}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Order failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Cancel order via Alpaca
export function useAlpacaCancelOrder() {
  const { isPaper } = useTradingMode();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (alpacaOrderId: string) => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/cancel-order', {
        body: { isPaper, alpacaOrderId },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alpaca-account'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Order cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
