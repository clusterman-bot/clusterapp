import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useTradingMode } from './useTradingMode';

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

// Fetch Alpaca account info
export function useAlpacaAccount() {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  
  return useQuery({
    queryKey: ['alpaca-account', user?.id, isPaper],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/account', {
        body: { isPaper },
      });
      
      // If no brokerage connected, return null instead of throwing
      if (data?.needsConnection) return null;
      // If credentials are invalid, return object with needsReconnect flag
      if (data?.needsReconnect) {
        return { needsReconnect: true } as any;
      }
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.account as AlpacaAccount;
    },
    enabled: !!user,
    refetchInterval: 30000,
    retry: false,
  });
}

// Fetch Alpaca positions
export function useAlpacaPositions() {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  
  return useQuery({
    queryKey: ['alpaca-positions', user?.id, isPaper],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/positions', {
        body: { isPaper },
      });
      
      // If no brokerage connected, return empty array instead of throwing
      if (data?.needsConnection) return [];
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.positions as AlpacaPosition[];
    },
    enabled: !!user,
    refetchInterval: 30000,
    retry: false,
  });
}

// Search for stocks via Alpaca
export function useAlpacaSearch(query: string) {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  
  return useQuery({
    queryKey: ['alpaca-search', query],
    queryFn: async () => {
      if (!query || query.length < 1) return [];
      
      const { data, error } = await supabase.functions.invoke('alpaca-trading', {
        body: { action: 'search-assets', isPaper, query, limit: 30 },
      });
      
      // If no brokerage connected, return empty array instead of throwing
      if (data?.needsConnection) return [];
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.assets as AlpacaAsset[];
    },
    enabled: !!user && query.length >= 1,
    staleTime: 60000,
    retry: false,
  });
}

// Get real-time quote for a symbol
export function useAlpacaQuote(symbol: string | undefined) {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  
  return useQuery({
    queryKey: ['alpaca-quote', symbol],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/get-quote', {
        body: { isPaper, symbol },
      });
      
      // If no brokerage connected, return null instead of throwing
      if (data?.needsConnection) return null;
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.quote as AlpacaQuote;
    },
    enabled: !!user && !!symbol,
    refetchInterval: 10000,
    retry: false,
  });
}

// Fetch Alpaca portfolio history for charting
// Map period to the correct timeframe for Alpaca API
const PORTFOLIO_TIMEFRAME_MAP: Record<string, string> = {
  '1D': '5Min',
  '1W': '1H',
  '1M': '1D',
  '3M': '1D',
  '1A': '1D',
  'all': '1D',
};

export function useAlpacaPortfolioHistory(period: string = '1M') {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  const timeframe = PORTFOLIO_TIMEFRAME_MAP[period] || '1D';
  
  return useQuery({
    queryKey: ['alpaca-portfolio-history', user?.id, isPaper, period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/portfolio-history', {
        body: { isPaper, period, timeframe },
      });
      
      if (data?.needsConnection) return null;
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.history as {
        timestamp: number[];
        equity: number[];
        profit_loss: number[];
        profit_loss_pct: number[];
        base_value: number;
        timeframe: string;
      };
    },
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
    retry: false,
  });
}

// Fetch Alpaca orders
export function useAlpacaOrders(status: string = 'all') {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();
  
  return useQuery({
    queryKey: ['alpaca-orders', user?.id, isPaper, status],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/orders', {
        body: { isPaper, status, limit: 20 },
      });
      
      if (data?.needsConnection) return [];
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data.orders as AlpacaOrder[];
    },
    enabled: !!user,
    refetchInterval: 30000,
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

// Fetch single asset info from Alpaca (name, exchange, tradable)
export function useAlpacaAssetInfo(symbol: string | undefined) {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();

  return useQuery({
    queryKey: ['alpaca-asset-info', symbol],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading', {
        body: { action: 'search-assets', isPaper, query: symbol, limit: 5 },
      });

      if (data?.needsConnection) return null;
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const assets = data.assets as AlpacaAsset[];
      const exact = assets.find((a: AlpacaAsset) => a.symbol === symbol);
      return exact || null;
    },
    enabled: !!user && !!symbol,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// Alpaca bar data for charting
export interface AlpacaBar {
  timestamp: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIMEFRAME_MAP: Record<string, { barSize: string; daysBack: number }> = {
  '1D': { barSize: '5Min', daysBack: 4 },
  '1W': { barSize: '1Hour', daysBack: 10 },
  '1M': { barSize: '1Day', daysBack: 30 },
  '3M': { barSize: '1Day', daysBack: 90 },
  '1Y': { barSize: '1Day', daysBack: 365 },
  'ALL': { barSize: '1Day', daysBack: 730 },
};

// Crypto trades 24/7 — no extra lookback needed for weekends/holidays
const CRYPTO_TIMEFRAME_MAP: Record<string, { barSize: string; daysBack: number }> = {
  '1D': { barSize: '5Min', daysBack: 1 },
  '1W': { barSize: '1Hour', daysBack: 7 },
  '1M': { barSize: '1Day', daysBack: 30 },
  '3M': { barSize: '1Day', daysBack: 90 },
  '1Y': { barSize: '1Day', daysBack: 365 },
  'ALL': { barSize: '1Day', daysBack: 730 },
};

// Format a local date as YYYY-MM-DD without UTC conversion
function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useAlpacaBars(symbol: string | undefined, uiTimeframe: string = '1M', isCrypto?: boolean) {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();

  const tfMap = isCrypto ? CRYPTO_TIMEFRAME_MAP : TIMEFRAME_MAP;
  const mapping = tfMap[uiTimeframe] || tfMap['1M'];

  return useQuery({
    queryKey: ['alpaca-bars', symbol, uiTimeframe, isPaper, isCrypto],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - mapping.daysBack);
      const startStr = localDateString(start);

      const action = isCrypto ? 'get-crypto-bars' : 'get-bars';
      const { data, error } = await supabase.functions.invoke(`alpaca-trading/${action}`, {
        body: {
          isPaper,
          symbol,
          timeframe: mapping.barSize,
          start: startStr,
          limit: 1000,
        },
      });

      if (data?.needsConnection) return null;
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.bars as AlpacaBar[];
    },
    enabled: !!user && !!symbol,
    staleTime: 60000,
    retry: false,
  });
}

// Get real-time crypto quote
export function useAlpacaCryptoQuote(symbol: string | undefined) {
  const { user } = useAuth();
  const { isPaper } = useTradingMode();

  return useQuery({
    queryKey: ['alpaca-crypto-quote', symbol],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('alpaca-trading/get-crypto-quote', {
        body: { isPaper, symbol },
      });

      if (data?.needsConnection) return null;
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.quote as AlpacaQuote;
    },
    enabled: !!user && !!symbol,
    refetchInterval: 10000,
    retry: false,
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
