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
    // --host 127.0.0.1 pins vite to the IPv4 loopback explicitly — left as
    // the default `localhost`, Node resolves it however the runner's
    // resolver orders it, which on some CI hosts is IPv6-only (`::1`).
    // Vite then logs "ready" and prints a working `localhost` URL, but
    // Playwright's own health check below (hardcoded to the IPv4 baseURL)
    // can never reach it and times out — the server genuinely never
    // failed, it just wasn't listening on the address being polled.
    command: `npx vite --mode test --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // A cold CI runner (fresh npm ci, no pre-warmed vite/esbuild caches) is
    // slower to come up than a warm local machine — 60s wasn't always
    // enough. stdout/stderr piped through so a genuine startup failure
    // (vs. just slow, or listening on the wrong address) is visible in CI
    // logs instead of silently swallowed.
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
