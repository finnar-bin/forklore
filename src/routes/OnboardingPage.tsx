import { OnboardingStepper } from '../features/onboarding/OnboardingStepper';
import { AuthLayout } from './AuthLayout';

export function OnboardingPage() {
  return (
    <AuthLayout>
      <OnboardingStepper />
    </AuthLayout>
  );
}
