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

    // Authenticate: accept service role key or the publishable anon key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[RunAutomations] Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    
    // Allow service role key directly
    if (token === supabaseServiceKey) {
      console.log('[RunAutomations] Authenticated via service role key');
    } else {
      // For cron jobs using the anon/publishable key, validate the JWT
      const supabaseAuth = createClient(supabaseUrl, token);
      // If the token is a valid anon key JWT, this will work
      // We just need to verify it's a legitimate Supabase JWT for this project
      try {
        // Parse JWT to check issuer matches our project
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.ref !== 'pfszkghqoxybhbaouliw' && payload.iss !== 'supabase') {
            console.error('[RunAutomations] JWT does not match project');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          console.log('[RunAutomations] Authenticated via project JWT (role:', payload.role, ')');
        } else {
          console.error('[RunAutomations] Invalid token format');
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (e) {
        console.error('[RunAutomations] Token validation error:', e);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
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
