import { LoginForm } from "../features/auth/LoginForm";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
