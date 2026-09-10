import { test, expect } from "../fixtures";

test.describe("Authentication", () => {
  test("logs in with email/password and reaches the app", async ({
    page,
    backend,
  }) => {
    const user = backend.seedUser(
      "login@example.com",
      "correct-horse-battery-staple",
    );
    backend.completeProfile(user.id, { daily_kcal_target: 2000 });
    backend.seedGroup({ name: "Kitchen Crew", ownerId: user.id });

    await page.goto("/login");
    await page.getByLabel("Email").fill("login@example.com");
    await page.getByLabel("Password").fill("correct-horse-battery-staple");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/groups$/);
    await expect(page.getByText("Kitchen Crew")).toBeVisible();
  });

  test("shows an error for wrong credentials", async ({ page, backend }) => {
    backend.seedUser("real@example.com", "the-real-password");

    await page.goto("/login");
    await page.getByLabel("Email").fill("real@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("signs up, lands in onboarding when no email confirmation is required", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.getByLabel("Email").fill(`new-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("a-brand-new-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("signup requiring email confirmation shows the check-your-email message", async ({
    page,
  }) => {
    const email = `confirm-me+unconfirmed-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-brand-new-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("logs out and returns to the login screen", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();

    await page.goto("/profile");
    await page.getByRole("button", { name: /log out/i }).click();
    // Logout clears Dexie entirely (frontend-architecture.md "Logout
    // behavior") and has no pending outbox items to warn about here, so it
    // completes immediately with no confirmation dialog.
    await expect(page).toHaveURL(/\/login$/);
  });
});
