// Push/pop vs. tab-switch classification for the AnimatePresence wrapper in
// AnimatedAppShell — see frontend-architecture.md "Navigation animation".
// Derived from comparing the previous and next pathname's structure, not
// hardcoded per-route, so any future route slots into the right category
// automatically:
//
// - Both paths resolve to one of the four bottom-tab roots -> 'tab': covers
//   a literal tab switch (Pantry -> Recipes) and a context switch within the
//   same tab (one group's Pantry -> another group's Pantry), neither of
//   which should slide directionally.
// - Next path is a descendant of the previous one (e.g.
//   /groups/:id/pantry -> /groups/:id/pantry/:ingredientId) -> 'push':
//   drilling into a detail screen.
// - Previous path is a descendant of the next one (the reverse) -> 'pop':
//   backing out of a detail screen.
// - Next path is a bottom-tab root and the previous path isn't -> 'pop':
//   covers "back" affordances that return to a tab root without the new path
//   being a literal parent of the old one (e.g. /sync-status -> /pantry,
//   /logs -> /log, /logs/groups -> /log, /groups/:id/settings ->
//   /groups/:id/pantry). BottomNav only renders on tab roots (see
//   AnimatedAppShell), so the only way to *arrive* at one from a non-tab
//   screen is that screen's own explicit back navigation — never a fresh
//   forward push — making this safe as a general rule rather than a
//   per-route special case.
// - Anything else (e.g. opening /groups or /sync-status from the header) is
//   treated as 'push' — a new screen being opened, not a sibling swap.
export type TransitionVariant = "push" | "pop" | "tab";
export type BottomTab = "pantry" | "recipes" | "log" | "progress";

const TAB_ROOT_PATTERNS: Array<[BottomTab, RegExp]> = [
  ["pantry", /^\/(groups\/[^/]+\/)?pantry$/],
  ["recipes", /^\/(groups\/[^/]+\/)?recipes$/],
  ["log", /^\/(groups\/[^/]+\/)?log$/],
  ["progress", /^\/progress$/],
];

// Used both to classify transitions below and to drive BottomNav's active
// highlight — null for any screen that isn't a bottom-tab root (details,
// /groups, /sync-status, etc).
export function getBottomTab(pathname: string): BottomTab | null {
  return (
    TAB_ROOT_PATTERNS.find(([, pattern]) => pattern.test(pathname))?.[0] ?? null
  );
}

export function classifyTransition(
  prevPath: string,
  nextPath: string,
): TransitionVariant {
  if (prevPath === nextPath) return "tab";
  if (getBottomTab(prevPath) && getBottomTab(nextPath)) return "tab";
  if (nextPath.startsWith(`${prevPath}/`)) return "push";
  if (prevPath.startsWith(`${nextPath}/`)) return "pop";
  if (getBottomTab(nextPath) && !getBottomTab(prevPath)) return "pop";
  return "push";
}
