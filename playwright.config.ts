import { defineConfig, devices } from "@playwright/test";

/*
 * End-to-end tests run against the dev server with DEV_LOGIN=true and a
 * seeded local database (`npm run db:up && npm run db:migrate && npm run db:seed`).
 *
 *   npm run test:e2e                          → starts `next dev` on :3000 (or reuses one)
 *   E2E_BASE_URL=http://localhost:3100 npm run test:e2e   → use a server you already run
 *                                                           (start it with DEV_LOGIN=true NEXT_DEV_DISK_CACHE=off)
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Compiles the routes once, in order, before the parallel run starts.
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // `next dev` renders much more slowly than a production build, and slower still
  // under load: two workers and a generous expectation timeout keep the run steady.
  workers: 2,
  expect: { timeout: 12_000 },
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /admin\.spec\.ts/ },
    // The admin suite changes site-wide state (featured posts, announcements, settings),
    // so it runs on its own after everything else.
    { name: "admin", use: { ...devices["Desktop Chrome"] }, testMatch: /admin\.spec\.ts/, dependencies: ["desktop"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { DEV_LOGIN: "true", NEXT_DEV_DISK_CACHE: "off" },
      },
});
