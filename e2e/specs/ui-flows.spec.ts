import { test, expect } from "../fixtures";

test.describe("mobile header and nav", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("Groups icon opens a switcher menu with a Manage groups link", async ({
    page,
    loginAsSeededUser,
    seededUser,
  }) => {
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Groups" }).click();
    await expect(
      page.getByRole("menuitem", { name: seededUser.groupName }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Manage groups" }).click();
    await expect(page).toHaveURL(/\/groups$/);
  });

  test("Converter is a header shortcut on Pantry, not a bottom tab", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();
    await expect(
      page.getByRole("button", { name: "Converter", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Converter", exact: true }).click();
    await expect(page).toHaveURL(/\/converter$/);
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  });
});

test.describe("screens", () => {
  test("Log's Today / All time toggle opens the all-time history", async ({
    page,
    loginAsSeededUser,
    seededUser,
  }) => {
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/groups/${seededUser.groupId}/logs$`),
    );
  });

  test("Progress shows a call to action until a weight is logged", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    await page.getByRole("button", { name: "Log your first weight" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Weight (kg)").fill("70");
    await page.getByRole("button", { name: "Log weight", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("current weight (kg)")).toBeVisible();
  });

  test("Pantry empty state offers an add button", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();
    await page
      .getByRole("button", { name: "Add your first ingredient" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
