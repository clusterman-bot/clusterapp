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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const alpacaApiKey = Deno.env.get('ALPACA_API_KEY');
    const alpacaApiSecret = Deno.env.get('ALPACA_API_SECRET');

    if (!alpacaApiKey || !alpacaApiSecret) {
      throw new Error('Alpaca API credentials not configured');
    }

    // Get auth token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    // Determine base URL based on paper/live mode
    const body = req.method === 'POST' ? await req.json() : {};
    const isPaper = body.isPaper !== false; // Default to paper trading
    const alpacaBaseUrl = isPaper 
      ? 'https://paper-api.alpaca.markets' 
      : 'https://api.alpaca.markets';

    console.log(`[Alpaca] Action: ${action}, Mode: ${isPaper ? 'PAPER' : 'LIVE'}, User: ${user.id}`);

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
        console.log('[Alpaca] Account response:', JSON.stringify(data));
        
        if (!response.ok) {
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
        console.log('[Alpaca] Positions response:', JSON.stringify(data));

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch positions');
        }

        return new Response(
          JSON.stringify({ success: true, positions: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'orders': {
        if (req.method === 'GET') {
          // Get orders
          const status = url.searchParams.get('status') || 'all';
          const response = await fetch(`${alpacaBaseUrl}/v2/orders?status=${status}`, {
            headers: alpacaHeaders,
          });
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch orders');
          }

          return new Response(
            JSON.stringify({ success: true, orders: data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;
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
        await supabase.from('orders').insert({
          user_id: user.id,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Alpaca] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
