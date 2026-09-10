import { test, expect } from "../fixtures";

// Issue #62 — desktop nav rail + responsive breakpoint. Playwright's
// default "Desktop Chrome" viewport (1280x720, playwright.config.ts) is
// already >=900px (md), so every other spec in this suite exercises
// NavRail/AnimatedAppShell's fade-only path without knowing it; this file
// is the one place that also asserts on it directly, and on the <900px
// BottomNav path via an explicit narrower viewport. See
// docs/pending-deviations.md ("Desktop nav shell (issue #62)").
test.describe("Desktop nav rail", () => {
  test("shows all 5 destinations with correct active-tab highlighting, replacing BottomNav", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();

    const rail = page.getByRole("navigation", { name: "Main navigation" });
    await expect(rail).toBeVisible();
    for (const label of ["Pantry", "Recipes", "Log", "Progress", "Converter"]) {
      await expect(rail.getByRole("button", { name: label })).toBeVisible();
    }

    // Landed on Pantry (loginAsSeededUser's own flow) — Pantry is the
    // active tab, no other tab is.
    await expect(rail.getByRole("button", { name: "Pantry" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      rail.getByRole("button", { name: "Recipes" }),
    ).not.toHaveAttribute("aria-current", "page");

    // No BottomNav underneath it at this width.
    await expect(page.getByRole("navigation")).toHaveCount(1);

    await rail.getByRole("button", { name: "Recipes" }).click();
    await expect(page).toHaveURL(/\/recipes$/);
    await expect(rail.getByRole("button", { name: "Recipes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      rail.getByRole("button", { name: "Pantry" }),
    ).not.toHaveAttribute("aria-current", "page");
  });

  test("resolves Pantry/Recipes/Log tapped from Progress to the last-picked group, same as BottomNav", async ({
    page,
    loginAsSeededUser,
    seededUser,
  }) => {
    await loginAsSeededUser();

    const rail = page.getByRole("navigation", { name: "Main navigation" });
    await rail.getByRole("button", { name: "Progress" }).click();
    await expect(page).toHaveURL(/\/progress$/);

    // Progress carries no :groupId — tapping a group-scoped tab from here
    // has to fall back to the group last picked on /groups (defaultGroup.ts).
    await rail.getByRole("button", { name: "Log" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/groups/${seededUser.groupId}/log$`),
    );
  });

  test("falls back to BottomNav below 900px, with no nav rail present", async ({
    page,
    loginAsSeededUser,
  }) => {
    await page.setViewportSize({ width: 700, height: 800 });
    await loginAsSeededUser();

    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log" })).toBeVisible();

    await page.getByRole("button", { name: "Recipes" }).click();
    await expect(page).toHaveURL(/\/recipes$/);
  });
});
