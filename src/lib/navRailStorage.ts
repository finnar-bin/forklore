// Persists whether the desktop NavRail (>=900px, see navTabs.ts) is
// collapsed to its icon-only width or expanded with labels, so reloading
// or revisiting the app doesn't reset a user's chosen layout. Same
// try/catch-wrapped pattern as activeGroupStorage.ts/pendingInviteStorage.ts.
const STORAGE_KEY = "forklore:navRailCollapsed";

export function getStoredNavRailCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setStoredNavRailCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // localStorage unavailable (private browsing, storage full, etc.) —
    // the collapse preference just won't persist across reloads.
  }
}
