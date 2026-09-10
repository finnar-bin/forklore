import { defineConfig, devices } from "@playwright/test";

// Runs the real app (vite --mode test, i.e. .env.test's fake Supabase
// config) against a fully in-process mock backend — see
// e2e/mocks/mockBackend.ts and e2e/README.md for why this never touches a
// real database, honoring the org's "must not connect to databases" policy
// while still driving the real UI/Dexie/outbox code through a browser.
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --mode test --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
