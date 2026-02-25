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
        console.log('[Alpaca] Successfully decrypted with AES-256-GCM');
        return decrypted.trim();
      }
      console.log('[Alpaca] AES-GCM decryption produced invalid output, trying XOR');
    } catch (error) {
      console.log('[Alpaca] AES-GCM decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  // Try XOR decryption for legacy credentials
  try {
    const decrypted = decryptKeyXOR(encrypted, secret);
    if (isValidApiKey(decrypted.trim())) {
      console.log('[Alpaca] Successfully decrypted with XOR (legacy)');
      return decrypted.trim();
    }
    console.log('[Alpaca] XOR decryption produced invalid output');
  } catch (error) {
    console.log('[Alpaca] XOR decryption failed:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Both methods failed - the credentials need to be re-entered
  console.error('[Alpaca] Both decryption methods failed - credentials may need to be re-entered');
  throw new Error('CREDENTIALS_INVALID');
}

// Helper for error sanitization
function sanitizeError(error: unknown): { message: string; code?: string } {
  const message = error instanceof Error ? error.message : 'Unknown error';
  
  // Specific error codes that frontend should handle
  if (message === 'CREDENTIALS_INVALID') {
    return { message: 'Your brokerage credentials need to be updated. Please reconnect your account.', code: 'CREDENTIALS_INVALID' };
  }
  
  const safeMessages: Record<string, string> = {
    'Missing required order parameters': 'Missing required order parameters',
    'Symbol is required': 'Symbol is required',
    'Missing order ID': 'Missing order ID',
  };
  return { message: safeMessages[message] || 'An error occurred while processing your request' };
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
    const pathAction = url.pathname.split('/').pop();

    // Determine paper/live mode from request body
    const body = req.method === 'POST' ? await req.json() : {};

    // Support action from URL path OR body.action (fallback for invoke without sub-path)
    const action = (pathAction === 'alpaca-trading' && body.action) ? body.action : pathAction;

    const isPaper = body.isPaper !== false; // Default to paper trading
    const accountType = isPaper ? 'paper' : 'live';
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
        const bp = quoteData.quote?.bp || 0;
        const ap = quoteData.quote?.ap || 0;

        // Only use midpoint when BOTH bid and ask are valid non-zero values.
        // If ask is 0 (after-hours / illiquid), use bid alone.
        // Fall back to last trade price via a secondary call if neither is valid.
        let price = 0;
        if (bp > 0 && ap > 0) {
          price = (bp + ap) / 2;
        } else if (bp > 0) {
          price = bp;
        } else if (ap > 0) {
          price = ap;
        }

        // If we still have no price, fetch the latest trade as fallback
        if (price === 0) {
          const tradeResp = await fetch(
            `https://data.alpaca.markets/v2/stocks/${symbol}/trades/latest`,
            { headers: { 'APCA-API-KEY-ID': alpacaApiKey, 'APCA-API-SECRET-KEY': alpacaApiSecret } }
          );
          if (tradeResp.ok) {
            const tradeData = await tradeResp.json();
            price = tradeData.trade?.p || 0;
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            quote: {
              symbol,
              bid: bp,
              ask: ap,
              price,
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
        let data = await response.json();

        console.log('[Alpaca] Order response:', JSON.stringify(data));

        if (!response.ok) {
          throw new Error(data.message || 'Failed to place order');
        }

        // For market orders, poll for fill status (up to 5 seconds)
        if (orderType === 'market' && data.status !== 'filled') {
          const alpacaOrderId = data.id;
          for (let attempt = 0; attempt < 5; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const pollRes = await fetch(`${alpacaBaseUrl}/v2/orders/${alpacaOrderId}`, {
              headers: alpacaHeaders,
            });
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              console.log(`[Alpaca] Poll attempt ${attempt + 1}:`, pollData.status);
              if (pollData.status === 'filled' || pollData.status === 'partially_filled') {
                data = pollData;
                break;
              }
              if (pollData.status === 'canceled' || pollData.status === 'expired' || pollData.status === 'rejected') {
                data = pollData;
                break;
              }
            }
          }
        }

        const isFilled = data.status === 'filled' || data.status === 'partially_filled';
        const filledPrice = data.filled_avg_price ? parseFloat(data.filled_avg_price) : null;

        // Log the order in our database
        await supabaseAdmin.from('orders').insert({
          user_id: userId,
          stock_id: body.stockId,
          order_type: orderType,
          order_side: side,
          quantity: quantity,
          price: filledPrice,
          executed_price: filledPrice,
          limit_price: limitPrice || null,
          stop_price: stopPrice || null,
          status: isFilled ? 'executed' : (data.status === 'canceled' || data.status === 'rejected' || data.status === 'expired') ? 'cancelled' : 'pending',
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

      case 'get-bars': {
        // Get historical bars for charting (stocks)
        const symbol = body.symbol?.toUpperCase();
        const barTimeframe = body.timeframe || '1Day';
        const start = body.start;
        const end = body.end;
        const limit = body.limit || 1000;

        if (!symbol) throw new Error('Symbol is required');

        console.log(`[Alpaca] Getting bars for: ${symbol}, timeframe=${barTimeframe}, start=${start}`);

        const params = new URLSearchParams({
          timeframe: barTimeframe,
          limit: String(limit),
          adjustment: 'raw',
          feed: 'iex',
          sort: 'asc',
        });
        if (start) params.set('start', start);
        if (end) params.set('end', end);

        const response = await fetch(
          `https://data.alpaca.markets/v2/stocks/${symbol}/bars?${params}`,
          {
            headers: {
              'APCA-API-KEY-ID': alpacaApiKey,
              'APCA-API-SECRET-KEY': alpacaApiSecret,
            },
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          console.error('[Alpaca] Bars error:', errData);
          throw new Error(errData.message || 'Failed to fetch bars');
        }

        const barsData = await response.json();
        const bars = (barsData.bars || []).map((b: any) => ({
          timestamp: new Date(b.t).getTime(),
          date: b.t,
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v,
        }));

        console.log(`[Alpaca] Returned ${bars.length} bars for ${symbol}`);

        return new Response(
          JSON.stringify({ success: true, bars }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-crypto-quote': {
        // Get real-time crypto quote
        const symbol = body.symbol?.toUpperCase();
        if (!symbol) throw new Error('Symbol is required');

        console.log(`[Alpaca] Getting crypto quote for: ${symbol}`);

        const response = await fetch(
          `https://data.alpaca.markets/v1beta3/crypto/us/latest/quotes?symbols=${encodeURIComponent(symbol)}`,
          {
            headers: {
              'APCA-API-KEY-ID': alpacaApiKey,
              'APCA-API-SECRET-KEY': alpacaApiSecret,
            },
          }
        );

        if (!response.ok) {
          // Fallback to latest trade
          const tradeResp = await fetch(
            `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(symbol)}`,
            {
              headers: {
                'APCA-API-KEY-ID': alpacaApiKey,
                'APCA-API-SECRET-KEY': alpacaApiSecret,
              },
            }
          );

          if (!tradeResp.ok) throw new Error(`Failed to get crypto quote for ${symbol}`);
          const tradeData = await tradeResp.json();
          const trade = tradeData.trades?.[symbol];

          return new Response(
            JSON.stringify({
              success: true,
              quote: { symbol, price: trade?.p || 0, timestamp: trade?.t },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const quoteData = await response.json();
        const quote = quoteData.quotes?.[symbol];
        const bp = quote?.bp || 0;
        const ap = quote?.ap || 0;
        let price = 0;
        if (bp > 0 && ap > 0) price = (bp + ap) / 2;
        else if (bp > 0) price = bp;
        else if (ap > 0) price = ap;

        if (price === 0) {
          const tradeResp = await fetch(
            `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(symbol)}`,
            {
              headers: {
                'APCA-API-KEY-ID': alpacaApiKey,
                'APCA-API-SECRET-KEY': alpacaApiSecret,
              },
            }
          );
          if (tradeResp.ok) {
            const tradeData = await tradeResp.json();
            price = tradeData.trades?.[symbol]?.p || 0;
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            quote: { symbol, bid: bp, ask: ap, price, timestamp: quote?.t },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-crypto-bars': {
        // Get historical crypto bars for charting
        const symbol = body.symbol?.toUpperCase();
        const barTimeframe = body.timeframe || '1Day';
        const start = body.start;
        const end = body.end;
        const limit = body.limit || 1000;

        if (!symbol) throw new Error('Symbol is required');

        console.log(`[Alpaca] Getting crypto bars for: ${symbol}, timeframe=${barTimeframe}`);

        const params = new URLSearchParams({
          symbols: symbol,
          timeframe: barTimeframe,
          limit: String(limit),
          sort: 'asc',
        });
        if (start) params.set('start', start);
        if (end) params.set('end', end);

        const response = await fetch(
          `https://data.alpaca.markets/v1beta3/crypto/us/bars?${params}`,
          {
            headers: {
              'APCA-API-KEY-ID': alpacaApiKey,
              'APCA-API-SECRET-KEY': alpacaApiSecret,
            },
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          console.error('[Alpaca] Crypto bars error:', errData);
          throw new Error(errData.message || 'Failed to fetch crypto bars');
        }

        const barsData = await response.json();
        const symbolBars = barsData.bars?.[symbol] || [];
        const bars = symbolBars.map((b: any) => ({
          timestamp: new Date(b.t).getTime(),
          date: b.t,
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v,
        }));

        console.log(`[Alpaca] Returned ${bars.length} crypto bars for ${symbol}`);

        return new Response(
          JSON.stringify({ success: true, bars }),
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
    const sanitized = sanitizeError(error);
    return new Response(
      JSON.stringify({ 
        error: sanitized.message, 
        code: sanitized.code,
        needsReconnect: sanitized.code === 'CREDENTIALS_INVALID'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
