import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/useAppStore";

// Resolves the initial session once, then keeps useAppStore's userId in sync
// with subsequent sign-in/sign-out/token-refresh events for the app's lifetime.
export function useAuthSession() {
  const setSession = useAppStore((state) => state.setSession);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user.id ?? null);
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session?.user.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  return { initializing };
}
