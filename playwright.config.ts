import path from "path";
import { defineConfig, devices } from "@playwright/test";

const tempRoot = process.env.TEMP ?? process.cwd();
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? path.join(tempRoot, "ksim-playwright-artifacts");

export default defineConfig({
  testDir: "tests/e2e",
  retries: 0,
  outputDir,
  preserveOutput: "always",
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
    acceptDownloads: true
  },
  webServer: {
    command: "npm run dev -- --port 5174",
    port: 5174,
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "edge",
      use: { ...devices["Desktop Edge"] }
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] }
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] }
    }
  ]
});
