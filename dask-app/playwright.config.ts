import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI || process.env.DASK_RELEASE_SMOKE),
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.DASK_SMOKE_BASE_URL ?? "http://127.0.0.1:5187",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 5187",
    url: "http://127.0.0.1:5187",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 393, height: 852 }
      }
    }
  ]
});
