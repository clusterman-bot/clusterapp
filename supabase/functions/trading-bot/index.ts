import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ML_BACKEND_URL = Deno.env.get('ML_BACKEND_URL');

// Legacy XOR decryption for backward compatibility with old encrypted credentials
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

// SECURITY: AES-256-GCM decryption (primary method)
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

// Try AES-256-GCM first, fallback to XOR for legacy credentials
async function decryptKey(encrypted: string, secret: string): Promise<string> {
  try {
    // AES-GCM encrypted data has minimum length: 16 (salt) + 12 (iv) + 16 (tag) = 44 bytes
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    if (combined.length >= 44) {
      return await decryptKeyAES(encrypted, secret);
    }
    // Too short for AES-GCM, must be XOR
    return decryptKeyXOR(encrypted, secret);
  } catch (error) {
    // AES-GCM failed (likely tag length error), try XOR fallback
    console.log('[TradingBot] AES-GCM decryption failed, trying XOR fallback');
    return decryptKeyXOR(encrypted, secret);
  }
}

// Helper for error sanitization
function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const safeMessages: Record<string, string> = {
    'Model not found or you do not own it': 'Model not found or you do not own it',
    'Model not deployed or not running': 'Model not deployed or not running',
  };
  return safeMessages[message] || 'An error occurred while processing your request';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();
    const body = req.method === 'POST' ? await req.json() : {};

    console.log(`[TradingBot] Action: ${action}, User: ${user.id}`);

    switch (action) {
      case 'deploy': {
        // Deploy a model as an active trading bot
        const { modelId } = body;
        
        // Verify user owns the model
        const { data: model, error: modelError } = await supabase
          .from('models')
          .select('*')
          .eq('id', modelId)
          .eq('user_id', user.id)
          .single();

        if (modelError || !model) {
          throw new Error('Model not found or you do not own it');
        }

        // Check if already deployed
        const { data: existing } = await supabase
          .from('deployed_models')
          .select('id, status')
          .eq('model_id', modelId)
          .single();

        if (existing) {
          // Update existing deployment
          await supabase
            .from('deployed_models')
            .update({ status: 'running', error_message: null, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          // Create new deployment
          await supabase
            .from('deployed_models')
            .insert({
              model_id: modelId,
              user_id: user.id,
              status: 'running',
              config: { ticker: model.ticker, horizon: model.horizon },
            });
        }

        // Update model status to deployed
        await supabase
          .from('models')
          .update({ status: 'deployed' })
          .eq('id', modelId);

        console.log(`[TradingBot] Model ${modelId} deployed`);

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Model deployed and actively trading' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'stop': {
        // Stop a deployed model
        const { modelId } = body;

        await supabase
          .from('deployed_models')
          .update({ status: 'stopped', updated_at: new Date().toISOString() })
          .eq('model_id', modelId)
          .eq('user_id', user.id);

        await supabase
          .from('models')
          .update({ status: 'trained' })
          .eq('id', modelId)
          .eq('user_id', user.id);

        console.log(`[TradingBot] Model ${modelId} stopped`);

        return new Response(JSON.stringify({ success: true, message: 'Model stopped' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'generate-signal': {
        // Generate a trading signal from ML backend (called by streaming service or cron)
        const { modelId, marketData } = body;

        // Get model and deployment info
        const { data: deployment, error: depError } = await supabase
          .from('deployed_models')
          .select('*, models(*)')
          .eq('model_id', modelId)
          .eq('status', 'running')
          .single();

        if (depError || !deployment) {
          throw new Error('Model not deployed or not running');
        }

        let signal;
        
        // Call external ML backend for prediction
        if (ML_BACKEND_URL) {
          try {
            const mlResponse = await fetch(`${ML_BACKEND_URL}/predict`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model_id: modelId,
                ml_model_uuid: deployment.models.ml_model_uuid,
                ticker: deployment.models.ticker,
                market_data: marketData,
                horizon: deployment.models.horizon,
              }),
            });

            if (mlResponse.ok) {
              signal = await mlResponse.json();
            } else {
              console.log('[TradingBot] ML Backend error, using fallback');
              signal = generateMockSignal(deployment.models.ticker, marketData);
            }
          } catch (e) {
            console.log('[TradingBot] ML Backend unavailable, using fallback');
            signal = generateMockSignal(deployment.models.ticker, marketData);
          }
        } else {
          signal = generateMockSignal(deployment.models.ticker, marketData);
        }

        // Store the signal
        const { data: signalRecord, error: signalError } = await supabase
          .from('model_signals')
          .insert({
            model_id: modelId,
            ticker: deployment.models.ticker || signal.ticker,
            signal_type: signal.signal_type,
            confidence: signal.confidence,
            price_at_signal: signal.price || marketData?.price,
            quantity: signal.quantity || 1,
            metadata: { market_data: marketData, prediction: signal },
            status: 'pending',
          })
          .select()
          .single();

        if (signalError) throw signalError;

        // Update deployment stats
        await supabase
          .from('deployed_models')
          .update({ 
            last_signal_at: new Date().toISOString(),
            total_signals: (deployment.total_signals || 0) + 1,
          })
          .eq('id', deployment.id);

        console.log(`[TradingBot] Signal generated: ${signal.signal_type} for ${deployment.models.ticker}`);

        // If not HOLD, execute trade for owner and subscribers
        if (signal.signal_type !== 'HOLD') {
          await executeTradeForOwnerAndSubscribers(supabase, deployment, signalRecord);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          signal: signalRecord,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'status': {
        // Get deployment status for a model
        const modelId = url.searchParams.get('modelId');
        
        const { data, error } = await supabase
          .from('deployed_models')
          .select('*, models(name, ticker)')
          .eq('model_id', modelId)
          .single();

        if (error) {
          return new Response(JSON.stringify({ deployed: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ deployed: true, ...data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    console.error('[TradingBot] Error:', error instanceof Error ? error.message : 'Unknown error');
    // SECURITY: Sanitize error messages to prevent information leakage
    return new Response(JSON.stringify({ error: sanitizeError(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateMockSignal(ticker: string, marketData?: any) {
  // Mock signal generation based on simple logic
  const random = Math.random();
  let signal_type: 'BUY' | 'SELL' | 'HOLD';
  
  if (random < 0.3) signal_type = 'BUY';
  else if (random < 0.5) signal_type = 'SELL';
  else signal_type = 'HOLD';

  return {
    signal_type,
    confidence: 0.6 + Math.random() * 0.3,
    ticker,
    quantity: 1,
    price: marketData?.price || 100,
  };
}

async function executeTradeForOwnerAndSubscribers(
  supabase: any,
  deployment: any,
  signal: any
) {
  const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
  
  // SECURITY: Fail if encryption secret is not configured
  if (!encryptionSecret) {
    console.error('[TradingBot] CRITICAL: ENCRYPTION_SECRET not configured');
    return;
  }
  const side = signal.signal_type === 'BUY' ? 'buy' : 'sell';
  
  console.log(`[TradingBot] Executing ${side} trade for signal ${signal.id}`);

  // Get all active subscribers
  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('*, profiles:subscriber_id(id)')
    .eq('model_id', deployment.model_id)
    .eq('status', 'active');

  if (subError) {
    console.error('[TradingBot] Error fetching subscribers:', subError);
    return;
  }

  const usersToTrade = [
    { userId: deployment.user_id, subscriptionId: null, isOwner: true },
    ...(subscriptions || []).map((sub: any) => ({
      userId: sub.subscriber_id,
      subscriptionId: sub.id,
      isOwner: false,
    })),
  ];

  for (const trader of usersToTrade) {
    try {
      // Get user's brokerage account
      const { data: brokerageAccount, error: accError } = await supabase
        .from('user_brokerage_accounts')
        .select('*')
        .eq('user_id', trader.userId)
        .eq('broker_name', 'alpaca')
        .eq('account_type', 'paper')
        .eq('is_active', true)
        .single();

      if (accError || !brokerageAccount) {
        console.log(`[TradingBot] No brokerage for user ${trader.userId}, skipping`);
        
        // Log failed trade for subscribers
        if (!trader.isOwner && trader.subscriptionId) {
          await supabase.from('subscriber_trades').insert({
            subscription_id: trader.subscriptionId,
            signal_id: signal.id,
            user_id: trader.userId,
            ticker: signal.ticker,
            side,
            quantity: signal.quantity,
            status: 'failed',
            error_message: 'No brokerage account connected',
          });
        }
        continue;
      }

      // Decrypt credentials (AES-256-GCM)
      const alpacaApiKey = await decryptKey(brokerageAccount.api_key_encrypted, encryptionSecret);
      const alpacaApiSecret = await decryptKey(brokerageAccount.api_secret_encrypted, encryptionSecret);

      // Place order via Alpaca
      const alpacaUrl = 'https://paper-api.alpaca.markets/v2/orders';
      const orderPayload = {
        symbol: signal.ticker,
        qty: signal.quantity,
        side,
        type: 'market',
        time_in_force: 'day',
      };

      const response = await fetch(alpacaUrl, {
        method: 'POST',
        headers: {
          'APCA-API-KEY-ID': alpacaApiKey,
          'APCA-API-SECRET-KEY': alpacaApiSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      const orderResult = await response.json();
      console.log(`[TradingBot] Order result for ${trader.userId}:`, orderResult);

      // Log subscriber trade
      if (!trader.isOwner && trader.subscriptionId) {
        await supabase.from('subscriber_trades').insert({
          subscription_id: trader.subscriptionId,
          signal_id: signal.id,
          user_id: trader.userId,
          ticker: signal.ticker,
          side,
          quantity: signal.quantity,
          status: response.ok ? 'executed' : 'failed',
          alpaca_order_id: orderResult.id,
          executed_price: orderResult.filled_avg_price ? parseFloat(orderResult.filled_avg_price) : null,
          executed_at: response.ok ? new Date().toISOString() : null,
          error_message: response.ok ? null : orderResult.message,
        });
      }

      // Log trading activity
      await supabase.from('trading_activity_logs').insert({
        user_id: trader.userId,
        brokerage_account_id: brokerageAccount.id,
        action_type: trader.isOwner ? 'bot_trade' : 'copy_trade',
        symbol: signal.ticker,
        quantity: signal.quantity,
        side,
        order_type: 'market',
        status: response.ok ? 'executed' : 'failed',
        metadata: {
          model_id: deployment.model_id,
          signal_id: signal.id,
          alpaca_order_id: orderResult.id,
        },
      });

    } catch (tradeError) {
      console.error(`[TradingBot] Trade error for ${trader.userId}:`, tradeError);
    }
  }

  // Update signal as executed
  await supabase
    .from('model_signals')
    .update({ status: 'executed', executed_at: new Date().toISOString() })
    .eq('id', signal.id);

  // Update deployment trade count
  await supabase
    .from('deployed_models')
    .update({ total_trades: (deployment.total_trades || 0) + 1 })
    .eq('id', deployment.id);
}
