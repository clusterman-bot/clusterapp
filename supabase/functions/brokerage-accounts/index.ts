import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SECURITY: AES-256-GCM encryption for API keys
// Uses Web Crypto API for proper authenticated encryption
async function deriveKey(secret: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptKey(plaintext: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltArray = crypto.getRandomValues(new Uint8Array(16));
  const ivArray = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(secret, saltArray.buffer as ArrayBuffer);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    encoder.encode(plaintext)
  );
  
  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(saltArray.length + ivArray.length + encrypted.byteLength);
  combined.set(saltArray, 0);
  combined.set(ivArray, saltArray.length);
  combined.set(new Uint8Array(encrypted), saltArray.length + ivArray.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decryptKeyAES(encrypted: string, secret: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  const saltArray = combined.slice(0, 16);
  const ivArray = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  
  const key = await deriveKey(secret, saltArray.buffer as ArrayBuffer);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

// Legacy XOR decryption for backward compatibility
function decryptKeyXOR(encrypted: string, secret: string): string {
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret.padEnd(encryptedBytes.length, secret));
  
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ secretBytes[i % secretBytes.length];
  }
  
  return new TextDecoder().decode(decrypted);
}

// Validate decrypted value looks like an API key (printable ASCII, reasonable length)
function isValidApiKey(value: string): boolean {
  if (!value || value.length < 10) return false;
  // Check if all characters are printable ASCII (no control characters)
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

// Try AES-256-GCM first, fallback to XOR for legacy credentials
async function decryptKey(encrypted: string, secret: string): Promise<string> {
  // AES-GCM encrypted data has minimum length: 16 (salt) + 12 (iv) + 16 (tag) = 44 bytes
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  // Try AES-256-GCM first if data is long enough
  if (combined.length >= 44) {
    try {
      const decrypted = await decryptKeyAES(encrypted, secret);
      if (isValidApiKey(decrypted.trim())) {
        console.log('[Brokerage] Successfully decrypted with AES-256-GCM');
        return decrypted.trim();
      }
      console.log('[Brokerage] AES-GCM decryption produced invalid output, trying XOR');
    } catch (error) {
      console.log('[Brokerage] AES-GCM decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // Try XOR decryption for legacy credentials
  try {
    const decrypted = decryptKeyXOR(encrypted, secret);
    if (isValidApiKey(decrypted.trim())) {
      console.log('[Brokerage] Successfully decrypted with XOR (legacy)');
      return decrypted.trim();
    }
    console.log('[Brokerage] XOR decryption produced invalid output');
  } catch (error) {
    console.log('[Brokerage] XOR decryption failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Both methods failed - the credentials need to be re-entered
  throw new Error('Failed to decrypt credentials - please reconnect your brokerage account');
}

// Helper for error sanitization
function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Only return safe, generic messages for known error types
  const safeMessages: Record<string, string> = {
    'Missing required parameters': 'Missing required parameters',
    'Account ID required': 'Account ID required',
    'Account not found': 'Account not found',
    'Account not found or inactive': 'Account not found or inactive',
    'Account credentials are no longer valid': 'Account credentials are no longer valid',
    'Invalid API credentials. Please check your API key and secret.': 'Invalid API credentials. Please check your API key and secret.',
  };
  return safeMessages[message] || 'An error occurred while processing your request';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
    
    // SECURITY: Fail if encryption secret is not configured
    if (!encryptionSecret) {
      console.error('[Brokerage] CRITICAL: ENCRYPTION_SECRET not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

        // Auto-detect actual account type from Alpaca account number
        // Paper accounts always start with "PA", live accounts don't
        const detectedType = accountData.account_number?.startsWith('PA') ? 'paper' : 'live';
        const resolvedAccountType = detectedType;
        if (detectedType !== accountType) {
          console.warn(`[Brokerage] User selected '${accountType}' but Alpaca returned a '${detectedType}' account (${accountData.account_number}). Using detected type.`);
        }

        // Encrypt the API keys before storing (using AES-256-GCM)
        const encryptedApiKey = await encryptKey(apiKey, encryptionSecret);
        const encryptedApiSecret = await encryptKey(apiSecret, encryptionSecret);

        // Check if account already exists
        const { data: existing } = await supabase
          .from('user_brokerage_accounts')
          .select('id')
          .eq('user_id', user.id)
          .eq('broker_name', 'alpaca')
          .eq('account_type', resolvedAccountType)
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
              account_type: resolvedAccountType,
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
            account_type: resolvedAccountType, 
            account_number: accountData.account_number,
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            account: {
              account_number: accountData.account_number,
              status: accountData.status,
              account_type: resolvedAccountType,
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

        // Decrypt credentials (AES-256-GCM)
        const apiKey = await decryptKey(account.api_key_encrypted, encryptionSecret);
        const apiSecret = await decryptKey(account.api_secret_encrypted, encryptionSecret);

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

        // Decrypt credentials (AES-256-GCM)
        const apiKey = await decryptKey(account.api_key_encrypted, encryptionSecret);
        const apiSecret = await decryptKey(account.api_secret_encrypted, encryptionSecret);

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
    console.error('[Brokerage] Error:', error instanceof Error ? error.message : 'Unknown error');
    // SECURITY: Sanitize error messages to prevent information leakage
    return new Response(
      JSON.stringify({ success: false, error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
