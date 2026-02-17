import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate: service role key or anon key (for pg_cron calls)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    if (token !== supabaseServiceKey && token !== supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[RunAutomations] Starting automation run...');

    // Fetch all active automations
    const { data: automations, error } = await supabaseAdmin
      .from('stock_automations')
      .select('id, symbol, user_id')
      .eq('is_active', true);

    if (error) {
      console.error('[RunAutomations] Failed to fetch automations:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch automations' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!automations || automations.length === 0) {
      console.log('[RunAutomations] No active automations found');
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[RunAutomations] Processing ${automations.length} active automations`);

    const results = [];

    // Process each automation sequentially with a small delay to avoid rate-limiting
    for (const automation of automations) {
      try {
        console.log(`[RunAutomations] Processing ${automation.symbol} (${automation.id})`);

        const monitorUrl = `${supabaseUrl}/functions/v1/stock-monitor`;
        const response = await fetch(monitorUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ automationId: automation.id }),
        });

        const result = await response.json();
        results.push({ automationId: automation.id, symbol: automation.symbol, ...result });

        // Rate limit: 200ms between API calls
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[RunAutomations] Error processing ${automation.symbol}:`, err);
        results.push({ automationId: automation.id, symbol: automation.symbol, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    console.log(`[RunAutomations] Completed. Processed ${results.length} automations.`);

    return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[RunAutomations] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
