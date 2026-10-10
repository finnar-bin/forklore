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
    await expect(page.getByText("728 kcal")).toBeVisible();

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Recipe saved")).toBeVisible();

    const recipe = backend
      .rows("recipes")
      .find((r) => r.name === "Simple Bread");
    expect(recipe?.total_kcal).toBeCloseTo(728, 5);
  });

  test("adds several pantry ingredients back to back with Add another", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    for (const name of ["Flour", "Sugar"]) {
      backend.seedRow("ingredients", {
        group_id: seededUser.groupId,
        created_by: seededUser.id,
        updated_by: null,
        name,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100,
        photo_url: null,
        is_community: false,
      });
    }
    backend.seedRow("recipes", {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      name: "Cake",
      weight_g: 300,
      total_kcal: 0,
      photo_url: null,
      forked_from_recipe_id: null,
    });
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Recipes" }).click();
    await page.getByText("Cake").click();

    await page.getByRole("button", { name: "Add ingredient" }).click();
    await page
      .getByRole("combobox", { name: "Ingredient", exact: true })
      .click();
    await page.getByRole("option", { name: "Flour" }).click();
    await page.getByLabel("Quantity").fill("100");
    await page.getByRole("button", { name: "Add another" }).click();

    // Dialog stays open with the pickers reset, ready for the next one.
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("combobox", { name: "Ingredient", exact: true })
      .click();
    await page.getByRole("option", { name: "Sugar" }).click();
    await page.getByLabel("Quantity").fill("50");
    await page.getByLabel("Quantity").press("Enter");
    await page.keyboard.press("Escape");

    await expect(page.getByText("Flour")).toBeVisible();
    await expect(page.getByText("Sugar")).toBeVisible();
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

  test("keeps Save changes in page flow, below the last ingredient, on mobile", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    const base = {
      group_id: seededUser.groupId,
      created_by: seededUser.id,
      updated_by: null,
      photo_url: null,
    };
    const names = [
      "Oats",
      "Milk",
      "Honey",
      "Banana",
      "Almonds",
      "Chia",
      "Yogurt",
      "Berries",
    ];
    const recipe = backend.seedRow("recipes", {
      ...base,
      name: "Big Bowl",
      weight_g: 800,
      total_kcal: 0,
      forked_from_recipe_id: null,
    });
    for (const name of names) {
      const ingredient = backend.seedRow("ingredients", {
        ...base,
        name,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100,
        is_community: false,
      });
      backend.seedRow("recipe_ingredients", {
        recipe_id: recipe.id,
        ingredient_id: ingredient.id,
        quantity_used: 50,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Recipes", exact: true }).click();
    await page.getByText("Big Bowl").click();

    // Not sticky: mid-scroll the button is still off-screen, below the fold.
    await expect(page.getByText("Berries", { exact: true })).toBeVisible();
    await page.waitForTimeout(800);
    await expect
      .poll(async () => {
        await page.evaluate("window.scrollTo(0, 200)");
        return page.evaluate("scrollY");
      })
      .toBeGreaterThan(0);
    const midScroll = (await page
      .getByRole("button", { name: "Save changes" })
      .boundingBox())!;
    expect(midScroll.y).toBeGreaterThan(844);

    // At the end of the page the last row is fully above the button.
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(400);
    const last = (await page
      .getByText("Berries", { exact: true })
      .boundingBox())!;
    const save = (await page
      .getByRole("button", { name: "Save changes" })
      .boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(save.y);
  });
});
