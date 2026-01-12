import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  retries: 0,
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm dev -- --port 5174",
    port: 5174,
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

