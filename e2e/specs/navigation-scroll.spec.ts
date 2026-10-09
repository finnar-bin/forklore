import { test, expect } from "../fixtures";

test.describe("Navigation scroll position", () => {
  test.use({ viewport: { width: 390, height: 600 } });

  test("a new screen opens at the top, not at the previous screen's scroll offset", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    for (let i = 0; i < 14; i++) {
      backend.seedRow("ingredients", {
        group_id: seededUser.groupId,
        created_by: seededUser.id,
        updated_by: null,
        name: `Ingredient ${String(i).padStart(2, "0")}`,
        brand: null,
        quantity: 100,
        unit: "g",
        kcal: 100,
        photo_url: null,
        is_community: false,
      });
    }
    await loginAsSeededUser();
    await expect(page.getByText("Ingredient 00")).toBeVisible();
    await page.waitForTimeout(800);
    await expect
      .poll(async () => {
        await page.evaluate("window.scrollTo(0, 500)");
        return page.evaluate("scrollY");
      })
      .toBeGreaterThan(200);

    await page.getByRole("button", { name: "Recipes", exact: true }).click();
    await expect(page.getByPlaceholder("Search recipes")).toBeVisible();
    await page.waitForTimeout(800);

    expect(await page.evaluate("scrollY")).toBe(0);
    const box = (await page.getByPlaceholder("Search recipes").boundingBox())!;
    expect(box.y).toBeGreaterThan(0);
  });
});
