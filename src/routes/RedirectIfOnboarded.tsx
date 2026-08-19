import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

// Keeps users who've already onboarded (profiles.height_cm set) off /onboarding.
export function RedirectIfOnboarded() {
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);
  if (onboardingComplete === true) return <Navigate to="/" replace />;
  return <Outlet />;
}
