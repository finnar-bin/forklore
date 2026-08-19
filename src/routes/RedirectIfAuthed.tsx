import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

// Keeps already-logged-in users off /login and /signup.
export function RedirectIfAuthed() {
  const userId = useAppStore((state) => state.userId);
  if (userId) return <Navigate to="/" replace />;
  return <Outlet />;
}
