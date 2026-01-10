import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Stock {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
  current_price: number;
  previous_close: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  market_cap: number | null;
  logo_url: string | null;
  updated_at: string;
}

export interface Holding {
  id: string;
  user_id: string;
  stock_id: string;
  quantity: number;
  average_cost: number;
  created_at: string;
  updated_at: string;
  stocks?: Stock;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  stock_id: string;
  created_at: string;
  stocks?: Stock;
}

export interface Order {
  id: string;
  user_id: string;
  stock_id: string;
  order_type: 'market' | 'limit' | 'stop_loss' | 'recurring';
  order_side: 'buy' | 'sell';
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  quantity: number;
  price: number | null;
  limit_price: number | null;
  stop_price: number | null;
  executed_price: number | null;
  executed_at: string | null;
  recurring_interval: string | null;
  next_execution_at: string | null;
  created_at: string;
  updated_at: string;
  stocks?: Stock;
}

export interface UserBalance {
  id: string;
  user_id: string;
  cash_balance: number;
  created_at: string;
  updated_at: string;
}

// Fetch all stocks
export function useStocks(searchQuery?: string) {
  return useQuery({
    queryKey: ['stocks', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('stocks')
        .select('*')
        .order('symbol');
      
      if (searchQuery) {
        query = query.or(`symbol.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Stock[];
    },
  });
}

// Fetch single stock
export function useStock(stockId: string | undefined) {
  return useQuery({
    queryKey: ['stock', stockId],
    queryFn: async () => {
      if (!stockId) return null;
      const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .eq('id', stockId)
        .maybeSingle();
      if (error) throw error;
      return data as Stock | null;
    },
    enabled: !!stockId,
  });
}

// Fetch stock by symbol
export function useStockBySymbol(symbol: string | undefined) {
  return useQuery({
    queryKey: ['stock', 'symbol', symbol],
    queryFn: async () => {
      if (!symbol) return null;
      const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data as Stock | null;
    },
    enabled: !!symbol,
  });
}

// Fetch user holdings (portfolio)
export function useHoldings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['holdings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('holdings')
        .select('*, stocks(*)')
        .eq('user_id', user.id)
        .gt('quantity', 0);
      if (error) throw error;
      return data as Holding[];
    },
    enabled: !!user,
  });
}

// Fetch user watchlist
export function useWatchlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['watchlist', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('watchlist')
        .select('*, stocks(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WatchlistItem[];
    },
    enabled: !!user,
  });
}

// Check if stock is in watchlist
export function useIsInWatchlist(stockId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['watchlist', user?.id, stockId],
    queryFn: async () => {
      if (!user || !stockId) return false;
      const { data, error } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('stock_id', stockId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!stockId,
  });
}

// Fetch user orders
export function useOrders(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', user?.id, status],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase
        .from('orders')
        .select('*, stocks(*)')
        .eq('user_id', user.id) as any;
        .order('created_at', { ascending: false });
      
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user,
  });
}

// Fetch user balance
export function useBalance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      // Try to get existing balance
      const { data, error } = await supabase
        .from('user_balances')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      // If no balance exists, create one
      if (!data) {
        const { data: newBalance, error: insertError } = await supabase
          .from('user_balances')
          .insert({ user_id: user.id, cash_balance: 10000 })
          .select()
          .single();
        
        if (insertError) throw insertError;
        return newBalance as UserBalance;
      }
      
      return data as UserBalance;
    },
    enabled: !!user,
  });
}

// Add to watchlist
export function useAddToWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stockId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('watchlist')
        .insert({ user_id: user.id, stock_id: stockId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast({ title: 'Added to watchlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Remove from watchlist
export function useRemoveFromWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (stockId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('stock_id', stockId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast({ title: 'Removed from watchlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Place order
export function usePlaceOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (order: {
      stockId: string;
      orderType: 'market' | 'limit' | 'stop_loss' | 'recurring';
      orderSide: 'buy' | 'sell';
      quantity: number;
      limitPrice?: number;
      stopPrice?: number;
      recurringInterval?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Get current stock price
      const { data: stock } = await supabase
        .from('stocks')
        .select('current_price')
        .eq('id', order.stockId)
        .single();

      if (!stock) throw new Error('Stock not found');

      // Get user balance
      const { data: balance } = await supabase
        .from('user_balances')
        .select('cash_balance')
        .eq('user_id', user.id)
        .single();

      if (!balance) throw new Error('Balance not found');

      const orderValue = order.quantity * stock.current_price;

      // For market buy orders, check balance and execute immediately
      if (order.orderType === 'market') {
        if (order.orderSide === 'buy' && orderValue > balance.cash_balance) {
          throw new Error('Insufficient funds');
        }

        if (order.orderSide === 'sell') {
          // Check if user has enough shares
          const { data: holding } = await supabase
            .from('holdings')
            .select('quantity')
            .eq('user_id', user.id)
            .eq('stock_id', order.stockId)
            .maybeSingle();

          if (!holding || holding.quantity < order.quantity) {
            throw new Error('Insufficient shares');
          }
        }

        // Create order as executed
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: user.id,
            stock_id: order.stockId,
            order_type: order.orderType,
            order_side: order.orderSide,
            quantity: order.quantity,
            price: stock.current_price,
            executed_price: stock.current_price,
            status: 'executed',
            executed_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Update balance
        const newBalance = order.orderSide === 'buy' 
          ? balance.cash_balance - orderValue 
          : balance.cash_balance + orderValue;

        await supabase
          .from('user_balances')
          .update({ cash_balance: newBalance })
          .eq('user_id', user.id);

        // Update holdings
        if (order.orderSide === 'buy') {
          const { data: existingHolding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', user.id)
            .eq('stock_id', order.stockId)
            .maybeSingle();

          if (existingHolding) {
            const totalQuantity = Number(existingHolding.quantity) + order.quantity;
            const totalCost = (Number(existingHolding.quantity) * Number(existingHolding.average_cost)) + orderValue;
            const newAverageCost = totalCost / totalQuantity;

            await supabase
              .from('holdings')
              .update({ quantity: totalQuantity, average_cost: newAverageCost })
              .eq('id', existingHolding.id);
          } else {
            await supabase
              .from('holdings')
              .insert({
                user_id: user.id,
                stock_id: order.stockId,
                quantity: order.quantity,
                average_cost: stock.current_price,
              });
          }
        } else {
          // Sell - reduce holdings
          const { data: holding } = await supabase
            .from('holdings')
            .select('*')
            .eq('user_id', user.id)
            .eq('stock_id', order.stockId)
            .single();

          if (holding) {
            const newQuantity = Number(holding.quantity) - order.quantity;
            if (newQuantity > 0) {
              await supabase
                .from('holdings')
                .update({ quantity: newQuantity })
                .eq('id', holding.id);
            } else {
              await supabase
                .from('holdings')
                .delete()
                .eq('id', holding.id);
            }
          }
        }

        return newOrder;
      } else {
        // For other order types, create as pending
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            user_id: user.id,
            stock_id: order.stockId,
            order_type: order.orderType,
            order_side: order.orderSide,
            quantity: order.quantity,
            price: stock.current_price,
            limit_price: order.limitPrice,
            stop_price: order.stopPrice,
            recurring_interval: order.recurringInterval,
            status: 'pending',
          })
          .select()
          .single();

        if (orderError) throw orderError;
        return newOrder;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      toast({
        title: 'Order placed',
        description: `${variables.orderSide.toUpperCase()} order ${variables.orderType === 'market' ? 'executed' : 'submitted'}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Order failed', description: error.message, variant: 'destructive' });
    },
  });
}

// Cancel order
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: 'Order cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}
