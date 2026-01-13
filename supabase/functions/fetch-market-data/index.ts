import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // SECURITY: Require authentication to prevent API abuse
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[MarketData] Authenticated request from user: ${user.id}`);
    
    const { ticker, start_date, end_date, timespan = 'day', demo_mode = false, limit } = await req.json();

    if (!ticker || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: ticker, start_date, end_date' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching market data for ${ticker} from ${start_date} to ${end_date}`);

    // Check cache first
    const { data: cachedData } = await supabase
      .from('market_data_cache')
      .select('data, expires_at')
      .eq('ticker', ticker)
      .eq('timespan', timespan)
      .eq('start_date', start_date)
      .eq('end_date', end_date)
      .single();

    if (cachedData && new Date(cachedData.expires_at) > new Date()) {
      console.log('Returning cached data');
      return new Response(JSON.stringify({ 
        data: cachedData.data,
        cached: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Demo mode - use limited simulated data for testing (respects API limits)
    if (demo_mode) {
      console.log('Demo mode enabled - generating limited test data');
      const demoData = generateSimulatedData(ticker, start_date, end_date, limit || 5);
      return new Response(JSON.stringify({ 
        data: demoData,
        demo: true,
        message: 'Demo mode: Using limited simulated data to respect API rate limits'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch from Polygon.io
    if (!POLYGON_API_KEY) {
      // Return simulated data for demo
      const simulatedData = generateSimulatedData(ticker, start_date, end_date, limit);
      return new Response(JSON.stringify({ 
        data: simulatedData,
        simulated: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use limit parameter for Polygon to reduce API calls
    const polygonLimit = limit ? `&limit=${limit}` : '';
    const polygonUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/${timespan}/${start_date}/${end_date}?adjusted=true&sort=asc${polygonLimit}&apiKey=${POLYGON_API_KEY}`;
    
    console.log(`Fetching from Polygon with${limit ? ` limit=${limit}` : ' no limit'}`);
    
    const response = await fetch(polygonUrl);
    const polygonData = await response.json();

    if (polygonData.status === 'ERROR' || !polygonData.results) {
      console.error('Polygon API error:', polygonData);
      // Return simulated data as fallback
      const simulatedData = generateSimulatedData(ticker, start_date, end_date, limit);
      return new Response(JSON.stringify({ 
        data: simulatedData,
        simulated: true,
        error: polygonData.error || 'Failed to fetch from Polygon'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform to standard format
    let marketData = polygonData.results.map((bar: any) => ({
      timestamp: bar.t,
      date: new Date(bar.t).toISOString().split('T')[0],
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
    }));

    // Apply limit if specified
    if (limit && marketData.length > limit) {
      marketData = marketData.slice(0, limit);
    }

    // Cache the data
    await supabase
      .from('market_data_cache')
      .upsert({
        ticker,
        timespan,
        start_date,
        end_date,
        data: marketData,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      }, {
        onConflict: 'ticker,timespan,start_date,end_date'
      });

    return new Response(JSON.stringify({ 
      data: marketData,
      count: marketData.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error fetching market data:', error);
    // SECURITY: Sanitize error messages to prevent information leakage
    return new Response(JSON.stringify({ error: 'An error occurred while fetching market data' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Generate simulated market data for demo purposes
function generateSimulatedData(ticker: string, startDate: string, endDate: string, limit?: number) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const data = [];
  
  // Use ticker to seed consistent random data
  const tickerSeed = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let price = 100 + (tickerSeed % 100); // Deterministic starting price based on ticker
  const volatility = 0.02;
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    
    // Stop if we've reached the limit
    if (limit && data.length >= limit) break;
    
    const change = (Math.random() - 0.5) * 2 * volatility;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    const volume = Math.floor(1000000 + Math.random() * 5000000);
    
    data.push({
      timestamp: d.getTime(),
      date: d.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
      vwap: parseFloat(((open + close + high + low) / 4).toFixed(2)),
    });
    
    price = close;
  }
  
  console.log(`Generated ${data.length} simulated data points${limit ? ` (limit: ${limit})` : ''}`);
  return data;
}
