import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/functional-visual",
  fullyParallel: false,
  workers: 1,
  timeout: 20 * 60 * 1000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["json", { outputFile: "artifacts/functional-visual/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
