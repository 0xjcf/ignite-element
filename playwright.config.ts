import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./src/tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    // Functional Tests
    {
      name: "Functional - XState",
      use: { baseURL: "http://localhost:3101" },
    },
    {
      name: "Functional - Redux",
      use: { baseURL: "http://localhost:3201" },
    },
    {
      name: "Functional - MobX",
      use: { baseURL: "http://localhost:3301" },
    },
    // Performance Tests
    {
      name: "Performance - XState",
      use: { baseURL: "http://localhost:3102" },
    },
    {
      name: "Performance - Redux",
      use: { baseURL: "http://localhost:3202" },
    },
    {
      name: "Performance - MobX",
      use: { baseURL: "http://localhost:3302" },
    },

    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    // Functional Tests
    {
      command: "PORT=3101 pnpm run dev:port",
      port: 3101,
      reuseExistingServer: true,
      cwd: "src/examples/v1/xstate",
    },
    {
      command: "PORT=3201 pnpm run dev:port",
      port: 3201,
      reuseExistingServer: true,
      cwd: "src/examples/v1/redux",
    },
    {
      command: "PORT=3301 pnpm run dev:port",
      port: 3301,
      reuseExistingServer: true,
      cwd: "src/examples/v1/mobx",
    },
    // Performance Tests
    {
      command: "PORT=3102 pnpm run dev:port",
      port: 3102,
      reuseExistingServer: false,
      cwd: "src/examples/v1/xstate",
    },
    {
      command: "PORT=3202 pnpm run dev:port",
      port: 3202,
      reuseExistingServer: false,
      cwd: "src/examples/v1/redux",
    },
    {
      command: "PORT=3302 pnpm run dev:port",
      port: 3302,
      reuseExistingServer: false,
      cwd: "src/examples/v1/mobx",
    },
  ],
});
