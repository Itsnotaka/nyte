import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";

const authFile = join("playwright", ".auth", "user.json");

export default defineConfig({
  testDir: "./playwright",
  outputDir: "playwright/test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    reuseExistingServer: true,
    stderr: "pipe",
    stdout: "ignore",
    timeout: 120_000,
    url: "http://localhost:3000",
  },
  projects: [
    {
      name: "public",
      testMatch: "**/public.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
      },
    },
    {
      name: "app",
      dependencies: ["setup"],
      testMatch: "**/app-shell.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
    },
  ],
});
