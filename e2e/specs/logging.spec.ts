import { test, expect } from "../fixtures";

test.describe("Logging", () => {
  test("logs an ingredient eaten and shows it on the daily log", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Greek Yogurt",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 59,
      photo_url: null,
      is_community: false,
    });
    await loginAsSeededUser();

    await page.getByRole("button", { name: "Log" }).click();
    await page.getByRole("button", { name: "Log an entry" }).click();
    // getByLabel("Ingredient") is ambiguous here — it substring-matches the
    // outgoing screen's own "Add ingredient" FAB, which can still be
    // mounted mid-transition (AnimatedAppShell.tsx's outgoing/current
    // overlap window) — see recipes.spec.ts's own comment on the same
    // ambiguity. Target the combobox role directly with an exact name.
    await page
      .getByRole("combobox", { name: "Ingredient", exact: true })
      .click();
    await page.getByRole("option", { name: /Greek Yogurt/ }).click();
    await page.getByLabel("Quantity eaten").fill("150");
    await page.getByRole("button", { name: "Log this ingredient" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await expect(page.getByText("Greek Yogurt")).toBeVisible();
    // kcalPerUnit(59, 100) * 150 = 88.50
    await expect(page.getByText("88.50 kcal")).toBeVisible();
    // No photo_url on the source ingredient -> LogEntryCard's PhotoThumbnail
    // falls back to its placeholder (no <img>), not an empty/broken one.
    await expect(page.getByRole("img", { name: "Greek Yogurt" })).toHaveCount(
      0,
    );
  });

  // useLogEntryPhotos.ts looks the photo up live off the source ingredient
  // row rather than the (photo-less) log entry itself — see
  // docs/pending-deviations.md ("LogEntryCard now renders a photo on /log
  // and /logs").
  test("shows the source ingredient's photo on a logged entry", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Almonds",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 579,
      photo_url: "https://example.com/almonds.webp",
      is_community: false,
    });
    await loginAsSeededUser();

    await page.getByRole("button", { name: "Log" }).click();
    await page.getByRole("button", { name: "Log an entry" }).click();
    await page
      .getByRole("combobox", { name: "Ingredient", exact: true })
      .click();
    await page.getByRole("option", { name: /Almonds/ }).click();
    await page.getByLabel("Quantity eaten").fill("30");
    await page.getByRole("button", { name: "Log this ingredient" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const photo = page.getByRole("img", { name: "Almonds" });
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute(
      "src",
      "https://example.com/almonds.webp",
    );
  });
});
