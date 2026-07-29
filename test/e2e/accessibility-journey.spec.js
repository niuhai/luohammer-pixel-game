import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve('.iteration/ui/evidence/R007/after');

async function resetFirstPlay(page) {
  await page.goto('/');
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (error) {}
  });
  await page.reload();
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
}

test.describe('跨场景可访问交互', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('键盘焦点应从标题页交接到序章与天赋选择', async ({ page }) => {
    await resetFirstPlay(page);

    const boot = page.locator('#ui-boot-overlay');
    const start = page.locator('#ui-boot-buttons .ui-boot-btn-primary');
    await expect(boot).toBeVisible({ timeout: 15_000 });
    await expect(boot).toHaveAttribute('role', 'main');
    await expect(start).toBeFocused();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'keyboard-boot.png') });

    await page.keyboard.press('Enter');
    const intro = page.locator('#ui-intro-overlay');
    const skip = page.locator('#ui-intro-skip-hint');
    await expect(intro).toBeVisible({ timeout: 10_000 });
    await expect(intro).toHaveAttribute('role', 'dialog');
    await expect(skip).toHaveClass(/visible/, { timeout: 3_000 });
    await expect(skip).toBeFocused();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'keyboard-intro.png') });

    // 原生按钮的 Enter 应直接完成跳过，不能只依赖 overlay 的 pointerdown。
    await page.keyboard.press('Enter');
    const talent = page.locator('#ui-talent-overlay');
    const cards = page.locator('#ui-talent-cards .ui-talent-card');
    await expect(talent).toBeVisible({ timeout: 25_000 });
    await expect(talent).toHaveAttribute('role', 'dialog');
    await expect(talent).toHaveAttribute('aria-labelledby', 'ui-talent-title');
    await expect(cards).toHaveCount(5);
    await expect(cards.first()).toBeFocused({ timeout: 5_000 });

    await page.keyboard.press('Space');
    await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
    await cards.nth(1).focus();
    await page.keyboard.press('Enter');
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#ui-talent-confirm')).toBeEnabled();
    await expect(page.locator('.ui-talent-hint')).toHaveAttribute('role', 'status');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'keyboard-talent.png') });
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'keyboard-report.json'),
      `${JSON.stringify({
        passed: true,
        journey: ['boot-primary', 'intro-skip', 'talent-first-card'],
        nativeActivation: ['Enter', 'Space'],
        semanticRegions: ['main', 'dialog', 'dialog']
      }, null, 2)}\n`,
      'utf8'
    );
  });

  test('减少动态效果时应直接呈现标题金句和可操作天赋', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await resetFirstPlay(page);

    const quote = page.locator('#ui-boot-quote');
    const primary = page.locator('#ui-boot-buttons .ui-boot-btn-primary');
    await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
    await expect(quote).not.toBeEmpty();
    await expect(quote.locator('.ui-boot-quote-cursor')).toHaveCount(0);
    await expect(primary).toBeVisible();
    const quoteText = await quote.textContent();
    const bootMotion = await page.evaluate(() => {
      const selectors = [
        '.ui-boot-character-bg',
        '.ui-boot-title',
        '.ui-boot-subtitle',
        '.ui-boot-btn-primary'
      ];
      const seconds = value => value.split(',').map(item => {
        const trimmed = item.trim();
        return trimmed.endsWith('ms')
          ? Number.parseFloat(trimmed) / 1000
          : Number.parseFloat(trimmed);
      });
      return selectors.flatMap(selector => {
        const style = getComputedStyle(document.querySelector(selector));
        return seconds(style.animationDuration).map((duration, index) => ({
          duration,
          delay: seconds(style.animationDelay)[index] || 0
        }));
      });
    });
    expect(bootMotion.every(({ duration, delay }) =>
      duration <= 0.001 && delay <= 0.001
    )).toBeTruthy();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'reduced-motion-boot.png') });

    await page.keyboard.press('Enter');
    await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => page.evaluate(() =>
      window.game?.scene?.getScene('IntroScene')?._reducedMotion
    )).toBe(true);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'reduced-motion-intro.png') });

    // 减少动态效果路径会静态呈现序章，并在短暂停留后进入天赋页。
    const cards = page.locator('#ui-talent-cards .ui-talent-card');
    await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 25_000 });
    await expect(cards).toHaveCount(5);
    await expect(cards.first()).toBeFocused();
    await expect(cards.first()).toHaveClass(/is-revealed/);
    await expect(cards.first()).not.toBeDisabled();
    await expect(page.locator('#ui-talent-cards .ui-talent-card[aria-disabled="true"]')).toHaveCount(0);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'reduced-motion-talent.png') });
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'reduced-motion-report.json'),
      `${JSON.stringify({
        passed: true,
        quoteLength: quoteText?.trim().length || 0,
        quoteCursorPresent: false,
        bootAnimationTimingsSeconds: bootMotion,
        introReducedMotion: true,
        talentCardsImmediatelyRevealed: 5
      }, null, 2)}\n`,
      'utf8'
    );
  });
});
