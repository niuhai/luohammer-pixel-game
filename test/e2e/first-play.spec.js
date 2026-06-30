import { test, expect } from '@playwright/test';

/**
 * L3 E2E：首次游玩全流程
 *
 * 覆盖：标题页 → 开场动画跳过 → 天赋选择 → 进入游戏 → 首个选择 → 状态变化
 *
 * 注：Phaser 游戏 preload 阶段需加载图片资源，game scene 元素需较长超时。
 */

test.describe('首次游玩流程', () => {
  test.beforeEach(async ({ page }) => {
    // 收集控制台错误
    page._consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') page._consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => page._consoleErrors.push(err.message));

    await page.goto('/');
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
    });
    await page.reload();
  });

  test('从标题页进入游戏并完成首个选择', async ({ page }) => {
    // === 1. 标题页加载 ===
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    const startBtn = page.locator('#ui-boot-buttons button', { hasText: '开始游戏' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // === 2. 开场动画：点击 overlay 跳过（skip 在 600ms 后启用） ===
    await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500); // 等 skip 启用
    await page.locator('#ui-intro-overlay').click({ force: true });

    // === 3. 天赋选择：等待 GameScene 加载完成（preload 图片可能较慢） ===
    await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 25_000 });

    const talentCards = page.locator('#ui-talent-cards .ui-talent-card');
    await expect(talentCards.first()).toBeVisible({ timeout: 5_000 });
    const cardCount = await talentCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(3);

    // 点击前两个天赋
    await talentCards.nth(0).click();
    await talentCards.nth(1).click();

    // 确认按钮启用后点击
    const confirmBtn = page.locator('#ui-talent-confirm');
    await expect(confirmBtn).not.toBeDisabled({ timeout: 5_000 });
    await confirmBtn.click();

    // === 4. 阶段结算画面：intro 是 youth 阶段入口，会触发 _showStageSettlement ===
    // 等待结算画面出现并点击"继续"按钮（或等待 5s 自动关闭）
    const settlementOverlay = page.locator('.ui-settlement-overlay.visible');
    if (await settlementOverlay.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const continueSettlement = page.locator('#ui-settlement-continue');
      await continueSettlement.click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(500); // 等关闭动画
    }

    // === 5. 进入游戏场景：章节名应可见 + 对话框/选项至少有一个可见 ===
    await expect(page.locator('#ui-chapter')).toHaveClass(/visible/, { timeout: 15_000 });
    await expect(page.locator('#ui-chapter-name')).not.toBeEmpty({ timeout: 15_000 });

    // 对话框可能在打字机效果中，给一定时间
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/, { timeout: 10_000 });
    const dialogVisible = await page.locator('#ui-dialog').isVisible().catch(() => false);
    const choicesVisible = await page.locator('#ui-choices .ui-choice-btn').first().isVisible().catch(() => false);
    expect(dialogVisible || choicesVisible).toBeTruthy();

    // === 6. 点击首个选项，验证状态变化 ===
    if (choicesVisible) {
      await page.locator('#ui-choices .ui-choice-btn').first().click();
      await page.waitForTimeout(2000);
      // 仍在游戏中
      const stillInGame = await page.locator('#ui-chapter').isVisible();
      expect(stillInGame).toBeTruthy();
    }

    await page.screenshot({ path: 'test/e2e/screenshots/first-play-after-choice.png', fullPage: false });
  });

  test('标题页"成就图鉴"按钮可打开图鉴', async ({ page }) => {
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    const galleryBtn = page.locator('#ui-boot-buttons button', { hasText: '成就图鉴' });
    await expect(galleryBtn).toBeVisible();
    await galleryBtn.click();
    // 图鉴弹层应出现
    await expect(page.locator('#ui-achievement-gallery-overlay')).toBeVisible({ timeout: 8_000 });
  });

  test('首次进入标题页应显示"开始游戏"而非"继续游戏"', async ({ page }) => {
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#ui-boot-buttons button', { hasText: '开始游戏' })).toBeVisible();
    await expect(page.locator('#ui-boot-buttons button', { hasText: '继续游戏' })).toHaveCount(0);
  });
});
