import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

// Resolves whether the signed-in user still needs /onboarding
// (profiles.daily_kcal_target null — the field the whole flow ends with, and
// the only one written atomically alongside everything else in
// complete_onboarding) — see routes.md "/onboarding" and
// routes/RequireOnboarded.tsx. Re-runs whenever userId changes, since
// setSession resets onboardingComplete to null on any actual user change.
export function useOnboardingGate() {
  const userId = useAppStore((state) => state.userId);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);

  useEffect(() => {
    if (!userId || onboardingComplete !== null) return;
    supabase
      .from('profiles')
      .select('daily_kcal_target')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!error) setOnboardingComplete(data.daily_kcal_target != null);
      });
  }, [userId, onboardingComplete, setOnboardingComplete]);

  return { checking: userId !== null && onboardingComplete === null };
}
