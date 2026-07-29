import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R010');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

async function waitForBoot(page) {
  const overlay = page.locator('#ui-boot-overlay');
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  await expect(overlay).toHaveAttribute('data-boot-phase', 'engine', { timeout: 30_000 });
  await expect(page.locator('#ui-boot-buttons .ui-boot-btn-primary')).toBeEnabled();
}

async function readGeometry(page) {
  return page.evaluate(() => {
    const hint = document.getElementById('rotate-hint');
    const canvas = document.querySelector('canvas');
    const hintRect = hint?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    return {
      hintVisible: Boolean(hint && getComputedStyle(hint).display !== 'none'),
      hintRect: hintRect ? {
        top: Math.round(hintRect.top),
        left: Math.round(hintRect.left),
        width: Math.round(hintRect.width),
        height: Math.round(hintRect.height),
        bottom: Math.round(hintRect.bottom)
      } : null,
      canvasRect: canvasRect ? {
        top: Math.round(canvasRect.top),
        height: Math.round(canvasRect.height),
        bottom: Math.round(canvasRect.bottom)
      } : null,
      bodyPaddingTop: Math.round(parseFloat(getComputedStyle(document.body).paddingTop) || 0),
      activeElement: document.activeElement?.textContent?.trim() || ''
    };
  });
}

test('竖屏方向建议应低干扰、可记忆关闭且只停留在标题页', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const hint = page.locator('#rotate-hint');
  // 提示只有 7 秒展示窗口，先验证它及时出现，再等待完整引擎接管。
  await expect(hint).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_200);
  const initial = await readGeometry(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-boot.png') });

  await expect(hint).toBeHidden({ timeout: 8_000 });
  const autoHidden = await hint.isHidden();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(hint).toBeVisible({ timeout: 15_000 });
  await page.locator('#rotate-hint-dismiss').click();
  await expect(hint).toBeHidden();
  await page.reload();
  await waitForBoot(page);
  const dismissedAfterReload = await hint.isHidden();

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(hint).toBeVisible({ timeout: 15_000 });
  await waitForBoot(page);
  await page.locator('#ui-boot-buttons .ui-boot-btn-primary').click();
  await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(300);
  const intro = await readGeometry(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-intro.png') });

  const report = {
    schemaVersion: 1,
    round: 'R010',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    initial,
    autoHidden,
    dismissedAfterReload,
    intro
  };
  report.passed = initial.hintVisible && Boolean(initial.canvasRect);
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(initial.hintRect.width).toBeLessThan(before.initial.hintRect.width * 0.75);
    expect(initial.bodyPaddingTop).toBeLessThan(before.initial.bodyPaddingTop);
    expect(autoHidden).toBeTruthy();
    expect(dismissedAfterReload).toBeTruthy();
    expect(intro.hintVisible).toBeFalsy();
    expect(intro.canvasRect.top).toBeLessThan(before.intro.canvasRect.top);
  }
});
