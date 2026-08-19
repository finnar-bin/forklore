import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

// Gates authenticated routes — see routes.md. Assumes the initial session check
// (see useAuthSession) has already resolved by the time this renders.
export function RequireAuth() {
  const userId = useAppStore((state) => state.userId);
  if (!userId) return <Navigate to="/login" replace />;
  return <Outlet />;
}
