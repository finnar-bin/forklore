import { test, expect } from "../fixtures";

test.describe("Groups", () => {
  test("creates a second group from the groups list", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();

    await page.goto("/groups");
    await page.getByRole("button", { name: "Create group" }).click();
    await page.getByLabel("Name").fill("Second Household");
    await page.getByRole("button", { name: "Create group" }).click();

    await expect(page.getByText("Second Household")).toBeVisible();
  });

  test("generates an invite and a second user accepts it", async ({
    page,
    backend,
    loginAsSeededUser,
    seededUser,
  }) => {
    await loginAsSeededUser();
    await page.goto("/groups");

    await page
      .getByRole("button", {
        name: `Invite someone to ${seededUser.groupName}`,
      })
      .click();
    await page.getByRole("button", { name: "Generate invite" }).click();
    await expect(page.getByLabel("Copy invite link")).toBeVisible();

    const invite = backend.rows("group_invites")[0];
    expect(invite).toBeTruthy();
    const inviteCode = invite.invite_code as string;

    // A second user, with no group of their own yet.
    const secondEmail = `invitee-${Date.now()}@example.com`;
    const secondPassword = "another-good-password";
    const secondUser = backend.seedUser(secondEmail, secondPassword);
    backend.completeProfile(secondUser.id, { daily_kcal_target: 1800 });

    await page.goto("/profile");
    await page.getByRole("button", { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Email").fill(secondEmail);
    await page.getByLabel("Password").fill(secondPassword);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.goto(`/invite/${inviteCode}`);
    await expect(page.getByText(`Join ${seededUser.groupName}?`)).toBeVisible();
    await page.getByRole("button", { name: "Join group" }).click();
    await expect(
      page.getByText(`You've joined ${seededUser.groupName}`),
    ).toBeVisible();

    expect(
      backend
        .rows("group_members")
        .some(
          (m) =>
            m.group_id === seededUser.groupId && m.user_id === secondUser.id,
        ),
    ).toBe(true);
  });
});
