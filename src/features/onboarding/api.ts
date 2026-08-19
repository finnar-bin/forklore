import { supabase } from '../../lib/supabase';

export async function fetchProfileName(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data.name;
}

export interface OnboardingInput {
  name: string;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  goalType: 'lose' | 'gain' | 'maintain';
}

// Atomic profiles update + weight_logs insert — see the complete_onboarding
// RPC (supabase/migrations/20260820000000_complete_onboarding_rpc.sql).
export async function completeOnboarding(input: OnboardingInput): Promise<void> {
  const { error } = await supabase.rpc('complete_onboarding', {
    p_name: input.name,
    p_height_cm: input.heightCm,
    p_weight_kg: input.weightKg,
    p_goal_weight_kg: input.goalWeightKg,
    p_goal_type: input.goalType,
  });
  if (error) throw error;
}
