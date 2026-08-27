// Carries an invite code across the signup/login redirect so a not-yet-
// authenticated invitee doesn't lose it. AcceptInvite stashes the code here
// before sending a logged-out visitor to /signup or /login; the auth flows
// consult it afterward (emailRedirectTo for signup's async email-confirm
// hop, a plain post-login navigate for the synchronous cases) to land back
// on /invite/:code once authenticated. See docs/pending-deviations.md
// ("Remove personal mode") for why this needed to exist at all.
const STORAGE_KEY = "forklore:pendingInviteCode";

export function getPendingInviteCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPendingInviteCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.) —
    // the handoff just won't survive the redirect; AcceptInvite's normal
    // logged-in flow still works if the user finds their way back manually.
  }
}

export function clearPendingInviteCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — see getPendingInviteCode.
  }
}
