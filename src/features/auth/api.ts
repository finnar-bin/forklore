import { db } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // If email confirmation is required, signUp succeeds but returns no session —
  // the caller needs to know so it can prompt the user to check their inbox.
  return { needsEmailConfirmation: data.session === null };
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// See frontend-architecture.md "Logout behavior". Doesn't block logout on
// pending outbox items (that would trap an offline user who just wants to
// log out) — instead the caller shows a count-specific warning and lets the
// user confirm discarding them via performLogout.
export async function attemptLogout(): Promise<{ needsConfirmation: boolean; pendingCount: number }> {
  const pendingCount = await db.outbox.count();
  if (pendingCount > 0) return { needsConfirmation: true, pendingCount };
  await performLogout();
  return { needsConfirmation: false, pendingCount: 0 };
}

// Clears the entire local Dexie database on logout — forces a fresh sync on
// next login rather than risking a different user on the same device
// briefly seeing the previous user's cached data (shared-device scenario).
// db.delete() drops the underlying IndexedDB database; Dexie lazily reopens
// it on the next table access, so no explicit re-open call is needed.
export async function performLogout(): Promise<void> {
  await signOut();
  await db.delete();
  useAppStore.getState().setSession(null);
}
