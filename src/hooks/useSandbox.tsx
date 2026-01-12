import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SandboxExecutionResult {
  success: boolean;
  execution_id: string;
  status: 'completed' | 'failed' | 'timeout';
  result: {
    signals: { buy: number; sell: number; hold: number };
    total_days: number;
    sample_output: Array<{ date: string; signal: number; [key: string]: any }>;
  } | null;
  logs: string[];
  error: string | null;
  execution_time_ms: number;
  container_info: {
    isolated: boolean;
    timeout_seconds: number;
    max_memory_mb: number;
    allowed_packages: string[];
  };
}

export interface CodeValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  allowed_imports: string[];
  max_execution_time: number;
  max_memory_mb: number;
}

export function useSandboxExecute() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (config: {
      model_id?: string;
      code: string;
      ticker?: string;
      start_date?: string;
      end_date?: string;
      demo_mode?: boolean;
    }): Promise<SandboxExecutionResult> => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      
      const response = await supabase.functions.invoke('sandbox-execute/execute', {
        body: config,
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
  });
}

export function useValidateSandboxCode() {
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (code: string): Promise<CodeValidationResult> => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      
      const response = await supabase.functions.invoke('sandbox-execute/validate-code', {
        body: { code },
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
  });
}
