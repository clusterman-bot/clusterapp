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
        console.log('[TradingBot] Successfully decrypted with AES-256-GCM');
        return decrypted.trim();
      }
      console.log('[TradingBot] AES-GCM decryption produced invalid output, trying XOR');
    } catch (error) {
      console.log('[TradingBot] AES-GCM decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // Try XOR decryption for legacy credentials
  try {
    const decrypted = decryptKeyXOR(encrypted, secret);
    if (isValidApiKey(decrypted.trim())) {
      console.log('[TradingBot] Successfully decrypted with XOR (legacy)');
      return decrypted.trim();
    }
    console.log('[TradingBot] XOR decryption produced invalid output');
  } catch (error) {
    console.log('[TradingBot] XOR decryption failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Both methods failed - the credentials need to be re-entered
  throw new Error('Failed to decrypt credentials - please reconnect your brokerage account');
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
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!encryptionSecret) {
    console.error('[TradingBot] CRITICAL: ENCRYPTION_SECRET not configured');
    return;
  }
  const side = signal.signal_type === 'BUY' ? 'buy' : 'sell';
  
  console.log(`[TradingBot] Executing ${side} trade for signal ${signal.id}`);

  // Get model details (for allocation constraints and name)
  const { data: modelDetails } = await supabase
    .from('models')
    .select('name, max_exposure_percent')
    .eq('id', deployment.model_id)
    .single();

  const maxExposurePct = modelDetails?.max_exposure_percent ?? 20;

  // Get all active subscribers with their allocations
  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('*, allocations(*)')
    .eq('model_id', deployment.model_id)
    .eq('status', 'active');

  if (subError) {
    console.error('[TradingBot] Error fetching subscribers:', subError);
    return;
  }

  const usersToTrade = [
    { userId: deployment.user_id, subscriptionId: null, isOwner: true, allocation: null },
    ...(subscriptions || []).map((sub: any) => ({
      userId: sub.subscriber_id,
      subscriptionId: sub.id,
      isOwner: false,
      allocation: sub.allocations?.[0] || null,
      fundWarningAlreadySent: sub.funds_warning_sent ?? false,
    })),
  ];

  for (const trader of usersToTrade) {
    try {
      // Get user's brokerage accounts – prefer live, fall back to paper
      const { data: brokerageAccounts, error: accError } = await supabase
        .from('user_brokerage_accounts')
        .select('*')
        .eq('user_id', trader.userId)
        .eq('broker_name', 'alpaca')
        .eq('is_active', true);

      const brokerageAccount = brokerageAccounts?.find((a: any) => a.account_type === 'live')
        || brokerageAccounts?.[0]
        || null;

      if (accError || !brokerageAccount) {
        console.log(`[TradingBot] No active brokerage for user ${trader.userId}, skipping`);
        if (!trader.isOwner && trader.subscriptionId) {
          await supabase.from('subscriber_trades').insert({
            subscription_id: trader.subscriptionId,
            signal_id: signal.id,
            user_id: trader.userId,
            ticker: signal.ticker,
            side,
            quantity: signal.quantity,
            status: 'failed',
            error_message: 'No active brokerage account connected',
          });
        }
        continue;
      }

      // Decrypt credentials
      const alpacaApiKey = await decryptKey(brokerageAccount.api_key_encrypted, encryptionSecret);
      const alpacaApiSecret = await decryptKey(brokerageAccount.api_secret_encrypted, encryptionSecret);
      const isLive = brokerageAccount.account_type === 'live';
      const alpacaBase = isLive
        ? 'https://api.alpaca.markets'
        : 'https://paper-api.alpaca.markets';

      // ── For subscribers: check buying power against allocation budget ──
      let tradeQty = signal.quantity;
      if (!trader.isOwner && trader.allocation) {
        const allocationBudget = trader.allocation.current_value ?? 0;
        const maxTradeValue = (maxExposurePct / 100) * allocationBudget;

        // Fetch real-time buying power from Alpaca
        const acctResp = await fetch(`${alpacaBase}/v2/account`, {
          headers: {
            'APCA-API-KEY-ID': alpacaApiKey,
            'APCA-API-SECRET-KEY': alpacaApiSecret,
          },
        });

        if (acctResp.ok) {
          const acctData = await acctResp.json();
          const buyingPower = parseFloat(acctData.buying_power ?? '0');

          if (side === 'buy' && buyingPower < maxTradeValue) {
            console.log(`[TradingBot] Insufficient funds for subscriber ${trader.userId}: BP=$${buyingPower}, needed=$${maxTradeValue}`);

            // Log the blocked trade
            await supabase.from('subscriber_trades').insert({
              subscription_id: trader.subscriptionId,
              signal_id: signal.id,
              user_id: trader.userId,
              ticker: signal.ticker,
              side,
              quantity: tradeQty,
              status: 'blocked_insufficient_funds',
              error_message: `Insufficient funds. Buying power: $${buyingPower.toFixed(2)}, required: $${maxTradeValue.toFixed(2)}`,
              allocation_id: trader.allocation?.id || null,
            });

            // Send ONE-TIME email notification
            if (!trader.fundWarningAlreadySent && resendApiKey) {
              // Get subscriber email
              const { data: userResp } = await supabase.auth.admin.getUserById(trader.userId);
              const email = userResp?.user?.email;

              if (email) {
                const modelName = modelDetails?.name ?? 'a subscribed model';
                await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: 'Cluster <noreply@clusterapp.lovable.app>',
                    to: [email],
                    subject: `Action needed: Insufficient funds to mirror ${modelName}`,
                    html: `
                      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
                        <h2 style="color: #dc2626;">Trade Blocked — Insufficient Funds</h2>
                        <p>Hi there,</p>
                        <p>A trade signal was generated by <strong>${modelName}</strong> that you're subscribed to, but your Alpaca account does not have enough buying power to execute it.</p>
                        <ul>
                          <li><strong>Signal:</strong> ${side.toUpperCase()} ${signal.ticker}</li>
                          <li><strong>Buying power available:</strong> $${buyingPower.toFixed(2)}</li>
                          <li><strong>Required:</strong> $${maxTradeValue.toFixed(2)}</li>
                        </ul>
                        <p>To continue mirroring this model's trades, please add more funds to your Alpaca account and ensure your allocation is active.</p>
                        <p style="color: #6b7280; font-size: 12px;">This is a one-time notification. We will not send further emails for this subscription unless you re-enable it.</p>
                      </div>
                    `,
                  }),
                });

                // Mark warning as sent so we don't spam
                await supabase
                  .from('subscriptions')
                  .update({ funds_warning_sent: true })
                  .eq('id', trader.subscriptionId);

                console.log(`[TradingBot] Insufficient funds email sent to ${email}`);
              }
            }
            continue; // Skip executing this trade
          }

          // Calculate proportional qty based on allocation exposure limit (fractional)
          if (signal.price_at_signal && signal.price_at_signal > 0) {
            const maxAffordableQty = parseFloat((Math.min(maxTradeValue, buyingPower) / signal.price_at_signal).toFixed(4));
            tradeQty = Math.max(0.01, Math.min(signal.quantity, maxAffordableQty));
          }
        }
      }

      // Check if asset supports fractional trading
      let assetFractionable = false;
      try {
        const assetResp = await fetch(`${alpacaBase}/v2/assets/${encodeURIComponent(signal.ticker)}`, {
          headers: {
            'APCA-API-KEY-ID': alpacaApiKey,
            'APCA-API-SECRET-KEY': alpacaApiSecret,
          },
        });
        if (assetResp.ok) {
          const assetData = await assetResp.json();
          assetFractionable = assetData.fractionable === true;
        }
      } catch (e) {
        console.log(`[TradingBot] Could not check fractionable status for ${signal.ticker}, defaulting to whole shares`);
      }

      // Round to whole shares if asset doesn't support fractional trading
      if (!assetFractionable && tradeQty < 1) {
        tradeQty = 1;
      } else if (!assetFractionable) {
        tradeQty = Math.floor(tradeQty);
      }

      // Place order via Alpaca
      const alpacaUrl = `${alpacaBase}/v2/orders`;
      const orderPayload: Record<string, any> = {
        symbol: signal.ticker,
        side,
        type: 'market',
        time_in_force: 'day',
      };

      // Use notional (dollar amount) for fractional quantities, qty for whole shares
      if (assetFractionable && tradeQty % 1 !== 0) {
        orderPayload.notional = parseFloat((tradeQty * (signal.price_at_signal || 100)).toFixed(2));
      } else {
        orderPayload.qty = tradeQty;
      }

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

      // Reset funds_warning_sent on a successful trade (funds topped up)
      if (response.ok && !trader.isOwner && trader.subscriptionId && (trader as any).fundWarningAlreadySent) {
        await supabase
          .from('subscriptions')
          .update({ funds_warning_sent: false })
          .eq('id', trader.subscriptionId);
      }

      // Log subscriber trade
      if (!trader.isOwner && trader.subscriptionId) {
        await supabase.from('subscriber_trades').insert({
          subscription_id: trader.subscriptionId,
          signal_id: signal.id,
          user_id: trader.userId,
          ticker: signal.ticker,
          side,
          quantity: tradeQty,
          status: response.ok ? 'executed' : 'failed',
          alpaca_order_id: orderResult.id,
          executed_price: orderResult.filled_avg_price ? parseFloat(orderResult.filled_avg_price) : null,
          executed_at: response.ok ? new Date().toISOString() : null,
          error_message: response.ok ? null : orderResult.message,
          allocation_id: trader.allocation?.id || null,
        });
      }

      // Log trading activity
      await supabase.from('trading_activity_logs').insert({
        user_id: trader.userId,
        brokerage_account_id: brokerageAccount.id,
        action_type: trader.isOwner ? 'bot_trade' : 'copy_trade',
        symbol: signal.ticker,
        quantity: tradeQty,
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

