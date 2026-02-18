import { supabase } from '@/integrations/supabase/client';

export interface AAL2StepUpResult {
  needsStepUp: boolean;
  factorId: string | null;
}

export async function checkAAL2StepUp(): Promise<AAL2StepUpResult> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) {
    return { needsStepUp: false, factorId: null };
  }

  // If we already have AAL2, no step-up needed
  if (data.currentLevel === 'aal2') {
    return { needsStepUp: false, factorId: null };
  }

  // If next level requires AAL2, find the enrolled factor
  if (data.nextLevel === 'aal2') {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const verifiedFactor = factorsData?.totp?.find(f => f.status === 'verified') ?? null;
    return {
      needsStepUp: true,
      factorId: verifiedFactor?.id ?? null,
    };
  }

  return { needsStepUp: false, factorId: null };
}
