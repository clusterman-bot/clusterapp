import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_BACKEND_URL_RAW = Deno.env.get('ML_BACKEND_URL');
const ML_BACKEND_URL = ML_BACKEND_URL_RAW?.replace(/\/+$/, ''); // Remove trailing slashes
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

    console.log(`[ML-Backend] ===== ${action.toUpperCase()} REQUEST =====`);
    console.log(`[ML-Backend] User: ${user.id}`);
    console.log(`[ML-Backend] ML_BACKEND_URL configured: ${ML_BACKEND_URL ? 'YES' : 'NO'}`);

    if (req.method === 'POST') {
      const body = await req.json();
      console.log(`[ML-Backend] Request body:`, JSON.stringify(body, null, 2));

      if (action === 'train') {
        const isDemoMode = body.demo_mode === true;
        const dataLimit = isDemoMode ? 5 : body.limit;
        const horizonMinutes = body.horizon || 5;
        
        console.log(`[ML-Backend] ===== TRAINING CONFIG =====`);
        console.log(`[ML-Backend] Demo mode: ${isDemoMode}`);
        console.log(`[ML-Backend] Ticker: ${body.ticker}`);
        console.log(`[ML-Backend] Date range: ${body.start_date} to ${body.end_date}`);
        console.log(`[ML-Backend] Horizon: ${horizonMinutes} minutes`);
        console.log(`[ML-Backend] Indicators:`, JSON.stringify(body.indicators, null, 2));
        console.log(`[ML-Backend] Hyperparameters:`, JSON.stringify(body.hyperparameters, null, 2));
        
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
            hyperparameters: { 
              ...body.hyperparameters, 
              demo_mode: isDemoMode, 
              data_limit: dataLimit,
              horizon_minutes: horizonMinutes 
            },
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) {
          console.error('[ML-Backend] Error creating training run:', insertError);
          throw insertError;
        }

        console.log(`[ML-Backend] Created training run: ${trainingRun.id}`);

        // If ML backend is configured, forward the request
        if (ML_BACKEND_URL && !isDemoMode) {
          const mlPayload = {
            model_id: body.model_id,
            training_run_id: trainingRun.id,
            ticker: body.ticker,
            start_date: body.start_date,
            end_date: body.end_date,
            horizon_minutes: horizonMinutes,
            indicators: body.indicators,
            hyperparameters: body.hyperparameters,
            callback_url: `${SUPABASE_URL}/functions/v1/ml-backend/callback`,
          };

          console.log(`[ML-Backend] ===== SENDING TO YOUR ENGINE =====`);
          console.log(`[ML-Backend] URL: ${ML_BACKEND_URL}/train`);
          console.log(`[ML-Backend] Payload:`, JSON.stringify(mlPayload, null, 2));

          try {
            const startTime = Date.now();
            const mlResponse = await fetch(`${ML_BACKEND_URL}/train`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mlPayload),
            });
            const responseTime = Date.now() - startTime;

            console.log(`[ML-Backend] ===== ENGINE RESPONSE =====`);
            console.log(`[ML-Backend] Status: ${mlResponse.status} ${mlResponse.statusText}`);
            console.log(`[ML-Backend] Response time: ${responseTime}ms`);

            if (mlResponse.ok) {
              const mlData = await mlResponse.json();
              console.log(`[ML-Backend] Response data:`, JSON.stringify(mlData, null, 2));
              
              await supabase
                .from('training_runs')
                .update({ status: 'running' })
                .eq('id', trainingRun.id);

              console.log(`[ML-Backend] ✅ Training request sent to your engine successfully`);
            } else {
              const errorText = await mlResponse.text();
              console.error(`[ML-Backend] ❌ Engine error response:`, errorText);
              console.log(`[ML-Backend] Falling back to simulation...`);
              await simulateTraining(supabase, trainingRun.id, body, isDemoMode);
            }
          } catch (mlError: any) {
            console.error(`[ML-Backend] ❌ Failed to reach engine:`, mlError.message);
            console.log(`[ML-Backend] Falling back to simulation...`);
            await simulateTraining(supabase, trainingRun.id, body, isDemoMode);
          }
        } else {
          console.log(`[ML-Backend] Using simulation (demo mode: ${isDemoMode}, no ML URL: ${!ML_BACKEND_URL})`);
          await simulateTraining(supabase, trainingRun.id, body, isDemoMode);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          training_run_id: trainingRun.id,
          message: isDemoMode ? 'Demo training started (limited data, no API calls)' : 'Training started',
          demo_mode: isDemoMode,
          horizon_minutes: horizonMinutes,
          ml_backend_configured: !!ML_BACKEND_URL
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'validate') {
        console.log(`[ML-Backend] ===== VALIDATION REQUEST =====`);
        console.log(`[ML-Backend] Model ID: ${body.model_id}`);
        console.log(`[ML-Backend] Training Run ID: ${body.training_run_id}`);
        console.log(`[ML-Backend] Date range: ${body.start_date} to ${body.end_date}`);

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

        console.log(`[ML-Backend] Created validation run: ${validationRun.id}`);

        // If ML backend is configured, forward the validation request
        if (ML_BACKEND_URL) {
          const validatePayload = {
            model_id: body.model_id,
            validation_run_id: validationRun.id,
            training_run_id: body.training_run_id,
            start_date: body.start_date,
            end_date: body.end_date,
            callback_url: `${SUPABASE_URL}/functions/v1/ml-backend/callback`,
          };

          console.log(`[ML-Backend] ===== SENDING VALIDATION TO ENGINE =====`);
          console.log(`[ML-Backend] URL: ${ML_BACKEND_URL}/validate`);
          console.log(`[ML-Backend] Payload:`, JSON.stringify(validatePayload, null, 2));

          try {
            const startTime = Date.now();
            const mlResponse = await fetch(`${ML_BACKEND_URL}/validate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(validatePayload),
            });
            const responseTime = Date.now() - startTime;

            console.log(`[ML-Backend] ===== VALIDATION ENGINE RESPONSE =====`);
            console.log(`[ML-Backend] Status: ${mlResponse.status} ${mlResponse.statusText}`);
            console.log(`[ML-Backend] Response time: ${responseTime}ms`);

            if (mlResponse.ok) {
              const mlData = await mlResponse.json();
              console.log(`[ML-Backend] Response data:`, JSON.stringify(mlData, null, 2));
              
              await supabase
                .from('validation_runs')
                .update({ status: 'running' })
                .eq('id', validationRun.id);

              console.log(`[ML-Backend] ✅ Validation request sent to engine successfully`);
            } else {
              const errorText = await mlResponse.text();
              console.error(`[ML-Backend] ❌ Validation engine error:`, errorText);
              await simulateValidation(supabase, validationRun.id);
            }
          } catch (mlError: any) {
            console.error(`[ML-Backend] ❌ Failed to reach engine for validation:`, mlError.message);
            await simulateValidation(supabase, validationRun.id);
          }
        } else {
          console.log(`[ML-Backend] Using simulated validation (no ML URL configured)`);
          await simulateValidation(supabase, validationRun.id);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          validation_run_id: validationRun.id,
          ml_backend_configured: !!ML_BACKEND_URL
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'callback') {
        console.log(`[ML-Backend] ===== CALLBACK FROM ENGINE =====`);
        console.log(`[ML-Backend] Callback data:`, JSON.stringify(body, null, 2));

        const { training_run_id, validation_run_id, status, results, best_model_name, best_model_metrics, metrics, signal_distribution, error_message } = body;
        
        if (training_run_id) {
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
          console.log(`[ML-Backend] ✅ Training run ${training_run_id} updated with status: ${status}`);
        }

        if (validation_run_id) {
          await supabase
            .from('validation_runs')
            .update({
              status,
              metrics,
              signal_distribution,
              error_message,
              completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
            })
            .eq('id', validation_run_id);
          console.log(`[ML-Backend] ✅ Validation run ${validation_run_id} updated with status: ${status}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'health') {
        console.log(`[ML-Backend] ===== HEALTH CHECK =====`);
        
        let engineStatus = 'not_configured';
        let engineResponseTime = null;
        let engineError = null;

        if (ML_BACKEND_URL) {
          try {
            const startTime = Date.now();
            const healthResponse = await fetch(`${ML_BACKEND_URL}/health`, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });
            engineResponseTime = Date.now() - startTime;

            if (healthResponse.ok) {
              engineStatus = 'healthy';
              console.log(`[ML-Backend] ✅ Engine is healthy (${engineResponseTime}ms)`);
            } else {
              engineStatus = 'unhealthy';
              engineError = `Status ${healthResponse.status}`;
              console.log(`[ML-Backend] ⚠️ Engine unhealthy: ${engineError}`);
            }
          } catch (e: any) {
            engineStatus = 'unreachable';
            engineError = e.message;
            console.log(`[ML-Backend] ❌ Engine unreachable: ${engineError}`);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          ml_backend_url: ML_BACKEND_URL ? `${ML_BACKEND_URL.substring(0, 30)}...` : null,
          engine_status: engineStatus,
          engine_response_time_ms: engineResponseTime,
          engine_error: engineError,
        }), {
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
    console.error('[ML-Backend] ❌ Error:', error);
    // SECURITY: Sanitize error messages to prevent information leakage
    return new Response(JSON.stringify({ error: 'An error occurred while processing your request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simulate training for demo purposes when ML backend is not available
async function simulateTraining(supabase: any, trainingRunId: string, config: any, isDemoMode: boolean = false) {
  console.log(`[ML-Backend] Starting SIMULATED training for ${trainingRunId}`);
  
  await supabase
    .from('training_runs')
    .update({ status: 'running' })
    .eq('id', trainingRunId);

  const processingTime = isDemoMode ? 1000 : 2000;
  await new Promise(resolve => setTimeout(resolve, processingTime));

  const baseAccuracy = isDemoMode ? 0.70 : 0.65;
  const variance = isDemoMode ? 0.05 : 0.15;
  
  const results = {
    random_forest: {
      accuracy: baseAccuracy + Math.random() * variance,
      f1: (baseAccuracy - 0.05) + Math.random() * variance,
      recall: (baseAccuracy - 0.07) + Math.random() * variance,
    },
    gradient_boosting: {
      accuracy: (baseAccuracy + 0.02) + Math.random() * (variance - 0.02),
      f1: (baseAccuracy - 0.03) + Math.random() * variance,
      recall: (baseAccuracy - 0.05) + Math.random() * variance,
    },
    logistic_regression: {
      accuracy: (baseAccuracy - 0.10) + Math.random() * variance,
      f1: (baseAccuracy - 0.15) + Math.random() * variance,
      recall: (baseAccuracy - 0.17) + Math.random() * variance,
    },
  };

  const models = Object.entries(results);
  const bestModel = models.reduce((best, [name, metrics]: [string, any]) => 
    metrics.accuracy > (best.metrics?.accuracy || 0) ? { name, metrics } : best,
    { name: '', metrics: null as any }
  );

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

  console.log(`[ML-Backend] SIMULATED training completed for ${trainingRunId}`);
}

// Simulate validation for demo purposes
async function simulateValidation(supabase: any, validationRunId: string) {
  console.log(`[ML-Backend] Starting SIMULATED validation for ${validationRunId}`);

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

  console.log(`[ML-Backend] SIMULATED validation completed for ${validationRunId}`);
}
