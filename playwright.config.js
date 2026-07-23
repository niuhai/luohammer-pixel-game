import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 配置
 *
 * 自动启动 vite dev server 并在 Chromium 中运行 E2E 测试。
 * 用法：npx playwright test
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,          // 像素游戏共享 localStorage，串行更稳定
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                    // 单 worker 避免端口/localStorage 冲突
  reporter: process.env.CI ? 'line' : [['list', { printSteps: true }]],
  timeout: 60_000,               // 单测超时 60s（游戏场景加载较慢）
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 900, height: 560 }   // 接近 GAME_WIDTH/HEIGHT
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
