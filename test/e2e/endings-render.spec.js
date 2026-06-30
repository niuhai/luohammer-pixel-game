import { test, expect } from '@playwright/test';

/**
 * L3 E2E：结局场景渲染
 *
 * 覆盖：注入结局节点存档 → 继续游戏 → 结局场景渲染 → 标题/描述可见
 */

test.describe('结局场景渲染', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
    });
    await page.reload();
  });

  test('从 ending_scholar 节点进入结局场景', async ({ page }) => {
    // 注入存档：currentNode = ending_scholar（isEnding: true 的早期分支结局）
    await page.evaluate(() => {
      const state = {
        pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [], history: [], achievements: [],
        gameStartTime: Date.now() - 60000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    });

    await page.reload();
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });

    // 点击"继续游戏"
    const continueBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await expect(continueBtn).toBeVisible({ timeout: 8000 });
    await continueBtn.click();

    // 结局场景应渲染：ui-ending-overlay 可见 + 标题非空（GameScene preload 较慢）
    await expect(page.locator('#ui-ending-overlay')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#ui-ending-title')).not.toBeEmpty({ timeout: 15_000 });

    // 截图留档
    await page.screenshot({ path: 'test/e2e/screenshots/ending-scholar.png', fullPage: false });
  });

  test('从 ending_ordinary 节点进入结局场景', async ({ page }) => {
    await page.evaluate(() => {
      const state = {
        pride: 4, wealth: 4, reputation: 3, failures: 1, pressure: 3, trust: 4,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_ordinary',
        flags: [], triggeredEvents: [], history: [], achievements: [],
        gameStartTime: Date.now() - 60000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    });

    await page.reload();
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }).click();

    await expect(page.locator('#ui-ending-overlay')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#ui-ending-title')).not.toBeEmpty({ timeout: 15_000 });

    await page.screenshot({ path: 'test/e2e/screenshots/ending-ordinary.png', fullPage: false });
  });

  test('结局场景应显示属性统计摘要', async ({ page }) => {
    await page.evaluate(() => {
      const state = {
        pride: 7, wealth: 6, reputation: 5, failures: 2, pressure: 4, trust: 6,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [], history: [], achievements: [],
        gameStartTime: Date.now() - 60000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    });

    await page.reload();
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }).click();

    await expect(page.locator('#ui-ending-overlay')).toBeVisible({ timeout: 15_000 });

    // 结局场景应包含描述或统计信息
    const descEl = page.locator('#ui-ending-desc');
    const statsEl = page.locator('#ui-ending-stats');
    const descVisible = await descEl.isVisible().catch(() => false);
    const statsVisible = await statsEl.isVisible().catch(() => false);
    expect(descVisible || statsVisible).toBeTruthy();
  });
});
