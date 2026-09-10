import { test, expect } from "../fixtures";

// Drives the full 6-step OnboardingStepper (About you -> Body metrics ->
// Activity level -> Goal -> Calorie target -> Group) end to end for a
// freshly signed-up user, then verifies the app actually reflects it
// afterwards (RequireOnboarded lets them through, the group they created
// during onboarding is there).
test("completes onboarding (profile + calorie target + create a group) and reaches the app", async ({
  page,
  backend,
}) => {
  const email = `onboarding-${Date.now()}@example.com`;
  const password = "a-brand-new-password";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // Step 1: About you
  await page.getByLabel("Name").fill("Ada Lovelace");
  // MUI X DatePicker renders a sectioned field (separate contenteditable
  // spans per Month/Day/Year, not a single fillable <input> — the real
  // <input> is aria-hidden) — click to focus the first section, then type
  // digits straight through; each section auto-advances once full.
  await page.getByRole("group", { name: "Birthdate" }).click();
  await page.keyboard.type("01011990");
  await page.getByRole("radio", { name: "Female" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: Body metrics
  await page.getByLabel("Height (cm)").fill("170");
  await page.getByLabel("Current weight (kg)").fill("65");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: Activity level
  await page.getByText("Moderately active").click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: Goal
  await page.getByText("Maintain weight").click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: Calorie target — "Maintain your weight" is the only card for a
  // maintain goal (CalorieTargetStep.tsx); accept the computed default.
  await page.getByText("Maintain your weight").click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 6: Group — create one, the mandatory final step.
  await expect(page.getByText("Create a group")).toBeVisible();
  await page.getByLabel("Name").fill("Ada's Household");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByText("You're in a group")).toBeVisible();

  await page.getByRole("button", { name: "Get started" }).click();

  // completeOnboarding succeeded and a group exists -> lands past every
  // gate, either straight into the new group's pantry or /groups (both are
  // valid per resolveDefaultGroupId — no group has been explicitly picked
  // yet in this fresh browser context).
  await expect(page).toHaveURL(/\/(groups(\/[^/]+\/pantry)?)$/);

  const profile = backend
    .rows("profiles")
    .find((p) => p.name === "Ada Lovelace");
  expect(profile?.daily_kcal_target).toBeGreaterThan(0);
  expect(backend.rows("groups").some((g) => g.name === "Ada's Household")).toBe(
    true,
  );
});
