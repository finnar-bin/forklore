import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import type { SeededUser } from "../fixtures";

// Issue #65 — AppHeader's new `action` prop, and the 6 screens
// (PantryList/RecipeList/GroupList/CommunityPantryList/DailyLog/Progress)
// that now pass it an inline `Button startIcon={<AddIcon/>}` at >=900px
// instead of rendering their own FAB, while keeping the FAB unchanged
// below that width. See docs/pending-deviations.md ("Desktop 'Add'
// actions move from FAB to header toolbar (issue #65)").
//
// Every other spec in this suite already clicks these same 6 buttons by
// `getByRole("button", { name: ... })` at the default (>=900px) viewport,
// which — per that same doc entry — resolves unambiguously to the header
// Button now rather than the FAB, so those specs cover the swap
// incidentally. This file is the one place that asserts on the swap
// itself: that it really is a different element at each width (a MUI
// `Button`, not a `Fab`), that only one of the two is ever visible at a
// given width, and that the FAB is untouched below 900px, across all 6
// screens.
//
// Playwright's default "Desktop Chrome" viewport (1280x720,
// playwright.config.ts) is already >=900px (md) — see
// desktop-nav.spec.ts's identical note.

interface Screen {
  label: string;
  path: (user: SeededUser) => string;
}

const screens: Screen[] = [
  { label: "Add ingredient", path: (u) => `/groups/${u.groupId}/pantry` },
  { label: "Add recipe", path: (u) => `/groups/${u.groupId}/recipes` },
  { label: "Create group", path: () => "/groups" },
  { label: "Add to community pantry", path: () => "/community-pantry" },
  { label: "Log an entry", path: (u) => `/groups/${u.groupId}/log` },
  { label: "Log weight", path: () => "/progress" },
];

// Both the header Button and the FAB carry the exact same accessible name
// (the doc entry's whole point — same visible text as the old FAB
// aria-label), and MUI's `display: none` branch removes whichever one is
// inactive from the accessibility tree, so `getByRole` resolves to exactly
// one at any given width. `exact: true` keeps that from ever
// substring-matching a same-named button inside the dialog it opens (see
// e2e/README.md's note on this app's ambiguous-name copy conventions).
function actionButton(page: Page, label: string) {
  return page.getByRole("button", { name: label, exact: true });
}

test.describe("Desktop header actions replace the FAB (issue #65)", () => {
  for (const { label, path } of screens) {
    test(`${label}: header Button at >=900px, opens the same dialog, FAB reappears below 900px`, async ({
      page,
      loginAsSeededUser,
      seededUser,
    }) => {
      await loginAsSeededUser();
      await page.goto(path(seededUser));

      // >=900px (default viewport): a header Button, not a Fab, and it's
      // the only element with this accessible name in the a11y tree.
      const headerBtn = actionButton(page, label);
      await expect(headerBtn).toBeVisible();
      await expect(headerBtn).toHaveClass(/MuiButton-root/);
      await expect(headerBtn).not.toHaveClass(/MuiFab-root/);

      // Same behavior as the FAB it replaces: opens the same dialog.
      await headerBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // Below 900px: the FAB is back, unchanged, and it's now the only
      // element with this accessible name — the header Button is
      // `display: none`, not just absent, but that's enough to drop it
      // from getByRole's match.
      await page.setViewportSize({ width: 700, height: 800 });
      const fab = actionButton(page, label);
      await expect(fab).toBeVisible();
      await expect(fab).toHaveClass(/MuiFab-root/);
      await expect(fab).not.toHaveClass(/MuiButton-root/);

      await fab.click();
      await expect(page.getByRole("dialog")).toBeVisible();
    });
  }
});
