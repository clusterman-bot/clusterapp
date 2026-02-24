import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  previous_close: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  market_cap: number | null;
  logo_url: string | null;
  updated_at: string;
}

export interface CryptoHolding {
  id: string;
  user_id: string;
  crypto_asset_id: string;
  quantity: number;
  average_cost: number;
  created_at: string;
  updated_at: string;
  crypto_assets?: CryptoAsset;
}

export interface CryptoWatchlistItem {
  id: string;
  user_id: string;
  crypto_asset_id: string;
  created_at: string;
  crypto_assets?: CryptoAsset;
}

export interface CryptoOrder {
  id: string;
  user_id: string;
  crypto_asset_id: string;
  order_type: 'market' | 'limit' | 'stop_loss';
  order_side: 'buy' | 'sell';
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  quantity: number;
  price: number | null;
  limit_price: number | null;
  stop_price: number | null;
  executed_price: number | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
  crypto_assets?: CryptoAsset;
}

// Fetch all crypto assets
export function useCryptoAssets(searchQuery?: string) {
  return useQuery({
    queryKey: ['crypto-assets', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('crypto_assets')
        .select('*')
        .order('symbol');

      if (searchQuery) {
        query = query.or(`symbol.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CryptoAsset[];
    },
  });
}

// Fetch single crypto asset by symbol
export function useCryptoBySymbol(symbol: string | undefined) {
  return useQuery({
    queryKey: ['crypto-asset', 'symbol', symbol],
    queryFn: async () => {
      if (!symbol) return null;
      const { data, error } = await supabase
        .from('crypto_assets')
        .select('*')
        .eq('symbol', symbol.toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data as CryptoAsset | null;
    },
    enabled: !!symbol,
  });
}

// Fetch user crypto watchlist
export function useCryptoWatchlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['crypto-watchlist', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('crypto_watchlist')
        .select('*, crypto_assets(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CryptoWatchlistItem[];
    },
    enabled: !!user,
  });
}

// Check if crypto is in watchlist
export function useIsCryptoInWatchlist(cryptoAssetId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['crypto-watchlist', user?.id, cryptoAssetId],
    queryFn: async () => {
      if (!user || !cryptoAssetId) return false;
      const { data, error } = await supabase
        .from('crypto_watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('crypto_asset_id', cryptoAssetId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!cryptoAssetId,
  });
}

// Add to crypto watchlist
export function useAddToCryptoWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (cryptoAssetId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('crypto_watchlist')
        .insert({ user_id: user.id, crypto_asset_id: cryptoAssetId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crypto-watchlist'] });
      toast({ title: 'Added to crypto watchlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Remove from crypto watchlist
export function useRemoveFromCryptoWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (cryptoAssetId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('crypto_watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('crypto_asset_id', cryptoAssetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crypto-watchlist'] });
      toast({ title: 'Removed from crypto watchlist' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

// Fetch user crypto orders
export function useCryptoOrders(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['crypto-orders', user?.id, status],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase
        .from('crypto_orders')
        .select('*, crypto_assets(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CryptoOrder[];
    },
    enabled: !!user,
  });
}
