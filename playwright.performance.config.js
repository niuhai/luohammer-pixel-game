import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/perf',
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  timeout: 120_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: 'http://127.0.0.1:4194/luohammer-pixel-game/',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    trace: 'off',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4194 --strictPort',
    url: 'http://127.0.0.1:4194/luohammer-pixel-game/',
    reuseExistingServer: false,
    timeout: 60_000
  }
});
