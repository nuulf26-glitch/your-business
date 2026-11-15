import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/responsive",
  fullyParallel: false,
  workers: 1,
  timeout: 15 * 60 * 1000,
  expect: { timeout: 8000 },
  reporter: [["list"], ["json", { outputFile: "artifacts/responsive/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    reducedMotion: "reduce",
    screenshot: "off",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/design-showcase",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
