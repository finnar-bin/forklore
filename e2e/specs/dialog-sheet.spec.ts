import { test, expect } from "../fixtures";

// Real on-screen keyboards can't be emulated here, so the second test fakes
// one by shrinking the same CSS vars useVisualViewportVars drives.
test.describe("mobile dialog sheet", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("docks to the bottom edge, full width", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Add ingredient" }).click();
    const paper = page.locator(".MuiDialog-paper");
    await expect(paper).toBeVisible();
    await page.waitForTimeout(400);
    const box = (await paper.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(389);
    expect(box.y + box.height).toBeGreaterThanOrEqual(799);
  });

  test("lifts above a shrunken visual viewport and keeps the submit button visible", async ({
    page,
    loginAsSeededUser,
  }) => {
    await loginAsSeededUser();
    await page.getByRole("button", { name: "Add ingredient" }).click();
    await page.waitForTimeout(400);
    await page.evaluate(
      'document.documentElement.style.setProperty("--vv-height", "450px")',
    );
    await page.waitForTimeout(200);
    const paper = (await page.locator(".MuiDialog-paper").boundingBox())!;
    expect(paper.y + paper.height).toBeLessThanOrEqual(451);
    const submit = (await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add ingredient", exact: true })
      .boundingBox())!;
    expect(submit.y + submit.height).toBeLessThanOrEqual(451);
  });
});
