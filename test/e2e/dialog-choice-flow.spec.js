import { expect, test } from '@playwright/test';

async function enterChoices(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
  await page.locator('#ui-boot-buttons button').first().click();
  await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#ui-intro-skip-hint')).toHaveClass(/visible/, { timeout: 3_000 });
  await page.locator('#ui-intro-skip-hint').click({ force: true });

  await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 25_000 });
  await page.waitForTimeout(1_500);
  const talents = page.locator('#ui-talent-cards .ui-talent-card');
  await talents.nth(0).click();
  await talents.nth(1).click();
  await page.locator('#ui-talent-confirm:not([disabled])').click();

  const settlement = page.locator('.ui-settlement-overlay.visible');
  if (await settlement.isVisible({ timeout: 6_000 }).catch(() => false)) {
    await page.locator('#ui-settlement-continue').click().catch(() => {});
  }
  await expect(page.locator('#ui-dialog')).toHaveClass(/visible/, { timeout: 20_000 });

  for (let attempt = 0; attempt < 12; attempt++) {
    if (await page.locator('#ui-choices.visible').isVisible().catch(() => false)) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(450);
  }
  await expect(page.locator('#ui-choices')).toHaveClass(/visible/, { timeout: 8_000 });
  await page.waitForTimeout(400);
}

function defineChoiceFlowTest(name, useOptions, expectedHint) {
  test.describe(name, () => {
    test.use(useOptions);

    test('剧情阅读自然交接到可聚焦的选择动作', async ({ page }) => {
      await enterChoices(page);

      const choices = page.locator('#ui-choices');
      const context = page.locator('.ui-choice-context');
      const buttons = page.locator('.ui-choice-btn');
      await expect(context).toContainText('做出你的选择');
      await expect(context).toContainText(expectedHint);
      await expect(choices).toHaveAttribute('role', 'group');
      await expect(choices).toHaveAttribute('aria-label', /剧情选择.*项可选/);

      const initial = await choices.evaluate(element => {
        const buttons = [...element.querySelectorAll('.ui-choice-btn')];
        return {
          activeInside: element.contains(document.activeElement),
          activeIndex: buttons.indexOf(document.activeElement),
          activeDisabled: document.activeElement?.disabled ?? true,
          rect: element.getBoundingClientRect().toJSON(),
          viewport: { width: innerWidth, height: innerHeight }
        };
      });
      expect(initial.activeInside).toBe(true);
      expect(initial.activeIndex).toBeGreaterThanOrEqual(0);
      expect(initial.activeDisabled).toBe(false);
      expect(initial.rect.left).toBeGreaterThanOrEqual(0);
      expect(initial.rect.right).toBeLessThanOrEqual(initial.viewport.width);
      expect(initial.rect.top).toBeGreaterThanOrEqual(0);
      expect(initial.rect.bottom).toBeLessThanOrEqual(initial.viewport.height);

      await page.keyboard.press('ArrowDown');
      const moved = await choices.evaluate(element => {
        const buttons = [...element.querySelectorAll('.ui-choice-btn')];
        const index = buttons.indexOf(document.activeElement);
        return { index, disabled: buttons[index]?.disabled ?? true };
      });
      expect(moved.index).not.toBe(initial.activeIndex);
      expect(moved.disabled).toBe(false);

      await page.keyboard.press('Home');
      await page.keyboard.press('Enter');
      await expect.poll(async () => choices.evaluate(element =>
        element.classList.contains('leaving') ||
        !element.classList.contains('visible') ||
        Boolean(element.querySelector('.ui-choice-btn.selected'))
      )).toBe(true);
      // 快设备可能已在选中反馈后销毁旧按钮并推进剧情；慢设备则仍处于
      // leaving 动画。两种情况下都必须不存在可再次提交的旧选择。
      await expect.poll(() => buttons.evaluateAll(items =>
        items.length === 0 || items.every(button => button.disabled)
      )).toBe(true);
    });
  });
}

defineChoiceFlowTest(
  '桌面对话选择焦点流',
  { viewport: { width: 1440, height: 900 } },
  'Enter 确认'
);

defineChoiceFlowTest(
  '手机对话选择触控流',
  { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  '轻触选择'
);
