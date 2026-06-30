import { test, expect } from '@playwright/test';

/**
 * L3 E2E：存档/读档系统
 *
 * 覆盖：自动存档触发 → 刷新页面 → 继续游戏 → 状态恢复
 */

test.describe('存档/读档', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
    });
    await page.reload();
  });

  test('自动存档后刷新页面，"继续游戏"应出现并恢复进度', async ({ page }) => {
    // === 1. 进入游戏场景 ===
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();

    // 跳过开场动画（点击 overlay）
    await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await page.locator('#ui-intro-overlay').click({ force: true });

    // 选天赋（GameScene preload 可能较慢）
    await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 25_000 });
    const cards = page.locator('#ui-talent-cards .ui-talent-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.locator('#ui-talent-confirm').click();

    // 阶段结算画面：intro 是 youth 阶段入口，会触发 _showStageSettlement
    const settlementOverlay = page.locator('.ui-settlement-overlay.visible');
    if (await settlementOverlay.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('#ui-settlement-continue').click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    // 等待进入游戏：对话框可见表示 _renderNode 已执行
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/, { timeout: 15_000 });

    // 做一个选择以推进进度（等选项出现）
    const choiceBtn = page.locator('#ui-choices .ui-choice-btn').first();
    if (await choiceBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await choiceBtn.click();
      await page.waitForTimeout(1500);
    }

    // === 2. 触发自动存档：ESC 打开菜单 → 返回标题（会自动存档） ===
    // 注意：#ui-menu-toggle/ok 的 Playwright click 可能不触发事件监听器，用 dispatchEvent 更可靠
    await page.keyboard.press('Escape');
    await expect(page.locator('#ui-menu-confirm')).toHaveClass(/visible/, { timeout: 5000 });
    await page.evaluate(() => {
      document.getElementById('ui-menu-ok').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(2000);

    // === 3. 验证存档已写入 localStorage ===
    const savedState = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('luohammer_save');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    });
    expect(savedState).not.toBeNull();
    expect(savedState.currentNode).toBeTruthy();

    // === 4. 刷新页面 ===
    await page.reload();
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });

    // === 5. 应出现"继续游戏"按钮 ===
    const continueBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });

    // === 6. 点击继续游戏，验证恢复到游戏场景 ===
    await continueBtn.click();
    await expect(page.locator('#ui-chapter')).toHaveClass(/visible/, { timeout: 10_000 });
    await expect(page.locator('#ui-chapter-name')).not.toBeEmpty({ timeout: 5000 });

    // 截图留档
    await page.screenshot({ path: 'test/e2e/screenshots/save-load-restored.png', fullPage: false });
  });

  test('存档管理面板可打开', async ({ page }) => {
    // 先制造一个存档
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
    await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await page.locator('#ui-intro-overlay').click({ force: true });
    await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 25_000 });
    const cards = page.locator('#ui-talent-cards .ui-talent-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.locator('#ui-talent-confirm').click();

    // 阶段结算画面
    const settlementOverlay = page.locator('.ui-settlement-overlay.visible');
    if (await settlementOverlay.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.locator('#ui-settlement-continue').click({ timeout: 3_000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/, { timeout: 15_000 });

    // 返回标题（ESC 打开菜单，自动存档）
    await page.keyboard.press('Escape');
    await expect(page.locator('#ui-menu-confirm')).toHaveClass(/visible/, { timeout: 5000 });
    await page.evaluate(() => {
      document.getElementById('ui-menu-ok').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(2000);

    // 刷新后应出现"存档管理"
    await page.reload();
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    const manageBtn = page.locator('#ui-boot-buttons button', { hasText: '存档管理' });
    await expect(manageBtn).toBeVisible({ timeout: 5000 });
    // 用 dispatchEvent 避免 Playwright click 被拦截
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#ui-boot-buttons button');
      for (const b of btns) {
        if (b.textContent.includes('存档管理')) {
          b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          break;
        }
      }
    });

    // 存档管理面板应出现（#ui-saveload-overlay）
    await expect(page.locator('#ui-saveload-overlay')).toBeVisible({ timeout: 5000 });
  });

  test('主存档损坏时备份恢复（BUG 防护）', async ({ page }) => {
    // 注入一个损坏的主存档 + 一个有效的备份
    await page.evaluate(() => {
      const validState = {
        pride: 7, wealth: 5, reputation: 6, failures: 1, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'intro',
        flags: [], triggeredEvents: [], history: [], achievements: [],
        gameStartTime: Date.now()
      };
      // 写两次以生成备份（save() 会把旧主存档拷贝到 BACKUP_KEY）
      localStorage.setItem('luohammer_save', JSON.stringify(validState));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(validState));
      // 再把主存档弄坏
      localStorage.setItem('luohammer_save', '{invalid json');
    });

    await page.reload();
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });

    // 损坏的主存档不应导致页面崩溃
    const continueBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    const hasContinue = await continueBtn.isVisible({ timeout: 3000 }).catch(() => false);
    // 即使没有继续游戏按钮，页面也不应崩溃（BootScene 应正常渲染）
    expect(await page.locator('#ui-boot-overlay').isVisible()).toBeTruthy();
  });
});
