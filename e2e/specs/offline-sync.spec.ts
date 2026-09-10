import { test, expect } from "../fixtures";

// Exercises the actual offline-first architecture (frontend-architecture.md
// "Offline sync — outbox pattern"): every write lands in Dexie immediately,
// regardless of connectivity, then drains through the outbox once back
// online.
//
// Two separate "offline" toggles are needed here, not one: Playwright's
// context-level offline mode affects real browser network state
// (navigator.onLine, and the `online` event outbox.ts listens for) but
// never touches a request this mock answers via `route.fulfill()` — that
// never reaches the network layer offline mode blocks. So
// `backend.setOffline(true)` (see mockBackend.ts) is what actually makes
// the outbox's own request fail and enter its retry/backoff path; the
// context-level toggle alongside it is what fires the reconnect signal
// outbox.ts's own `online` listener expects.
test("creates an ingredient while offline, then syncs once back online", async ({
  page,
  context,
  loginAsSeededUser,
  backend,
}) => {
  await loginAsSeededUser();

  await context.setOffline(true);
  backend.setOffline(true);

  await page.getByRole("button", { name: "Add ingredient" }).click();
  await page.getByLabel("Name").fill("Offline Oats");
  await page.getByLabel("Quantity").fill("100");
  await page.getByLabel("Unit").click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  await page.getByLabel("Kcal").fill("389");
  await page.getByRole("button", { name: "Add ingredient" }).click();

  // Optimistic write: visible locally straight from Dexie, with no
  // connectivity at all.
  await expect(page.getByText("Offline Oats")).toBeVisible();
  expect(
    backend.rows("ingredients").some((i) => i.name === "Offline Oats"),
  ).toBe(false);

  await context.setOffline(false);
  backend.setOffline(false);

  // The outbox's own backoff (1s, 2s, 4s, ...) means this lands within a
  // few seconds of reconnecting, not instantly.
  await expect
    .poll(
      () => backend.rows("ingredients").some((i) => i.name === "Offline Oats"),
      {
        timeout: 15_000,
      },
    )
    .toBe(true);
});
