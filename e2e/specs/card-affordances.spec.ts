import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures";

// Issue #66 — IngredientCard/RecipeCard/GroupCard/LogEntryCard each gained:
// a hover-only (gated behind `@media (hover: hover)`) box-shadow elevation
// from `theme/theme.ts`'s `shadows` tokens (sh2 at rest, floating on
// hover), a `role="button"`/`tabIndex`/keydown-Enter-or-Space handler that
// makes the whole card keyboard-operable, and a `:focus-visible` outline
// ring using `theme.palette.primary.main`. GroupMemberKcalCard.tsx was
// deliberately excluded per the reporter's own comment on the issue, and
// gets none of this.
//
// None of these cards have a `data-testid` of their own (same as
// card-grid.spec.ts's own comment on this), so a Playwright `Locator`
// (used below for the plain, non-style actions: visibility, hover, tap,
// keyboard activation) finds one by `getByRole("button", { name })` —
// IngredientCard/RecipeCard/LogEntryCard have no `aria-label`, so their
// accessible name is computed from the whole subtree (name text + kcal
// figures etc.), matched by substring (Playwright's default); GroupCard
// sets an explicit `aria-label={"Open " + group.name}` specifically to
// keep its own name from folding in its nested invite/settings
// IconButtons' labels (see its own comment), so it's matched by that exact
// label instead.
//
// Reading computed style (box-shadow/outline) or `document.activeElement`
// can't go through `locator.evaluate`/`page.evaluate` with a real function
// value the normal way: this file's own TypeScript has no "dom" lib
// (tsconfig.e2e.json's `lib` is `["ES2023"]` — see card-grid.spec.ts's own
// `window.scrollTo` workaround for the same constraint), so any function
// body referencing `document`/`getComputedStyle` has to be passed as a
// string instead — but Playwright only auto-invokes a `pageFunction` (and
// only binds a Locator's own element / a passed `arg` to it) when it's a
// real JS function *value*; for a string it just `eval()`s the text
// verbatim with no implicit call or argument binding at all, function-
// looking syntax or not (confirmed against playwright-core's own
// `evaluate()` — `isFunction: typeof pageFunction === "function"` is
// always `false` for a string). So every string below is a self-invoking
// `(() => { ... })()` expression (whose *call* is what makes `eval` return
// its result rather than an unserializable function reference), and each
// one locates its own element by a raw `document.querySelectorAll`
// (matching `IngredientCard`/`RecipeCard`/`GroupCard`/`LogEntryCard`'s own
// `role="button"` attribute, which no other button in this app sets —
// every native `<button>` gets its "button" role implicitly, not via a
// literal `role` attribute) rather than relying on a bound element/arg.
function findButtonExpr(name: string): string {
  return `Array.from(document.querySelectorAll('[role="button"]')).find(
    (b) => (b.getAttribute("aria-label") || b.textContent || "").includes(${JSON.stringify(name)})
  )`;
}

async function boxShadowOfButton(page: Page, name: string): Promise<string> {
  return page.evaluate<string>(
    `(() => {
      const el = ${findButtonExpr(name)};
      if (!el) throw new Error('no [role="button"] found matching ' + ${JSON.stringify(name)});
      return getComputedStyle(el).boxShadow;
    })()`,
  );
}

async function outlineOfButton(
  page: Page,
  name: string,
): Promise<{ width: string; style: string; color: string }> {
  return page.evaluate<{ width: string; style: string; color: string }>(
    `(() => {
      const el = ${findButtonExpr(name)};
      if (!el) throw new Error('no [role="button"] found matching ' + ${JSON.stringify(name)});
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle, color: s.outlineColor };
    })()`,
  );
}

async function isButtonFocused(page: Page, name: string): Promise<boolean> {
  return page.evaluate<boolean>(
    `(() => {
      const el = ${findButtonExpr(name)};
      return !!el && el === document.activeElement;
    })()`,
  );
}

// Pulls the rgba() component list out of a computed `box-shadow` (e.g.
// "rgba(92, 106, 82, 0.12) 0px 6px 16px") so a hover/rest shadow can be
// checked against `shadows.light/dark`'s `sh2`/`floating` tokens without
// depending on the browser's own serialization order/units for the
// offset/blur values — only the token's own color+alpha is what actually
// distinguishes sh2 from floating (and light from dark).
function shadowRgba(boxShadow: string): number[] {
  const match = boxShadow.match(/rgba?\(([^)]+)\)/);
  if (!match) {
    throw new Error(`no rgba() color found in box-shadow "${boxShadow}"`);
  }
  return match[1].split(",").map((n) => Number(n.trim()));
}

function expectCloseRgba(actual: number[], expected: number[]) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 1));
}

function closeRgba(actual: number[], expected: number[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, i) => Math.abs(value - expected[i]) < 0.05)
  );
}

// Every card's hover box-shadow is `transition: box-shadow 150ms ease`
// (deliberately, per design-system.md's elevation section) — reading
// `getComputedStyle` immediately after `.hover()`/moving the mouse away
// catches the transition mid-flight (still ~the pre-hover value at t=0),
// not its settled end state, so every shadow assertion below polls until
// the token's own color+alpha is reached rather than reading once.
async function expectShadowEventually(
  page: Page,
  name: string,
  expected: number[],
) {
  await expect
    .poll(async () =>
      closeRgba(shadowRgba(await boxShadowOfButton(page, name)), expected),
    )
    .toBe(true);
}

// theme/theme.ts's shadow tokens, mirrored here as the expected rgba
// component lists (see shadowRgba above for why colors only, not offsets).
const LIGHT_SH2 = [92, 106, 82, 0.12];
const LIGHT_FLOATING = [93, 110, 1, 0.35];
const DARK_SH2 = [0, 0, 0, 0.4];
const DARK_FLOATING = [0, 0, 0, 0.5];

// theme/theme.ts's PRIMARY_LIGHT/PRIMARY_DARK, as the rgb triplet a
// `:focus-visible` ring's `outline-color` should resolve to.
const PRIMARY_LIGHT_RGB = [141, 161, 1];
const PRIMARY_DARK_RGB = [167, 192, 128];

function expectCloseRgb(color: string, expected: number[]) {
  const nums = color
    .match(/-?\d+\.?\d*/g)
    ?.map(Number)
    .slice(0, 3);
  if (!nums) throw new Error(`no color numbers found in "${color}"`);
  nums.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 0));
}

// Tabs from wherever focus currently is until the named [role="button"] is
// the active element, then stops — rather than a single scripted
// `el.focus()`, which wouldn't reliably reproduce a real `:focus-visible`
// ring (Chromium keys that pseudo-class off whether the focus change
// itself was caused by a keyboard event, not by prior mouse activity
// elsewhere on the page — exactly the mouse-click-vs-keyboard-tab
// distinction this feature exists to make). A real `Tab` keypress is a
// keyboard-caused focus change no matter what happened before it, so this
// reaches `:focus-visible` state regardless of `loginAsSeededUser`'s own
// preceding mouse clicks/fills.
async function tabUntilFocused(page: Page, name: string, maxTabs = 80) {
  for (let i = 0; i < maxTabs; i++) {
    if (await isButtonFocused(page, name)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(
    `could not reach a [role="button"] matching "${name}" via Tab within ${maxTabs} presses`,
  );
}

// Mirrors card-grid.spec.ts's own `settledBox` — VirtualizedCardList's
// initial `estimateSize`-then-ResizeObserver-correction (and, on the
// Recipes/Group/Log routes reached via a click rather than a fresh
// `loginAsSeededUser`, AnimatedAppShell's own push/pop transition) can
// still reposition an item, or scroll the window to compensate, for a
// little while after it first becomes visible. A real mouse hovering
// something that then moves/scrolls out from under it loses `:hover`
// exactly like this — so hovering before that settles is real flake, not
// a false positive to paper over: wait for a stable position first.
async function settleThenHover(page: Page, locator: Locator) {
  await expect
    .poll(async () => (await locator.boundingBox())?.y, { timeout: 3000 })
    .not.toBeNull();
  await page.waitForTimeout(150);
  await locator.hover();
}

// Mirrors src/features/logging/api.ts's own todayLocalDate() (local, not
// UTC, calendar date) — duplicated rather than imported since no existing
// e2e spec imports from src/ (tsconfig.e2e.json's `include` is just
// `["playwright.config.ts", "e2e"]`).
function todayLocalDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

test.describe("Card hover/focus/keyboard affordances (issue #66)", () => {
  test("IngredientCard: hover elevates using light-mode tokens and reverts, is keyboard-reachable with a focus-visible ring, and Enter opens its detail page", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Hover Test Oats",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 389,
      photo_url: null,
      is_community: false,
    });
    await loginAsSeededUser();

    const name = "Hover Test Oats";
    const card = page.getByRole("button", { name });
    await expect(card).toBeVisible();

    expectCloseRgba(shadowRgba(await boxShadowOfButton(page, name)), LIGHT_SH2);

    await settleThenHover(page, card);
    await expectShadowEventually(page, name, LIGHT_FLOATING);

    // Moving the mouse elsewhere reverts it — no stuck hover state.
    await page.mouse.move(0, 0);
    await expectShadowEventually(page, name, LIGHT_SH2);

    await tabUntilFocused(page, name);
    const outline = await outlineOfButton(page, name);
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    expectCloseRgb(outline.color, PRIMARY_LIGHT_RGB);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/groups/${seededUser.groupId}/pantry/[^/]+$`),
    );
  });

  test("RecipeCard: same hover treatment, and Space activates it into its detail page", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("recipes", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Hover Test Bread",
      weight_g: 500,
      total_kcal: 1200,
      photo_url: null,
      forked_from_recipe_id: null,
    });
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Recipes" }).click();

    const name = "Hover Test Bread";
    const card = page.getByRole("button", { name });
    await expect(card).toBeVisible();

    expectCloseRgba(shadowRgba(await boxShadowOfButton(page, name)), LIGHT_SH2);
    await settleThenHover(page, card);
    await expectShadowEventually(page, name, LIGHT_FLOATING);
    await page.mouse.move(0, 0);
    await expectShadowEventually(page, name, LIGHT_SH2);

    await tabUntilFocused(page, name);
    const outline = await outlineOfButton(page, name);
    expect(outline.style).toBe("solid");
    expectCloseRgb(outline.color, PRIMARY_LIGHT_RGB);

    await page.keyboard.press("Space");
    await expect(page).toHaveURL(
      new RegExp(`/groups/${seededUser.groupId}/recipes/[^/]+$`),
    );
  });

  test("GroupCard: same hover treatment (aria-label scoped to just the card), and Enter navigates into the group", async ({
    page,
    loginAsSeededUser,
    seededUser,
  }) => {
    await loginAsSeededUser();
    await page.goto("/groups");

    const name = `Open ${seededUser.groupName}`;
    const card = page.getByRole("button", { name });
    await expect(card).toBeVisible();
    // The nested invite/settings IconButtons (owner-only) render inside
    // this same card — an unlabeled role="button" div would otherwise
    // absorb their aria-labels into its own accessible name (its own
    // comment in GroupCard.tsx). Confirms that didn't regress: exactly one
    // match for the card's own scoped name.
    await expect(card).toHaveCount(1);

    expectCloseRgba(shadowRgba(await boxShadowOfButton(page, name)), LIGHT_SH2);
    await settleThenHover(page, card);
    await expectShadowEventually(page, name, LIGHT_FLOATING);
    await page.mouse.move(0, 0);
    await expectShadowEventually(page, name, LIGHT_SH2);

    await tabUntilFocused(page, name);
    const outline = await outlineOfButton(page, name);
    expect(outline.style).toBe("solid");
    expectCloseRgb(outline.color, PRIMARY_LIGHT_RGB);

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/groups/${seededUser.groupId}/pantry$`),
    );
  });

  test("LogEntryCard: shows the same hover/focus/keyboard affordances when onClick is passed (its only real usage, both on DailyLog and AllTimeLog), and Enter opens the edit dialog", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    // Both DailyLog.tsx and AllTimeLog.tsx always pass `onClick` to every
    // LogEntryCard they render — there is no screen in the app that ever
    // renders one without it, so the `onClick`-absent branch (no
    // role/tabIndex/hover styling, matching the existing
    // `cursor: onClick ? "pointer" : undefined` pattern) isn't reachable
    // through a real user flow for this e2e suite to exercise; it's
    // covered by the source sharing that exact same `onClick ? ... :
    // undefined` conditional as the pre-existing `cursor` line.
    backend.seedRow("log_entries", {
      group_id: seededUser.groupId,
      logged_for: seededUser.id,
      created_by: seededUser.id,
      source_ingredient_id: null,
      source_recipe_id: null,
      name: "Hover Test Snack",
      kcal: 120,
      quantity: 100,
      unit: "g",
      meal_type: null,
      logged_at: todayLocalDate(),
    });
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Log" }).click();

    const name = "Hover Test Snack";
    const card = page.getByRole("button", { name });
    await expect(card).toBeVisible();

    expectCloseRgba(shadowRgba(await boxShadowOfButton(page, name)), LIGHT_SH2);
    await settleThenHover(page, card);
    await expectShadowEventually(page, name, LIGHT_FLOATING);
    await page.mouse.move(0, 0);
    await expectShadowEventually(page, name, LIGHT_SH2);

    await tabUntilFocused(page, name);
    const outline = await outlineOfButton(page, name);
    expect(outline.style).toBe("solid");
    expectCloseRgb(outline.color, PRIMARY_LIGHT_RGB);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("hover/rest box-shadow and the focus-visible ring switch to the dark-mode tokens after toggling dark mode", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Dark Mode Oats",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 389,
      photo_url: null,
      is_community: false,
    });
    await loginAsSeededUser();

    await page.goto("/profile");
    // MUI's Switch sets an explicit `role="switch"` on its input, not the
    // default `checkbox` role a bare `<input type="checkbox">` gets.
    await page.getByRole("switch", { name: "Toggle dark mode" }).click();
    await page.goto(`/groups/${seededUser.groupId}/pantry`);

    const name = "Dark Mode Oats";
    await expect(page.getByRole("button", { name })).toBeVisible();

    expectCloseRgba(shadowRgba(await boxShadowOfButton(page, name)), DARK_SH2);
    await settleThenHover(page, page.getByRole("button", { name }));
    await expectShadowEventually(page, name, DARK_FLOATING);

    await tabUntilFocused(page, name);
    const outline = await outlineOfButton(page, name);
    expectCloseRgb(outline.color, PRIMARY_DARK_RGB);
  });

  test.describe("touch-emulated viewport", () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });

    test("(hover: hover) doesn't match on a touch device, and tapping a card leaves no stuck hover box-shadow", async ({
      page,
      loginAsSeededUser,
      backend,
      seededUser,
    }) => {
      const hoverHoverMatches = await page.evaluate<boolean>(
        "(() => window.matchMedia('(hover: hover)').matches)()",
      );
      expect(hoverHoverMatches).toBe(false);

      // A LogEntryCard's tap opens an edit dialog as an overlay rather than
      // navigating away, so the card itself stays mounted and its
      // box-shadow can still be read right after the tap.
      backend.seedRow("log_entries", {
        group_id: seededUser.groupId,
        logged_for: seededUser.id,
        created_by: seededUser.id,
        source_ingredient_id: null,
        source_recipe_id: null,
        name: "Touch Test Snack",
        kcal: 80,
        quantity: 50,
        unit: "g",
        meal_type: null,
        logged_at: todayLocalDate(),
      });
      await loginAsSeededUser();
      await page.getByRole("button", { name: "Log" }).click();

      const name = "Touch Test Snack";
      const card = page.getByRole("button", { name });
      await expect(card).toBeVisible();

      const rest = await boxShadowOfButton(page, name);
      expectCloseRgba(shadowRgba(rest), LIGHT_SH2);

      await card.tap();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await boxShadowOfButton(page, name)).toEqual(rest);
    });
  });
});
