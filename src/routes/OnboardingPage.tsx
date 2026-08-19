import { OnboardingForm } from '../features/onboarding/OnboardingForm';
import { AuthLayout } from './AuthLayout';

export function OnboardingPage() {
  return (
    <AuthLayout>
      <OnboardingForm />
    </AuthLayout>
  );
}
