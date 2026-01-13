import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlpacaOrder {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok';
  limit_price?: number;
  stop_price?: number;
}

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
    console.log('[Alpaca] AES-GCM decryption failed, trying XOR fallback');
    return decryptKeyXOR(encrypted, secret);
  }
}

// Helper for error sanitization
function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const safeMessages: Record<string, string> = {
    'Missing required order parameters': 'Missing required order parameters',
    'Symbol is required': 'Symbol is required',
    'Missing order ID': 'Missing order ID',
  };
  return safeMessages[message] || 'An error occurred while processing your request';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
    
    // SECURITY: Fail if encryption secret is not configured
    if (!encryptionSecret) {
      console.error('[Alpaca] CRITICAL: ENCRYPTION_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'unauthorized.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth header for proper JWT validation
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.error('[Alpaca] Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'unauthorized.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    
    // Create service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    // Determine paper/live mode from request body
    const body = req.method === 'POST' ? await req.json() : {};
    const isPaper = body.isPaper !== false; // Default to paper trading
    const accountType = isPaper ? 'paper' : 'live';

    console.log(`[Alpaca] Action: ${action}, Mode: ${accountType}, User: ${userId}`);

    // Fetch user's active brokerage account for this mode
    const { data: brokerageAccount, error: accountError } = await supabaseAdmin
      .from('user_brokerage_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('broker_name', 'alpaca')
      .eq('account_type', accountType)
      .eq('is_active', true)
      .single();

    if (accountError || !brokerageAccount) {
      console.log(`[Alpaca] No ${accountType} brokerage account found for user ${userId}`);
      // Return 200 with needsConnection flag so frontend can handle gracefully
      return new Response(
        JSON.stringify({ 
          success: false,
          needsConnection: true,
          message: `No ${accountType} brokerage account connected. Please connect your Alpaca account first.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt the user's credentials (AES-256-GCM)
    const alpacaApiKey = await decryptKey(brokerageAccount.api_key_encrypted, encryptionSecret);
    const alpacaApiSecret = await decryptKey(brokerageAccount.api_secret_encrypted, encryptionSecret);

    const alpacaBaseUrl = isPaper 
      ? 'https://paper-api.alpaca.markets' 
      : 'https://api.alpaca.markets';

    console.log(`[Alpaca] Using user's ${accountType} account: ${brokerageAccount.account_id}`);

    const alpacaHeaders = {
      'APCA-API-KEY-ID': alpacaApiKey,
      'APCA-API-SECRET-KEY': alpacaApiSecret,
      'Content-Type': 'application/json',
    };

    // Handle different actions
    switch (action) {
      case 'account': {
        // Get Alpaca account info
        const response = await fetch(`${alpacaBaseUrl}/v2/account`, {
          headers: alpacaHeaders,
        });
        const data = await response.json();
        console.log('[Alpaca] Account response status:', response.status);
        
        if (!response.ok) {
          console.error('[Alpaca] Account error:', data);
          throw new Error(data.message || 'Failed to fetch account');
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            account: {
              id: data.id,
              account_number: data.account_number,
              status: data.status,
              cash: parseFloat(data.cash),
              buying_power: parseFloat(data.buying_power),
              portfolio_value: parseFloat(data.portfolio_value),
              equity: parseFloat(data.equity),
              pattern_day_trader: data.pattern_day_trader,
              trading_blocked: data.trading_blocked,
              transfers_blocked: data.transfers_blocked,
              account_blocked: data.account_blocked,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'positions': {
        // Get all positions
        const response = await fetch(`${alpacaBaseUrl}/v2/positions`, {
          headers: alpacaHeaders,
        });
        const data = await response.json();
        console.log('[Alpaca] Positions response status:', response.status);

        if (!response.ok) {
          console.error('[Alpaca] Positions error:', data);
          throw new Error(data.message || 'Failed to fetch positions');
        }

        return new Response(
          JSON.stringify({ success: true, positions: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'search-assets': {
        // Search for tradeable assets
        const query = body.query?.toUpperCase() || '';
        const limit = body.limit || 20;
        
        console.log(`[Alpaca] Searching assets: "${query}"`);
        
        // Fetch all active, tradeable US equities
        const response = await fetch(
          `https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity`,
          { headers: alpacaHeaders }
        );
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch assets');
        }
        
        const allAssets = await response.json();
        
        // Filter by search query (symbol or name)
        let filtered = allAssets.filter((asset: any) => 
          asset.tradable && 
          (asset.symbol.includes(query) || asset.name?.toUpperCase().includes(query))
        );
        
        // Sort: exact symbol matches first, then by symbol length
        filtered.sort((a: any, b: any) => {
          if (a.symbol === query) return -1;
          if (b.symbol === query) return 1;
          if (a.symbol.startsWith(query) && !b.symbol.startsWith(query)) return -1;
          if (b.symbol.startsWith(query) && !a.symbol.startsWith(query)) return 1;
          return a.symbol.length - b.symbol.length;
        });
        
        // Limit results
        const results = filtered.slice(0, limit);
        
        console.log(`[Alpaca] Found ${results.length} assets for query "${query}"`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            assets: results.map((a: any) => ({
              symbol: a.symbol,
              name: a.name,
              exchange: a.exchange,
              asset_class: a.class,
              tradable: a.tradable,
              fractionable: a.fractionable,
            }))
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-quote': {
        // Get real-time quote for a symbol
        const symbol = body.symbol?.toUpperCase();
        
        if (!symbol) {
          throw new Error('Symbol is required');
        }
        
        console.log(`[Alpaca] Getting quote for: ${symbol}`);
        
        // Use the data API for quotes
        const response = await fetch(
          `https://data.alpaca.markets/v2/stocks/${symbol}/quotes/latest`,
          { 
            headers: {
              'APCA-API-KEY-ID': alpacaApiKey,
              'APCA-API-SECRET-KEY': alpacaApiSecret,
            }
          }
        );
        
        if (!response.ok) {
          // Try to get last trade instead
          const tradeResponse = await fetch(
            `https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`,
            { 
              headers: {
                'APCA-API-KEY-ID': alpacaApiKey,
                'APCA-API-SECRET-KEY': alpacaApiSecret,
              }
            }
          );
          
          if (!tradeResponse.ok) {
            throw new Error(`Failed to get quote for ${symbol}`);
          }
          
          const tradeData = await tradeResponse.json();
          return new Response(
            JSON.stringify({ 
              success: true, 
              quote: {
                symbol,
                price: tradeData.trade?.p || 0,
                timestamp: tradeData.trade?.t,
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const quoteData = await response.json();
        const midPrice = quoteData.quote 
          ? (quoteData.quote.ap + quoteData.quote.bp) / 2 
          : 0;
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            quote: {
              symbol,
              bid: quoteData.quote?.bp,
              ask: quoteData.quote?.ap,
              price: midPrice,
              timestamp: quoteData.quote?.t,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'portfolio-history': {
        // Get portfolio history for charting
        const period = body.period || '1M'; // 1D, 1W, 1M, 3M, 1A
        const timeframe = body.timeframe || '1D'; // 1Min, 5Min, 15Min, 1H, 1D
        
        console.log(`[Alpaca] Getting portfolio history: period=${period}, timeframe=${timeframe}`);
        
        const response = await fetch(
          `${alpacaBaseUrl}/v2/account/portfolio/history?period=${period}&timeframe=${timeframe}`,
          { headers: alpacaHeaders }
        );
        const data = await response.json();
        
        if (!response.ok) {
          console.error('[Alpaca] Portfolio history error:', data);
          throw new Error(data.message || 'Failed to fetch portfolio history');
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            history: {
              timestamp: data.timestamp,
              equity: data.equity,
              profit_loss: data.profit_loss,
              profit_loss_pct: data.profit_loss_pct,
              base_value: data.base_value,
              timeframe: data.timeframe,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'orders': {
        // Get orders - support both GET params and POST body
        const status = body.status || 'all';
        const limit = body.limit || 50;
        
        const response = await fetch(
          `${alpacaBaseUrl}/v2/orders?status=${status}&limit=${limit}&direction=desc`, 
          { headers: alpacaHeaders }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch orders');
        }

        return new Response(
          JSON.stringify({ success: true, orders: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'place-order': {
        // Place a new order
        const { symbol, quantity, side, orderType, limitPrice, stopPrice } = body;

        if (!symbol || !quantity || !side || !orderType) {
          throw new Error('Missing required order parameters');
        }

        const orderPayload: AlpacaOrder = {
          symbol: symbol.toUpperCase(),
          qty: quantity,
          side: side,
          type: orderType === 'stop_loss' ? 'stop' : orderType,
          time_in_force: 'day',
        };

        if (orderType === 'limit' && limitPrice) {
          orderPayload.limit_price = limitPrice;
        }
        if ((orderType === 'stop' || orderType === 'stop_loss') && stopPrice) {
          orderPayload.stop_price = stopPrice;
        }

        console.log('[Alpaca] Placing order:', JSON.stringify(orderPayload));

        const response = await fetch(`${alpacaBaseUrl}/v2/orders`, {
          method: 'POST',
          headers: alpacaHeaders,
          body: JSON.stringify(orderPayload),
        });
        const data = await response.json();

        console.log('[Alpaca] Order response:', JSON.stringify(data));

        if (!response.ok) {
          throw new Error(data.message || 'Failed to place order');
        }

        // Log the order in our database
        await supabaseAdmin.from('orders').insert({
          user_id: userId,
          stock_id: body.stockId,
          order_type: orderType,
          order_side: side,
          quantity: quantity,
          price: data.filled_avg_price ? parseFloat(data.filled_avg_price) : null,
          executed_price: data.filled_avg_price ? parseFloat(data.filled_avg_price) : null,
          limit_price: limitPrice || null,
          stop_price: stopPrice || null,
          status: data.status === 'filled' ? 'executed' : 'pending',
          executed_at: data.filled_at || null,
        });

        // Log trading activity
        await supabaseAdmin.from('trading_activity_logs').insert({
          user_id: userId,
          brokerage_account_id: brokerageAccount.id,
          action_type: 'order_placed',
          symbol: symbol.toUpperCase(),
          quantity: quantity,
          side: side,
          order_type: orderType,
          status: data.status,
          amount: data.filled_avg_price ? parseFloat(data.filled_avg_price) * quantity : null,
          metadata: { 
            alpaca_order_id: data.id,
            client_order_id: data.client_order_id,
          },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            order: {
              id: data.id,
              client_order_id: data.client_order_id,
              symbol: data.symbol,
              qty: data.qty,
              side: data.side,
              type: data.type,
              status: data.status,
              filled_qty: data.filled_qty,
              filled_avg_price: data.filled_avg_price,
              created_at: data.created_at,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel-order': {
        // Cancel an order
        const { alpacaOrderId } = body;

        if (!alpacaOrderId) {
          throw new Error('Missing order ID');
        }

        const response = await fetch(`${alpacaBaseUrl}/v2/orders/${alpacaOrderId}`, {
          method: 'DELETE',
          headers: alpacaHeaders,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to cancel order');
        }

        console.log('[Alpaca] Order cancelled:', alpacaOrderId);

        // Log trading activity
        await supabaseAdmin.from('trading_activity_logs').insert({
          user_id: userId,
          brokerage_account_id: brokerageAccount.id,
          action_type: 'order_cancelled',
          metadata: { alpaca_order_id: alpacaOrderId },
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Order cancelled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Alpaca] Error:', error instanceof Error ? error.message : 'Unknown error');
    // SECURITY: Sanitize error messages to prevent information leakage
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
