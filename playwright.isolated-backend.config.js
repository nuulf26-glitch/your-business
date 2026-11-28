import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/isolated-backend',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/isolated-backend/results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --config vite.config.isolated-e2e.js',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
