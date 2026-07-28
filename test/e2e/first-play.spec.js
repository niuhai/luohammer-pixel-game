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

  test('序章应尽早提供清晰的进度与跨端跳过反馈', async ({ page }) => {
    const startBtn = page.locator('#ui-boot-buttons button', { hasText: '开始游戏' });
    await expect(startBtn).toBeVisible({ timeout: 15_000 });
    await startBtn.click();

    const overlay = page.locator('#ui-intro-overlay');
    const skipBtn = page.locator('#ui-intro-skip-hint');
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await expect(skipBtn).toHaveClass(/visible/, { timeout: 2_000 });
    await expect(skipBtn).toHaveAttribute('aria-label', '跳过序章');
    await expect(page.locator('.ui-intro-progress i')).toHaveCount(3);
    await expect(page.locator('.ui-intro-film-frame')).toBeVisible();
    await expect(overlay).toHaveAttribute('data-stage', /[1-3]/, { timeout: 2_500 });

    await expect(overlay).toHaveAttribute('data-stage', '3', { timeout: 6_000 });
    await expect.poll(async () => page.locator('.ui-intro-line').nth(2).evaluate(
      line => Number(getComputedStyle(line).opacity)
    )).toBeGreaterThanOrEqual(0.98);
    const finaleReadability = await page.locator('.ui-intro-line').evaluateAll(lines => lines.map(line => ({
      opacity: Number(getComputedStyle(line).opacity),
      fontSize: Number.parseFloat(getComputedStyle(line).fontSize)
    })));
    expect(finaleReadability[0].opacity).toBeGreaterThanOrEqual(0.64);
    expect(finaleReadability[1].opacity).toBeGreaterThanOrEqual(0.64);
    expect(finaleReadability[2].opacity).toBeGreaterThanOrEqual(0.98);
    expect(finaleReadability.every(line => line.fontSize >= 18)).toBe(true);

    const desktopControl = await skipBtn.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        opacity: parseFloat(getComputedStyle(element).opacity),
        height: rect.height,
        desktopLabelVisible: getComputedStyle(
          element.querySelector('.ui-intro-skip-desktop')
        ).display !== 'none'
      };
    });
    expect(desktopControl.opacity).toBeGreaterThanOrEqual(0.7);
    expect(desktopControl.height).toBeGreaterThanOrEqual(38);
    expect(desktopControl.desktopLabelVisible).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLabels = await skipBtn.evaluate(element => ({
      desktop: getComputedStyle(element.querySelector('.ui-intro-skip-desktop')).display,
      mobile: getComputedStyle(element.querySelector('.ui-intro-skip-mobile')).display
    }));
    expect(mobileLabels.desktop).toBe('none');
    expect(mobileLabels.mobile).not.toBe('none');
    const mobileFrame = await page.locator('.ui-intro-film-frame').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    });
    expect(mobileFrame.left).toBeGreaterThanOrEqual(0);
    expect(mobileFrame.top).toBeGreaterThanOrEqual(0);
    expect(mobileFrame.right).toBeLessThanOrEqual(mobileFrame.viewportWidth);
    expect(mobileFrame.bottom).toBeLessThanOrEqual(mobileFrame.viewportHeight);
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
    expect(cardCount).toBe(5);
    await expect(page.locator('.ui-talent-hint')).toContainText('5 选 2');
    await expect(page.locator('.ui-talent-position')).toHaveCount(5);

    // 点击前两个天赋
    await talentCards.nth(0).click();
    await talentCards.nth(1).click();
    await expect(page.locator('.ui-talent-combo')).toHaveClass(/visible/);
    await expect(page.locator('.ui-talent-combo strong')).not.toBeEmpty();

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
    await expect(page.locator('#ui-stage-position')).toHaveText('第 1 / 6 阶段');
    await expect(page.locator('#ui-stage-current')).toHaveText('延边少年');
    await expect(page.locator('#ui-stage-rail .ui-stage-segment')).toHaveCount(6);
    await expect(page.locator('#ui-stage-rail .ui-stage-segment.current')).toHaveCount(1);
    await expect(page.locator('#ui-stage-rail')).toHaveAttribute('aria-valuenow', '1');

    const topControls = await page.locator(
      '#ui-sound-toggle, #ui-menu-toggle, #ui-narration-toggle, #ui-voice-toggle'
    ).evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return {
        tagName: element.tagName,
        width: rect.width,
        height: rect.height
      };
    }));
    expect(topControls).toHaveLength(4);
    expect(topControls.every(control => control.tagName === 'BUTTON')).toBe(true);
    expect(topControls.every(control => control.width >= 44 && control.height >= 44)).toBe(true);

    // 对话框可能在打字机效果中，给一定时间
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/, { timeout: 10_000 });
    const dialogFontSize = await page.locator('#ui-dialog-text').evaluate(
      element => parseFloat(getComputedStyle(element).fontSize)
    );
    expect(dialogFontSize).toBeGreaterThanOrEqual(14);
    const dialogVisible = await page.locator('#ui-dialog').isVisible().catch(() => false);
    const choicesVisible = await page.locator('#ui-choices .ui-choice-btn').first().isVisible().catch(() => false);
    expect(dialogVisible || choicesVisible).toBeTruthy();

    // === 6. 点击首个选项，验证状态变化 ===
    if (choicesVisible) {
      const firstChoice = page.locator('#ui-choices .ui-choice-btn').first();
      const choiceMetrics = await firstChoice.evaluate(element => ({
        fontSize: parseFloat(getComputedStyle(element.querySelector('.ui-choice-text')).fontSize),
        height: element.getBoundingClientRect().height
      }));
      expect(choiceMetrics.fontSize).toBeGreaterThanOrEqual(14);
      expect(choiceMetrics.height).toBeGreaterThanOrEqual(44);
      await firstChoice.click();
      await page.waitForTimeout(2000);
      // 仍在游戏中
      const stillInGame = await page.locator('#ui-chapter').isVisible();
      expect(stillInGame).toBeTruthy();
    }

    await page.screenshot({ path: 'test/e2e/screenshots/first-play-after-choice.png', fullPage: false });
  });

  for (const viewport of [
    { name: '竖屏', width: 390, height: 844 },
    { name: '横屏', width: 812, height: 375 }
  ]) {
    test(`${viewport.name}下 5 张天赋与确认区同时可见且可选择`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
      await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
      await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      await page.locator('#ui-intro-overlay').click({ force: true });
      await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 25_000 });
      await page.waitForTimeout(1500); // 等五张卡的交错翻牌动画进入稳定态

      const cards = page.locator('#ui-talent-cards .ui-talent-card');
      await expect(cards).toHaveCount(5);
      const layout = await page.evaluate(() => {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const confirm = document.querySelector('#ui-talent-confirm').getBoundingClientRect();
        const cardRects = [...document.querySelectorAll('#ui-talent-cards .ui-talent-card')]
          .map(card => {
            const rect = card.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom
            };
          });
        return { viewportHeight, viewportWidth, confirm, cardRects };
      });
      expect(layout.confirm.top).toBeGreaterThanOrEqual(0);
      expect(layout.confirm.bottom).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.confirm.width).toBeGreaterThanOrEqual(100);
      expect(layout.confirm.height).toBeGreaterThanOrEqual(36);
      for (const rect of layout.cardRects) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(layout.viewportWidth);
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(layout.viewportHeight);
        expect(rect.right - rect.left).toBeGreaterThanOrEqual(100);
        expect(rect.bottom - rect.top).toBeGreaterThanOrEqual(44);
      }

      await cards.first().click();
      await cards.last().click();
      await expect(page.locator('.ui-talent-hint')).toContainText('已选 2/2');
      await expect(page.locator('.ui-talent-combo')).toHaveClass(/visible/);
      await expect(page.locator('#ui-talent-confirm')).toBeEnabled();
      const footerLayout = await page.evaluate(() => {
        const getRect = selector => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
        };
        return {
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          combo: getRect('.ui-talent-combo'),
          confirm: getRect('#ui-talent-confirm')
        };
      });
      for (const rect of [footerLayout.combo, footerLayout.confirm]) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(footerLayout.viewportWidth);
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(footerLayout.viewportHeight);
        expect(rect.width).toBeGreaterThanOrEqual(120);
      }
    });
  }

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

  test('标题页与配音面板展示完整产品信息', async ({ page }) => {
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.ui-boot-version')).toHaveText('v1.1.0 · 完整体验版');

    const voiceBtn = page.locator('#ui-boot-buttons button', { hasText: '朗读设置' });
    await expect(voiceBtn).toContainText('沉稳演讲');
    await voiceBtn.click();

    const panel = page.locator('.ui-voice-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('完全使用当前设备的中文系统语音');
    await expect(panel).toContainText('朗读内容');
    await expect(panel).toContainText('设备语音');
    await expect(panel.locator('.ui-voice-preset-name')).toHaveText([
      '★ 沉稳演讲',
      '纪录旁白',
      '温和叙事',
      '明快讲述'
    ]);
    await expect(panel.locator('button', { hasText: '试听' })).toHaveCount(4);
  });
});
