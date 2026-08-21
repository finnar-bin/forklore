import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

// Gates routes that assume onboarding is done (profiles.daily_kcal_target set)
// — see routes.md "/onboarding". Nest inside RequireAuth; assumes
// useOnboardingGate has already resolved onboardingComplete by the time this
// renders.
export function RequireOnboarded() {
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  if (onboardingComplete === false) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
