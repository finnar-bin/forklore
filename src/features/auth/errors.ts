// Supabase auth errors are already fairly plain, but a few common ones read
// better rephrased to match the copy convention (what happened, then what to do).
export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Something went wrong.';

  if (/already registered/i.test(message)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match. Check them and try again.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message;
}
