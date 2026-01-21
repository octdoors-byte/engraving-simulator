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
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
    },
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"], viewport: { width: 393, height: 851 }, deviceScaleFactor: 1 }
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }
    }
  ]
});
