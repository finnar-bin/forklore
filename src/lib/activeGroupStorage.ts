// Persists the last group the user explicitly picked (a GroupCard tap on
// /groups — the only way to switch groups now that ContextSwitcher was
// removed), so navigating away (e.g. to Progress/Profile) and back — or
// reloading — restores it instead of always resetting to the user's first
// group. Route params remain the source of truth while a group route is
// actually active; see resolveDefaultGroupId (defaultGroup.ts) for how
// this is consulted.
const STORAGE_KEY = "forklore:activeGroupId";

export function getStoredGroupId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredGroupId(groupId: string | null): void {
  try {
    if (groupId) {
      localStorage.setItem(STORAGE_KEY, groupId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.) —
    // context just won't persist across reloads.
  }
}
