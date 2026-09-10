/* oxlint-disable react-hooks/rules-of-hooks -- Playwright's fixture `use`
   callback isn't a React hook; the rule just pattern-matches the name. */
import { test as base, expect } from "@playwright/test";
import { MockBackend } from "./mocks/mockBackend";

const MOCK_SUPABASE_URL = "https://mock.supabase.test";

export interface SeededUser {
  id: string;
  email: string;
  password: string;
  groupId: string;
  groupName: string;
}

export const test = base.extend<{
  backend: MockBackend;
  // A user seeded with a completed profile + one group, so login lands
  // straight in the app (RequireOnboarded/RequireGroupMember gates already
  // satisfied) instead of the onboarding wizard. Most specs besides
  // onboarding.spec.ts want this.
  seededUser: SeededUser;
  // Logs seededUser in through the real login form (mocked network) and
  // waits for the app to land past the auth/onboarding gates.
  loginAsSeededUser: () => Promise<void>;
}>({
  // `auto: true` — every test needs the mock backend installed before its
  // first navigation, even one that never destructures `backend` itself
  // (e.g. a plain signup flow with nothing to seed). Without `auto`,
  // Playwright only initializes a fixture a test actually requests, and an
  // uninstalled mock means every Supabase call falls through to a real DNS
  // lookup for the fake VITE_SUPABASE_URL host — a real, if harmless,
  // network attempt this suite exists specifically to avoid (see
  // e2e/README.md).
  backend: [
    async ({ page }, use) => {
      const backend = new MockBackend(MOCK_SUPABASE_URL);
      await backend.install(page);
      await use(backend);
    },
    { auto: true },
  ],

  seededUser: async ({ backend }, use) => {
    const email = `test-${crypto.randomUUID()}@example.com`;
    const password = "correct-horse-battery-staple";
    const user = backend.seedUser(email, password, { name: "Test User" });
    backend.completeProfile(user.id, {
      birthdate: "1990-01-01",
      sex: "female",
      height_cm: 170,
      activity_level: "moderate",
      goal_type: "maintain",
      goal_weight_kg: 65,
      goal_pace: null,
      daily_kcal_target: 2000,
      meal_breakdown_enabled: false,
    });
    const group = backend.seedGroup({
      name: "Test Household",
      ownerId: user.id,
    });
    await use({
      id: user.id,
      email,
      password,
      groupId: group.id as string,
      groupName: group.name as string,
    });
  },

  loginAsSeededUser: async ({ page, seededUser }, use) => {
    await use(async () => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(seededUser.email);
      await page.getByLabel("Password").fill(seededUser.password);
      await page.getByRole("button", { name: "Log in" }).click();
      // Lands on /groups first — no group has been explicitly picked yet in
      // this browser context (resolveDefaultGroupId), so HomeRedirect can't
      // guess one. Picking the seeded group's card is what actually stores
      // it and enters its pantry (GroupCard.tsx's selectGroup).
      await expect(page).toHaveURL(/\/groups$/);
      await page.getByText(seededUser.groupName).click();
      await expect(page).toHaveURL(
        new RegExp(`/groups/${seededUser.groupId}/pantry`),
      );
    });
  },
});

export { expect };
export { MOCK_SUPABASE_URL };
