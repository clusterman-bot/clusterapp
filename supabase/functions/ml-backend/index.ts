import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_BACKEND_URL = Deno.env.get('ML_BACKEND_URL');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const action = path[path.length - 1];

    console.log(`ML Backend request: ${action} from user ${user.id}`);

    if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'train') {
        // Create a training run record
        const { data: trainingRun, error: insertError } = await supabase
          .from('training_runs')
          .insert({
            user_id: user.id,
            model_id: body.model_id,
            ticker: body.ticker,
            start_date: body.start_date,
            end_date: body.end_date,
            indicators_enabled: body.indicators,
            hyperparameters: body.hyperparameters,
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating training run:', insertError);
          throw insertError;
        }

        console.log(`Created training run ${trainingRun.id}`);

        // If ML backend is configured, forward the request
        if (ML_BACKEND_URL) {
          try {
            const mlResponse = await fetch(`${ML_BACKEND_URL}/train`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...body,
                training_run_id: trainingRun.id,
                callback_url: `${SUPABASE_URL}/functions/v1/ml-backend/callback`,
              }),
            });

            if (mlResponse.ok) {
              // Update status to running
              await supabase
                .from('training_runs')
                .update({ status: 'running' })
                .eq('id', trainingRun.id);
            }
          } catch (mlError) {
            console.log('ML Backend not available, using simulated training');
            // Simulate training for demo purposes
            await simulateTraining(supabase, trainingRun.id, body);
          }
        } else {
          // Simulate training for demo purposes
          await simulateTraining(supabase, trainingRun.id, body);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          training_run_id: trainingRun.id,
          message: 'Training started'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'validate') {
        // Create a validation run record
        const { data: validationRun, error: insertError } = await supabase
          .from('validation_runs')
          .insert({
            user_id: user.id,
            model_id: body.model_id,
            training_run_id: body.training_run_id,
            start_date: body.start_date,
            end_date: body.end_date,
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Simulate validation
        await simulateValidation(supabase, validationRun.id);

        return new Response(JSON.stringify({ 
          success: true, 
          validation_run_id: validationRun.id 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'callback') {
        // Handle callback from ML backend
        const { training_run_id, status, results, best_model_name, best_model_metrics, error_message } = body;
        
        await supabase
          .from('training_runs')
          .update({
            status,
            results,
            best_model_name,
            best_model_metrics,
            error_message,
            completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
          })
          .eq('id', training_run_id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (req.method === 'GET') {
      if (action === 'status') {
        const trainingRunId = url.searchParams.get('training_run_id');
        
        const { data, error } = await supabase
          .from('training_runs')
          .select('*')
          .eq('id', trainingRunId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in ml-backend function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simulate training for demo purposes when ML backend is not available
async function simulateTraining(supabase: any, trainingRunId: string, config: any) {
  // Update to running
  await supabase
    .from('training_runs')
    .update({ status: 'running' })
    .eq('id', trainingRunId);

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generate simulated results
  const results = {
    random_forest: {
      accuracy: 0.65 + Math.random() * 0.15,
      f1: 0.60 + Math.random() * 0.15,
      recall: 0.58 + Math.random() * 0.17,
    },
    gradient_boosting: {
      accuracy: 0.67 + Math.random() * 0.13,
      f1: 0.62 + Math.random() * 0.13,
      recall: 0.60 + Math.random() * 0.15,
    },
    logistic_regression: {
      accuracy: 0.55 + Math.random() * 0.15,
      f1: 0.50 + Math.random() * 0.15,
      recall: 0.48 + Math.random() * 0.17,
    },
  };

  // Find best model
  const models = Object.entries(results);
  const bestModel = models.reduce((best, [name, metrics]: [string, any]) => 
    metrics.accuracy > (best.metrics?.accuracy || 0) ? { name, metrics } : best,
    { name: '', metrics: null as any }
  );

  // Update with results
  await supabase
    .from('training_runs')
    .update({
      status: 'completed',
      results,
      best_model_name: bestModel.name,
      best_model_metrics: bestModel.metrics,
      completed_at: new Date().toISOString(),
    })
    .eq('id', trainingRunId);

  console.log(`Simulated training completed for ${trainingRunId}`);
}

// Simulate validation for demo purposes
async function simulateValidation(supabase: any, validationRunId: string) {
  await supabase
    .from('validation_runs')
    .update({ status: 'running' })
    .eq('id', validationRunId);

  await new Promise(resolve => setTimeout(resolve, 1500));

  const metrics = {
    accuracy: 0.62 + Math.random() * 0.13,
    f1: 0.58 + Math.random() * 0.12,
    recall: 0.55 + Math.random() * 0.15,
    precision: 0.60 + Math.random() * 0.12,
  };

  const signalDistribution = {
    BUY: Math.floor(30 + Math.random() * 20),
    SELL: Math.floor(25 + Math.random() * 20),
    HOLD: Math.floor(40 + Math.random() * 30),
  };

  await supabase
    .from('validation_runs')
    .update({
      status: 'completed',
      metrics,
      signal_distribution: signalDistribution,
      completed_at: new Date().toISOString(),
    })
    .eq('id', validationRunId);
}
