import { test, expect } from "../fixtures";

// Mirrors src/components/PageContent.tsx's PAGE_CONTENT_MAX_WIDTH and
// src/components/navTabs.ts's NAV_RAIL_WIDTH_EXPANDED. Not imported
// directly — every other spec in this suite drives the app only through
// the browser, never imports from src/, and doing so here breaks anyway:
// Playwright specs run under plain Node, not through Vite, so
// src/lib/supabase.ts's `import.meta.env.VITE_SUPABASE_URL` (pulled in
// transitively via navTabs.ts) is undefined outside Vite's own transform.
const PAGE_CONTENT_MAX_WIDTH = { xs: 480, md: 760 };
// NavRail defaults to expanded (no collapse preference stored yet in a
// fresh browser context, which is what this suite always runs in — see
// navRailStorage.ts) — see docs/pending-deviations.md ("Collapsible
// desktop nav rail").
const NAV_RAIL_WIDTH = 240;

// AnimatedAppShell.tsx's push/pop/tab-switch animation (TRANSITION,
// duration: 0.28) briefly renders the *current* screen with
// `position: absolute; inset: 0` while it overlaps an outgoing one (the
// ~280ms window right after any navigation, including the redirect
// loginAsSeededUser's own login triggers). `inset: 0` on an absolutely
// positioned element resolves against its containing block's padding
// box, which — unintuitively — still includes the parent's own
// `pl: NAV_RAIL_WIDTH` as part of that box, making the child render as if
// the rail offset weren't there for as long as the overlap lasts. Each
// test below polls boundingBox() (via expect.poll) rather than reading it
// once, so the assertions land on the *settled* layout, not a
// mid-animation artifact.

// Issue #63 — desktop page max-width. PageContent replaced every screen's
// own hardcoded `maxWidth: 480, mx: "auto"` with a shared, breakpoint-aware
// value (480 below 900px, unchanged; 760 at >=900px). See
// docs/pending-deviations.md ("Desktop page max-width (issue #63)").
//
// A max-width is a pure layout property with no role/label/text this
// suite's other specs could assert on, so this is the one place in the
// suite that reads a bounding box directly (via PageContent's own
// data-testid, added specifically for this) rather than querying by role.
test.describe("Page content max-width", () => {
  test("stays at the original 480px below 900px, centered on the raw viewport", async ({
    page,
    loginAsSeededUser,
  }) => {
    await page.setViewportSize({ width: 700, height: 800 });
    await loginAsSeededUser();

    const content = page.getByTestId("page-content").first();
    await expect(content).toBeVisible();

    // No NavRail below 900px, so this is centered on the full 700px
    // viewport: (700 - 480) / 2 = 110. Poll on `x` specifically (not
    // `width`, which reads correctly even mid-animation) — it's the value
    // the transition's absolute-positioning window disturbs, so it's the
    // one that needs to be waited past.
    const expectedX = (700 - PAGE_CONTENT_MAX_WIDTH.xs) / 2;

    await expect
      .poll(async () => (await content.boundingBox())?.x, { timeout: 3000 })
      .toBeGreaterThan(expectedX - 10);
    const box = await content.boundingBox();
    expect(box!.width).toBeGreaterThan(PAGE_CONTENT_MAX_WIDTH.xs - 10);
    expect(box!.width).toBeLessThanOrEqual(PAGE_CONTENT_MAX_WIDTH.xs + 2);
    expect(box!.x).toBeLessThan(expectedX + 10);
  });

  test("widens to 760px at >=900px, centered next to NavRail rather than the raw viewport", async ({
    page,
    loginAsSeededUser,
  }) => {
    // Playwright's own Desktop Chrome default (playwright.config.ts) is
    // already 1280x720 (>=900px), but set it explicitly here so this test
    // doesn't silently stop meaning anything if that default ever changes.
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAsSeededUser();

    const content = page.getByTestId("page-content").first();
    await expect(content).toBeVisible();

    // AnimatedAppShell.tsx offsets the content area by NAV_RAIL_WIDTH
    // (240px, NavRail's default expanded width) before PageContent's own
    // mx: "auto" runs, so the centered
    // column sits well right of where naive full-viewport centering
    // ((1280 - 760) / 2 = 260) would put it — this is the assertion that
    // actually catches a regression back to "centered on the raw
    // viewport, ignoring the rail".
    const remaining = 1280 - NAV_RAIL_WIDTH;
    const expectedX =
      NAV_RAIL_WIDTH + (remaining - PAGE_CONTENT_MAX_WIDTH.md) / 2;
    const naiveFullViewportX = (1280 - PAGE_CONTENT_MAX_WIDTH.md) / 2;

    // Poll on `x` (not `width`, which reads correctly even mid-animation)
    // — it's the value the transition's absolute-positioning window (see
    // the file-level comment above) disturbs, so it's the one that needs
    // to be waited past before asserting on the settled layout.
    await expect
      .poll(async () => (await content.boundingBox())?.x, { timeout: 3000 })
      .toBeGreaterThan(expectedX - 10);
    const box = await content.boundingBox();
    expect(box!.width).toBeGreaterThan(PAGE_CONTENT_MAX_WIDTH.md - 10);
    expect(box!.width).toBeLessThanOrEqual(PAGE_CONTENT_MAX_WIDTH.md + 2);
    expect(box!.x).toBeLessThan(expectedX + 10);
    expect(box!.x).toBeGreaterThan(naiveFullViewportX + 20);
  });
});
