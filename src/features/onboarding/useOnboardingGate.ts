import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

// Resolves whether the signed-in user still needs /onboarding (profiles.height_cm
// null) — see routes.md "/onboarding" and routes/RequireOnboarded.tsx. Re-runs
// whenever userId changes, since setSession resets onboardingComplete to null
// on any actual user change.
export function useOnboardingGate() {
  const userId = useAppStore((state) => state.userId);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);

  useEffect(() => {
    if (!userId || onboardingComplete !== null) return;
    supabase
      .from('profiles')
      .select('height_cm')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!error) setOnboardingComplete(data.height_cm != null);
      });
  }, [userId, onboardingComplete, setOnboardingComplete]);

  return { checking: userId !== null && onboardingComplete === null };
}
