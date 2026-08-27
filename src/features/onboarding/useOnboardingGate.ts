import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/useAppStore";

// Resolves whether the signed-in user still needs /onboarding. Two-part
// since "Remove personal mode" (docs/pending-deviations.md) made group
// membership mandatory too: profiles.daily_kcal_target must be set (the
// field the profile steps end with, written atomically alongside everything
// else in complete_onboarding) AND the user must belong to at least one
// group (group_members). See routes.md "/onboarding" and
// routes/RequireOnboarded.tsx. Re-runs whenever userId changes, since
// setSession resets onboardingComplete to null on any actual user change.
export function useOnboardingGate() {
  const userId = useAppStore((state) => state.userId);
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  const setOnboardingComplete = useAppStore(
    (state) => state.setOnboardingComplete,
  );

  useEffect(() => {
    if (!userId || onboardingComplete !== null) return;
    Promise.all([
      supabase
        .from("profiles")
        .select("daily_kcal_target")
        .eq("id", userId)
        .single(),
      supabase.from("group_members").select("group_id").eq("user_id", userId),
    ]).then(([profileResult, membershipResult]) => {
      if (profileResult.error || membershipResult.error) return;
      const profileComplete = profileResult.data.daily_kcal_target != null;
      const hasGroup = (membershipResult.data?.length ?? 0) > 0;
      setOnboardingComplete(profileComplete && hasGroup);
    });
  }, [userId, onboardingComplete, setOnboardingComplete]);

  return { checking: userId !== null && onboardingComplete === null };
}
