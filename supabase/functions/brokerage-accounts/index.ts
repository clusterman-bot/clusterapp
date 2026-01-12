import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple XOR-based encryption for API keys (in production, use proper encryption)
function encryptKey(key: string, secret: string): string {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const secretBytes = encoder.encode(secret.padEnd(key.length, secret));
  
  const encrypted = new Uint8Array(keyBytes.length);
  for (let i = 0; i < keyBytes.length; i++) {
    encrypted[i] = keyBytes[i] ^ secretBytes[i % secretBytes.length];
  }
  
  return btoa(String.fromCharCode(...encrypted));
}

function decryptKey(encrypted: string, secret: string): string {
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret.padEnd(encryptedBytes.length, secret));
  
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ secretBytes[i % secretBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET') || 'default-secret-change-in-production';

    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action } = body;

    console.log(`[Brokerage] Action: ${action}, User: ${user.id}`);

    switch (action) {
      case 'connect': {
        const { apiKey, apiSecret, accountType, dailyLimit, perTradeLimit } = body;

        if (!apiKey || !apiSecret || !accountType) {
          throw new Error('Missing required parameters');
        }

        // Determine the correct Alpaca URL based on account type
        const alpacaBaseUrl = accountType === 'paper' 
          ? 'https://paper-api.alpaca.markets' 
          : 'https://api.alpaca.markets';

        // Verify credentials by calling Alpaca API
        console.log(`[Brokerage] Verifying Alpaca credentials for ${accountType} account...`);
        
        const verifyResponse = await fetch(`${alpacaBaseUrl}/v2/account`, {
          headers: {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY': apiSecret,
          },
        });

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json();
          console.error('[Brokerage] Alpaca verification failed:', errorData);
          throw new Error('Invalid API credentials. Please check your API key and secret.');
        }

        const accountData = await verifyResponse.json();
        console.log('[Brokerage] Account verified:', accountData.account_number);

        // Encrypt the API keys before storing
        const encryptedApiKey = encryptKey(apiKey, encryptionSecret);
        const encryptedApiSecret = encryptKey(apiSecret, encryptionSecret);

        // Check if account already exists
        const { data: existing } = await supabase
          .from('user_brokerage_accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('broker_name', 'alpaca')
          .eq('account_type', accountType)
          .single();

        if (existing) {
          // Update existing account
          const { error: updateError } = await supabase
            .from('user_brokerage_accounts')
            .update({
              api_key_encrypted: encryptedApiKey,
              api_secret_encrypted: encryptedApiSecret,
              account_id: accountData.account_number,
              account_status: accountData.status,
              is_active: true,
              daily_trade_limit: dailyLimit,
              per_trade_limit: perTradeLimit,
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;
        } else {
          // Insert new account
          const { error: insertError } = await supabase
            .from('user_brokerage_accounts')
            .insert({
              user_id: user.id,
              broker_name: 'alpaca',
              account_type: accountType,
              api_key_encrypted: encryptedApiKey,
              api_secret_encrypted: encryptedApiSecret,
              account_id: accountData.account_number,
              account_status: accountData.status,
              is_active: true,
              daily_trade_limit: dailyLimit,
              per_trade_limit: perTradeLimit,
              last_verified_at: new Date().toISOString(),
            });

          if (insertError) throw insertError;
        }

        // Log the activity
        await supabase.from('trading_activity_logs').insert({
          user_id: user.id,
          action_type: 'account_connected',
          metadata: { 
            account_type: accountType, 
            account_number: accountData.account_number,
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            account: {
              account_number: accountData.account_number,
              status: accountData.status,
              account_type: accountType,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        const { accountId } = body;

        if (!accountId) {
          throw new Error('Account ID required');
        }

        // Verify ownership
        const { data: account } = await supabase
          .from('user_brokerage_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (!account) {
          throw new Error('Account not found');
        }

        // Delete the account
        const { error: deleteError } = await supabase
          .from('user_brokerage_accounts')
          .delete()
          .eq('id', accountId);

        if (deleteError) throw deleteError;

        // Log the activity
        await supabase.from('trading_activity_logs').insert({
          user_id: user.id,
          action_type: 'account_disconnected',
          metadata: { account_id: accountId },
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update-limits': {
        const { accountId, dailyLimit, perTradeLimit } = body;

        if (!accountId) {
          throw new Error('Account ID required');
        }

        const { error: updateError } = await supabase
          .from('user_brokerage_accounts')
          .update({
            daily_trade_limit: dailyLimit,
            per_trade_limit: perTradeLimit,
            updated_at: new Date().toISOString(),
          })
          .eq('id', accountId)
          .eq('user_id', user.id);

        if (updateError) throw updateError;

        // Log the activity
        await supabase.from('trading_activity_logs').insert({
          user_id: user.id,
          brokerage_account_id: accountId,
          action_type: 'limits_updated',
          metadata: { daily_limit: dailyLimit, per_trade_limit: perTradeLimit },
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify': {
        const { accountId } = body;

        if (!accountId) {
          throw new Error('Account ID required');
        }

        // Get the account
        const { data: account, error: fetchError } = await supabase
          .from('user_brokerage_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (fetchError || !account) {
          throw new Error('Account not found');
        }

        // Decrypt credentials
        const apiKey = decryptKey(account.api_key_encrypted, encryptionSecret);
        const apiSecret = decryptKey(account.api_secret_encrypted, encryptionSecret);

        // Verify with Alpaca
        const alpacaBaseUrl = account.account_type === 'paper' 
          ? 'https://paper-api.alpaca.markets' 
          : 'https://api.alpaca.markets';

        const verifyResponse = await fetch(`${alpacaBaseUrl}/v2/account`, {
          headers: {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY': apiSecret,
          },
        });

        if (!verifyResponse.ok) {
          // Mark as inactive
          await supabase
            .from('user_brokerage_accounts')
            .update({ 
              is_active: false, 
              account_status: 'invalid_credentials',
              updated_at: new Date().toISOString(),
            })
            .eq('id', accountId);

          throw new Error('Account credentials are no longer valid');
        }

        const accountData = await verifyResponse.json();

        // Update account status
        await supabase
          .from('user_brokerage_accounts')
          .update({
            account_status: accountData.status,
            last_verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', accountId);

        return new Response(
          JSON.stringify({ 
            success: true, 
            account: {
              status: accountData.status,
              equity: parseFloat(accountData.equity),
              buying_power: parseFloat(accountData.buying_power),
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-credentials': {
        // This is used internally by the trading edge function
        const { accountId } = body;

        if (!accountId) {
          throw new Error('Account ID required');
        }

        const { data: account, error: fetchError } = await supabase
          .from('user_brokerage_accounts')
          .select('*')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (fetchError || !account) {
          throw new Error('Account not found or inactive');
        }

        // Decrypt credentials
        const apiKey = decryptKey(account.api_key_encrypted, encryptionSecret);
        const apiSecret = decryptKey(account.api_secret_encrypted, encryptionSecret);

        return new Response(
          JSON.stringify({ 
            success: true, 
            credentials: {
              apiKey,
              apiSecret,
              accountType: account.account_type,
              dailyLimit: account.daily_trade_limit,
              perTradeLimit: account.per_trade_limit,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Brokerage] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
