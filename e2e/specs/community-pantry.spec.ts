import { test, expect } from "../fixtures";

test.describe("Community pantry", () => {
  test("is browsable directly, and merges into a group's pantry once opted in", async ({
    page,
    loginAsSeededUser,
    backend,
    seededUser,
  }) => {
    backend.seedRow("ingredients", {
      group_id: null,
      created_by: seededUser.id,
      updated_by: null,
      name: "Community Rice",
      brand: null,
      quantity: 100,
      unit: "g",
      kcal: 130,
      photo_url: null,
      is_community: true,
    });
    await loginAsSeededUser();

    await page.goto("/community-pantry");
    await expect(page.getByText("Community Rice")).toBeVisible();

    // Not opted in yet — the group's own pantry doesn't show it.
    await page.goto(`/groups/${seededUser.groupId}/pantry`);
    await expect(page.getByText("Community Rice")).toHaveCount(0);

    await page.getByRole("button", { name: "Pantry settings" }).click();
    await page.getByRole("radio", { name: "Yes" }).check();
    await page.getByRole("button", { name: "Close" }).click();

    await expect(page.getByText("Community Rice")).toBeVisible();
    expect(
      backend.rows("groups").find((g) => g.id === seededUser.groupId)
        ?.community_pantry_enabled,
    ).toBe(true);
  });
});
