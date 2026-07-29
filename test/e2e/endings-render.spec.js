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

  test('结局页应先呈现身份与金句，并提供清晰可访问的收口操作', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
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
    const overlay = page.locator('#ui-ending-overlay');
    await expect(overlay).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#ui-ending-title')).not.toBeEmpty({ timeout: 15_000 });

    await expect(overlay).toHaveAttribute('role', 'dialog');
    await expect(overlay).toHaveAttribute('aria-labelledby', 'ui-ending-title');
    await expect(page.locator('.ui-ending-content')).toBeFocused();
    await expect(page.locator('.ui-ending-quote-label')).toHaveText('本局金句');
    await expect(page.locator('.ui-ending-section-heading')).toContainText('人生复盘');
    await expect(page.locator('.ui-ending-copy-kicker')).toHaveText('选择回声');
    await page.waitForTimeout(1800);

    const hierarchy = await page.evaluate(() => {
      const top = selector => document.querySelector(selector).getBoundingClientRect().top;
      const buttons = [...document.querySelectorAll('#ui-ending-buttons > .ui-ending-btn')];
      const buttonTops = buttons.map(button => Math.round(button.getBoundingClientRect().top));
      const actionsRect = document.getElementById('ui-ending-buttons').getBoundingClientRect();
      return {
        titleTop: top('#ui-ending-title'),
        quoteTop: top('.ui-ending-quote-frame'),
        reviewTop: top('.ui-ending-section-heading'),
        primaryText: document.querySelector('.ui-ending-btn-primary').textContent,
        buttonRows: new Set(buttonTops).size,
        actionsVisible: actionsRect.top >= 0 && actionsRect.bottom <= innerHeight,
        buttonHeights: buttons.map(button => button.getBoundingClientRect().height)
      };
    });
    expect(hierarchy.titleTop).toBeLessThan(hierarchy.quoteTop);
    expect(hierarchy.quoteTop).toBeLessThan(hierarchy.reviewTop);
    expect(hierarchy.primaryText).toContain('AI 人生复盘');
    expect(hierarchy.buttonRows).toBe(1);
    expect(hierarchy.actionsVisible).toBeTruthy();
    expect(hierarchy.buttonHeights.every(height => height >= 44)).toBeTruthy();

    const moreBtn = page.locator('.ui-ending-btn-more');
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
    await moreBtn.click();
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#ui-ending-more-menu')).toBeVisible();
  });

  test('六类结局使用匹配的背景、音乐与粒子情绪', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });

    const prepareEndingScene = async () => {
      await page.waitForFunction(() => {
        const bootScene = window.game?.scene?.getScene('BootScene');
        return Boolean(bootScene?.scene?.isActive());
      }, null, { timeout: 30_000 });
      await page.evaluate(async () => {
        const bootScene = window.game?.scene?.getScene('BootScene');
        const ensureScenes = bootScene?.registry?.get('ensureGameplayScenes');
        if (typeof ensureScenes === 'function') await ensureScenes();
      });
      await page.waitForFunction(() => {
        const bootScene = window.game?.scene?.getScene('BootScene');
        return Boolean(
          bootScene?.scene?.isActive() &&
          window.game?.scene?.keys?.EndingScene
        );
      }, null, { timeout: 30_000 });
    };

    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await prepareEndingScene();

    const cases = [
      {
        ending: 'tycoon',
        sceneType: 'ending-legend',
        bgmType: 'ending_legendary',
        particleColor: 0xffd866,
        particleCount: 50
      },
      {
        ending: 'warrior',
        sceneType: 'ending-phoenix',
        bgmType: 'ending_legendary',
        particleColor: 0xffd866,
        particleCount: 50
      },
      {
        ending: 'talkshow_star',
        sceneType: 'ending-returns',
        bgmType: 'ending_legendary',
        particleColor: 0xffd866,
        particleCount: 50
      },
      {
        ending: 'peace',
        sceneType: 'ending-peace',
        bgmType: 'ending_peaceful',
        particleColor: 0xa0d8a0,
        particleCount: 25
      },
      {
        ending: 'monk',
        sceneType: 'ending-monk',
        bgmType: 'ending_peaceful',
        particleColor: 0xa0d8a0,
        particleCount: 25
      },
      {
        ending: 'scapegoat',
        sceneType: 'ending',
        bgmType: 'ending_tragic',
        particleColor: 0x666666,
        particleCount: 20
      }
    ];

    const state = {
      pride: 6, wealth: 5, reputation: 5, failures: 2, pressure: 4, trust: 5,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'reborn', currentNode: 'act9_final',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 60000
    };

    for (const [index, expected] of cases.entries()) {
      if (index > 0) {
        await page.reload();
        await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
        await prepareEndingScene();
      }

      await page.evaluate(({ ending, state: endingState }) => {
        window.game.scene.start('EndingScene', {
          state: { ...endingState },
          ending
        });
      }, { ending: expected.ending, state });

      await page.waitForFunction(ending => {
        const scene = window.game.scene.getScene('EndingScene');
        return scene?.scene.isActive() && scene.endingKey === ending &&
          scene.audio && scene._endingParticles;
      }, expected.ending, { timeout: 30_000 });

      const actual = await page.evaluate(() => {
        const scene = window.game.scene.getScene('EndingScene');
        const sceneType = scene.endingPresentation.sceneType;
        const background = scene.children.list.find(
          child => child.texture?.key === `bg-${sceneType}` && child.visible
        );
        return {
          sceneType,
          bgmType: scene.audio._bgmType,
          particleColor: scene._endingParticles.color,
          particleCount: scene._endingParticles.particles.length,
          textureLoaded: scene.textures.exists(`bg-${sceneType}`),
          backgroundVisible: Boolean(background),
          safeCropBottom: background?.isCropped
            ? background.height - background._crop.height
            : 0
        };
      });

      expect(actual).toEqual({
        sceneType: expected.sceneType,
        bgmType: expected.bgmType,
        particleColor: expected.particleColor,
        particleCount: expected.particleCount,
        textureLoaded: true,
        backgroundVisible: true,
        safeCropBottom: 0
      });
    }

    expect(pageErrors).toEqual([]);
  });
});
