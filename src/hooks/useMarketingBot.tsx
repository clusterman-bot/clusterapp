import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type MarketingBotConfig = {
  id: string;
  user_id: string;
  is_active: boolean;
  interval_hours: number;
  pages_to_capture: string[];
  instagram_account_id: string | null;
  ig_access_token_encrypted: string | null;
  caption_template: string | null;
  last_posted_at: string | null;
  next_post_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MarketingBotLog = {
  id: string;
  user_id: string;
  status: string;
  instagram_post_id: string | null;
  caption: string | null;
  pages_captured: string[];
  error_message: string | null;
  created_at: string;
};

// AES-256-GCM encrypt for the token (client-side → passed to server to store)
// We actually send the plaintext to a server action that encrypts it.
// For the UI we only need read + upsert (token is encrypted server-side via edge function).

export function useMarketingBotConfig() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['marketing-bot-config', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('marketing_bot_config')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as MarketingBotConfig | null;
    },
    enabled: !!user?.id,
  });
}

export function useMarketingBotLogs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['marketing-bot-logs', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('marketing_bot_logs')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as MarketingBotLog[];
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });
}

export function useSaveMarketingBotConfig() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      is_active: boolean;
      interval_hours: number;
      pages_to_capture: string[];
      instagram_account_id: string;
      ig_access_token_plaintext?: string; // only sent when changed
      caption_template: string;
    }) => {
      // We need to encrypt the token via edge function if provided
      let tokenEncrypted: string | undefined;

      if (payload.ig_access_token_plaintext) {
        // Call edge function to encrypt the token
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const resp = await fetch(`${supabaseUrl}/functions/v1/instagram-marketing-bot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ action: 'encrypt_token', token: payload.ig_access_token_plaintext }),
        });
        const result = await resp.json();
        if (result.encrypted) {
          tokenEncrypted = result.encrypted;
        }
      }

      const upsertData: any = {
        user_id: user!.id,
        is_active: payload.is_active,
        interval_hours: payload.interval_hours,
        pages_to_capture: payload.pages_to_capture,
        instagram_account_id: payload.instagram_account_id || null,
        caption_template: payload.caption_template || null,
      };

      // Only schedule next post when auto-posting is enabled
      if (payload.is_active) {
        const intervalMs = (payload.interval_hours || 24) * 60 * 60 * 1000;
        upsertData.next_post_at = new Date(Date.now() + intervalMs).toISOString();
      } else {
        upsertData.next_post_at = null;
      }

      if (tokenEncrypted) {
        upsertData.ig_access_token_encrypted = tokenEncrypted;
      }

      const { error } = await (supabase as any)
        .from('marketing_bot_config')
        .upsert(upsertData, { onConflict: 'user_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-bot-config'] });
    },
  });
}

export function useTriggerMarketingBot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${supabaseUrl}/functions/v1/instagram-marketing-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ config_id: configId, manual: true }),
      });
      const result = await resp.json();
      if (!result.success && result.error) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-bot-logs'] });
      queryClient.invalidateQueries({ queryKey: ['marketing-bot-config'] });
    },
  });
}
