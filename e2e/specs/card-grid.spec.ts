import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures";

// Issue #64 — VirtualizedCardList's new `columns` prop (a responsive object
// cascading like an MUI `sx` breakpoint object), and PantryList/RecipeList/
// CommunityPantryList's shared `columns={{ xs: 1, sm: 2, lg: 3 }}`. See
// docs/pending-deviations.md ("Multi-column card grid for virtualized
// lists"). Like page-content-width.spec.ts, a card's row/column position is
// a pure layout property with no role/label/text of its own to assert on
// through a locator, so this reads bounding boxes directly rather than
// querying by role.
//
// Cards render with no `data-testid` of their own (IngredientCard.tsx),
// so `cardFor` walks up from the name text (a leaf <p>) two levels to its
// card's own outer, clickable Box — Typography(name) -> Box(flex:1) ->
// Box(card) — see IngredientCard.tsx/RecipeCard.tsx's identical structure.
function cardFor(page: Page, name: string) {
  return page.getByText(name, { exact: true }).locator("xpath=../..");
}

// Bounding-box comparisons here are between real, independently-measured
// DOM elements (not the same element read twice, and not always read at
// the same instant), so several px of slack is expected — a plain
// `toBeCloseTo(x, 0)` (< 0.5 tolerance) is tighter than that measurement
// noise actually allows, especially under a parallel full-suite run
// sharing CPU with other workers.
function near(actual: number, expected: number, tolerance = 8) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// AnimatedAppShell's push/pop transition briefly mis-measures layout during
// its ~280ms overlap window (see page-content-width.spec.ts's file-level
// comment) — poll rather than reading a boundingBox once, so assertions
// land on the settled layout, not a mid-animation or not-yet-measured
// (virtualizer `estimateSize` only, before its ResizeObserver corrects it)
// artifact.
async function settledBox(page: Page, name: string) {
  const card = cardFor(page, name);
  await expect
    .poll(async () => (await card.boundingBox())?.y, { timeout: 3000 })
    .not.toBeNull();
  // One more frame after the poll first resolves a non-null box: the very
  // first non-null box can still be the pre-measurement estimate.
  await page.waitForTimeout(50);
  const box = await card.boundingBox();
  if (!box) throw new Error(`card "${name}" has no bounding box`);
  return box;
}

test.describe("Multi-column card grid (issue #64)", () => {
  test("groups pantry cards into rows of 3 side by side at lg+ widths", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    for (const [i, name] of [
      "Grid Apple",
      "Grid Banana",
      "Grid Cherry",
      "Grid Date",
    ].entries()) {
      backend.seedRow("ingredients", {
        group_id: seededUser.groupId,
        created_by: seededUser.id,
        updated_by: null,
        name,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100 + i,
        photo_url: null,
        is_community: false,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSeededUser();

    const [apple, banana, cherry, date] = await Promise.all([
      settledBox(page, "Grid Apple"),
      settledBox(page, "Grid Banana"),
      settledBox(page, "Grid Cherry"),
      settledBox(page, "Grid Date"),
    ]);

    // Row 1: 3 cards (name-sorted: Apple, Banana, Cherry), left to right,
    // same row.
    near(banana.y, apple.y);
    near(cherry.y, apple.y);
    expect(banana.x).toBeGreaterThan(apple.x + apple.width / 2);
    expect(cherry.x).toBeGreaterThan(banana.x + banana.width / 2);

    // Row 2: 4th card wraps to a new row, back at column 1's x.
    near(date.x, apple.x);
    expect(date.y).toBeGreaterThan(apple.y + apple.height / 2);
  });

  test("groups pantry cards into rows of 2 between sm and lg widths", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    for (const [i, name] of [
      "Grid Apple",
      "Grid Banana",
      "Grid Cherry",
    ].entries()) {
      backend.seedRow("ingredients", {
        group_id: seededUser.groupId,
        created_by: seededUser.id,
        updated_by: null,
        name,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100 + i,
        photo_url: null,
        is_community: false,
      });
    }
    // 700px: >= sm (600) but < lg (1200) — columns.sm (2) applies, not
    // columns.lg (3).
    await page.setViewportSize({ width: 700, height: 900 });
    await loginAsSeededUser();

    const [apple, banana, cherry] = await Promise.all([
      settledBox(page, "Grid Apple"),
      settledBox(page, "Grid Banana"),
      settledBox(page, "Grid Cherry"),
    ]);

    near(banana.y, apple.y);
    expect(banana.x).toBeGreaterThan(apple.x + apple.width / 2);
    // 3rd card wraps to row 2, back at column 1.
    near(cherry.x, apple.x);
    expect(cherry.y).toBeGreaterThan(apple.y + apple.height / 2);
  });

  test("stays single-column below sm, matching the pre-grid layout", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    for (const [i, name] of [
      "Grid Apple",
      "Grid Banana",
      "Grid Cherry",
    ].entries()) {
      backend.seedRow("ingredients", {
        group_id: seededUser.groupId,
        created_by: seededUser.id,
        updated_by: null,
        name,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100 + i,
        photo_url: null,
        is_community: false,
      });
    }
    // 500px is below the 600px sm breakpoint — resolvedColumns falls back
    // to `columns.xs` (1), the same single-card-per-row layout this
    // component always had.
    await page.setViewportSize({ width: 500, height: 900 });
    await loginAsSeededUser();

    const [apple, banana, cherry] = await Promise.all([
      settledBox(page, "Grid Apple"),
      settledBox(page, "Grid Banana"),
      settledBox(page, "Grid Cherry"),
    ]);

    // Every card starts at the same x (one per row, full width) and stacks
    // strictly downward in name-sorted order.
    near(banana.x, apple.x);
    near(cherry.x, apple.x);
    expect(banana.y).toBeGreaterThan(apple.y);
    expect(cherry.y).toBeGreaterThan(banana.y);
    // Consecutive gap between rows is exactly PantryList's own `gap={14}`
    // (no column-gap contribution, since there's only one column).
    near(banana.y - (apple.y + apple.height), 14);
  });

  test("sizes a row to its tallest card, not its shortest", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    // is_community adds IngredientCard's own 2px top+bottom border (the
    // community indicator tab itself is absolutely positioned and doesn't
    // add to flow height) — a genuine, content-driven ~4px taller card,
    // without needing to fake anything about VirtualizedCardList itself.
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "A Tall Community Item",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 101,
      photo_url: null,
      is_community: true,
    });
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "B Short Item",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 102,
      photo_url: null,
      is_community: false,
    });
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "C Next Row Item",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 103,
      photo_url: null,
      is_community: false,
    });
    // 2 columns: row 1 is [A Tall, B Short], row 2 is [C Next Row].
    await page.setViewportSize({ width: 700, height: 900 });
    await loginAsSeededUser();

    const tall = await settledBox(page, "A Tall Community Item");
    const short = await settledBox(page, "B Short Item");
    const nextRow = await settledBox(page, "C Next Row Item");

    near(tall.y, short.y);
    expect(tall.height).toBeGreaterThan(short.height);

    const gap = 14;
    // Row 2 starts `gap` below the *tallest* card in row 1 (A), not the
    // shortest (B) — this is the assertion that actually distinguishes
    // "row height = tallest card" from "row height = first/shortest card".
    near(nextRow.y - (tall.y + tall.height), gap);
    expect(nextRow.y - (short.y + short.height)).toBeGreaterThan(gap + 1);
  });

  test("keeps infinite-scroll pagination working once cards share a row", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    // PantryList's PAGE_SIZE is 30 — seed past it so a second page only
    // becomes visible after the multi-column virtualizer reports the
    // window scrolling near the end of the first page.
    const names = Array.from(
      { length: 35 },
      (_, i) => `Page Item ${String(i).padStart(2, "0")}`,
    );
    for (const [i, name] of names.entries()) {
      backend.seedRow("ingredients", {
        group_id: seededUser.groupId,
        created_by: seededUser.id,
        updated_by: null,
        name,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100 + i,
        photo_url: null,
        is_community: false,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSeededUser();

    await expect(page.getByText("Page Item 00")).toBeVisible();
    // Not loaded yet — beyond the first 30-item page.
    await expect(page.getByText("Page Item 34")).toHaveCount(0);

    // `mouse.wheel` scrolls whatever's under the (0,0) cursor, which in
    // headless Chromium doesn't reliably reach the window itself — drive
    // `window.scrollTo` directly instead, repeatedly (each page load grows
    // `document.documentElement.scrollHeight`, so one jump isn't always
    // enough to land within the virtualizer's own 600px "near the end"
    // threshold for the *next* page after this one). Passed as a string
    // (not a function) so tsconfig.e2e.json's Node-only `lib` (no `dom`)
    // doesn't choke on the bare `window`/`document` references — this file
    // still type-checks under `tsc -b` like every other e2e spec.
    await expect
      .poll(
        async () => {
          await page.evaluate(
            "window.scrollTo(0, document.documentElement.scrollHeight)",
          );
          return page.getByText("Page Item 34").count();
        },
        { timeout: 5000 },
      )
      .toBeGreaterThan(0);
  });
});

test.describe("Multi-column grid on the other card-list screens", () => {
  test("Recipes list also lays out multiple cards per row at lg+ widths", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    for (const [i, name] of ["Grid Recipe A", "Grid Recipe B"].entries()) {
      backend.seedRow("recipes", {
        group_id: seededUser.groupId,
        created_by: seededUser.id,
        updated_by: null,
        name,
        weight_g: 400,
        total_kcal: 100 + i,
        photo_url: null,
        forked_from_recipe_id: null,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Recipes" }).click();

    const a = await settledBox(page, "Grid Recipe A");
    const b = await settledBox(page, "Grid Recipe B");

    near(b.y, a.y);
    expect(b.x).toBeGreaterThan(a.x + a.width / 2);
  });

  test("Community Pantry list also lays out multiple cards per row at lg+ widths", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    for (const [i, name] of [
      "Grid Community A",
      "Grid Community B",
    ].entries()) {
      backend.seedRow("ingredients", {
        group_id: null,
        created_by: seededUser.id,
        updated_by: null,
        name,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100 + i,
        photo_url: null,
        is_community: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSeededUser();
    await page.goto("/community-pantry");

    const a = await settledBox(page, "Grid Community A");
    const b = await settledBox(page, "Grid Community B");

    near(b.y, a.y);
    expect(b.x).toBeGreaterThan(a.x + a.width / 2);
  });
});
