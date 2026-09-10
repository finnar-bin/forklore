import { test, expect } from "../fixtures";

test.describe("Recipes", () => {
  test("creates a recipe, adds a pantry ingredient, and saves the computed kcal total", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Flour",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 364,
      photo_url: null,
      is_community: false,
    });
    await loginAsSeededUser();

    await page.getByRole("button", { name: "Recipes" }).click();
    await page.getByRole("button", { name: "Add recipe" }).click();
    await page.getByLabel("Name").fill("Simple Bread");
    await page.getByLabel("Weight").fill("500");
    await page.getByRole("button", { name: "Add recipe" }).click();

    await expect(page).toHaveURL(/\/recipes\/[^/]+$/);

    await page.getByRole("button", { name: "Add ingredient" }).click();
    // getByLabel("Ingredient") is ambiguous here — it substring-matches the
    // dialog's own "Add ingredient" accessible name too — so target the
    // combobox role directly with an exact name instead.
    await page
      .getByRole("combobox", { name: "Ingredient", exact: true })
      .click();
    await page.getByRole("option", { name: "Flour" }).click();
    await page.getByLabel("Quantity").fill("200");
    await page.getByRole("button", { name: "Add ingredient" }).click();

    // Client-side live preview (RecipeDetail.tsx) mirrors the server
    // trigger's formula: kcalPerUnit(364, 100) * 200 = 728.00.
    await expect(page.getByText("728.00 kcal")).toBeVisible();

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Recipe saved")).toBeVisible();

    const recipe = backend
      .rows("recipes")
      .find((r) => r.name === "Simple Bread");
    expect(recipe?.total_kcal).toBeCloseTo(728, 5);
  });

  test("deletes a recipe", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("recipes", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Doomed Casserole",
      weight_g: 400,
      total_kcal: 0,
      photo_url: null,
      forked_from_recipe_id: null,
    });
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Recipes" }).click();

    await page.getByText("Doomed Casserole").click();
    await page.getByRole("button", { name: "Recipe actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete recipe" }).click();

    await expect(page).toHaveURL(/\/recipes$/);
    await expect(page.getByText("Doomed Casserole")).toHaveCount(0);
  });
});
