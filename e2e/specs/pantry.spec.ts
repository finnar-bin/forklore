import { test, expect } from "../fixtures";

test.describe("Pantry", () => {
  test("creates an ingredient and shows it in the list with formatted kcal", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();

    await page.getByRole("button", { name: "Add ingredient" }).click();
    await page.getByLabel("Name").fill("Rolled Oats");
    await page.getByLabel("Quantity").fill("100");
    await page.getByLabel("Unit").click();
    await page.getByRole("option", { name: "g", exact: true }).click();
    await page.getByLabel("Kcal").fill("389");
    await page.getByRole("button", { name: "Add ingredient" }).click();

    await expect(page.getByText("Rolled Oats")).toBeVisible();
    // kcalPerUnit (src/lib/kcal.ts): 389 / 100 = 3.89, .toFixed(2)-formatted
    // everywhere per CLAUDE.md's kcal display convention.
    await expect(page.getByText("389.00 kcal")).toBeVisible();
    await expect(page.getByText("3.89/g")).toBeVisible();
  });

  test("edits an ingredient from its detail page", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Peanut Butter",
      brand: null,
      quantity: 32,
      unit: "g",
      kcal: 190,
      photo_url: null,
      is_community: false,
    });
    await loginAsSeededUser();

    await page.getByText("Peanut Butter").click();
    await expect(page).toHaveURL(/\/pantry\/[^/]+$/);

    await page.getByLabel("Kcal").fill("200");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Ingredient saved")).toBeVisible();

    await page.goBack();
    await expect(page.getByText("200.00 kcal")).toBeVisible();
  });

  test("deletes an ingredient", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Stale Bread",
      brand: null,
      quantity: 1,
      unit: "piece",
      kcal: 80,
      photo_url: null,
      is_community: false,
    });
    await loginAsSeededUser();

    await page.getByText("Stale Bread").click();
    await page.getByRole("button", { name: "Ingredient actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete ingredient" }).click();

    await expect(page).toHaveURL(/\/pantry$/);
    await expect(page.getByText("Stale Bread")).toHaveCount(0);
  });
});
