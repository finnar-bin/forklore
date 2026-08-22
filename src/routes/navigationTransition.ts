// Push/pop vs. tab-switch classification for the AnimatePresence wrapper in
// AnimatedAppShell — see frontend-architecture.md "Navigation animation".
// Derived from comparing the previous and next pathname's structure, not
// hardcoded per-route, so any future route slots into the right category
// automatically:
//
// - Both paths resolve to one of the four bottom-tab roots (personal or
//   group-scoped) -> 'tab': covers a literal tab switch (Pantry -> Recipes)
//   and a context switch within the same tab (Pantry -> a group's Pantry),
//   neither of which should slide directionally.
// - Next path is a descendant of the previous one (e.g. /pantry ->
//   /pantry/:id) -> 'push': drilling into a detail screen.
// - Previous path is a descendant of the next one (the reverse) -> 'pop':
//   backing out of a detail screen.
// - Anything else (e.g. opening /groups or /sync-status from the header) is
//   treated as 'push' — a new screen being opened, not a sibling swap.
export type TransitionVariant = 'push' | 'pop' | 'tab';
export type BottomTab = 'pantry' | 'recipes' | 'log' | 'progress';

const TAB_ROOT_PATTERNS: Array<[BottomTab, RegExp]> = [
  ['pantry', /^\/(groups\/[^/]+\/)?pantry$/],
  ['recipes', /^\/(groups\/[^/]+\/)?recipes$/],
  ['log', /^\/(groups\/[^/]+\/)?log$/],
  ['progress', /^\/progress$/],
];

// Used both to classify transitions below and to drive BottomNav's active
// highlight — null for any screen that isn't a bottom-tab root (details,
// /groups, /sync-status, etc).
export function getBottomTab(pathname: string): BottomTab | null {
  return TAB_ROOT_PATTERNS.find(([, pattern]) => pattern.test(pathname))?.[0] ?? null;
}

export function classifyTransition(prevPath: string, nextPath: string): TransitionVariant {
  if (prevPath === nextPath) return 'tab';
  if (getBottomTab(prevPath) && getBottomTab(nextPath)) return 'tab';
  if (nextPath.startsWith(`${prevPath}/`)) return 'push';
  if (prevPath.startsWith(`${nextPath}/`)) return 'pop';
  return 'push';
}
