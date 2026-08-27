import { SignupForm } from "../features/auth/SignupForm";
import { AuthLayout } from "./AuthLayout";

export function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
