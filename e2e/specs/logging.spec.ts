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
  });
});
