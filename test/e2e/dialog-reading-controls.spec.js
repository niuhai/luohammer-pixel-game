import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R016');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

async function showDialog(page) {
  await page.evaluate(async () => {
    document.getElementById('ui-boot-overlay')?.classList.remove('visible');
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) boot.style.display = 'none';
    const skip = document.getElementById('ui-intro-skip-hint');
    if (skip) skip.style.display = 'none';
    localStorage.removeItem('luohammer_dialog_settings');

    const { DialogSystem } = await import(
      '/luohammer-pixel-game/src/systems/DialogSystem.js'
    );
    const scene = {
      state: { currentNode: 'dialog-reading-probe' },
      vibrate() {},
      isGameplayInputBlocked() {
        return false;
      }
    };
    const dialog = new DialogSystem(scene);
    dialog.el.classList.add('visible');
    dialog.nameEl.textContent = '罗永浩';
    dialog.textEl.textContent =
      '每一次选择都在改变下一幕。阅读控制应该让节奏始终掌握在玩家手里。';
    dialog.continueEl.textContent = '点击继续 ▶';
    dialog.continueEl.hidden = false;
    dialog.continueEl.style.display = 'block';
    dialog._isSeenNode = true;
    dialog._updateSeenBadge();
    window.__dialogReadingProbe = dialog;
  });
  await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
  await expect(page.locator('.ui-dialog-seen-badge')).toBeVisible();
}

async function readState(page) {
  return page.locator('#ui-dialog').evaluate(dialog => {
    const auto = dialog.querySelector('#ui-dialog-auto');
    const speed = dialog.querySelector('#ui-dialog-speed');
    const badge = dialog.querySelector('.ui-dialog-seen-badge');
    const controls = dialog.querySelector('.ui-dialog-reading-controls');
    const autoBox = auto.getBoundingClientRect();
    const badgeBox = badge.getBoundingClientRect();
    const dialogBox = dialog.getBoundingClientRect();
    const overlapWidth = Math.max(
      0,
      Math.min(autoBox.right, badgeBox.right) - Math.max(autoBox.left, badgeBox.left)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(autoBox.bottom, badgeBox.bottom) - Math.max(autoBox.top, badgeBox.top)
    );
    return {
      controlsExists: Boolean(controls),
      controlsRole: controls?.getAttribute('role') || '',
      autoText: auto.textContent.replace(/\s+/g, ' ').trim(),
      autoAriaPressed: auto.getAttribute('aria-pressed'),
      autoAriaLabel: auto.getAttribute('aria-label') || '',
      autoState: auto.dataset.state || '',
      speedExists: Boolean(speed),
      speedText: speed?.textContent.replace(/\s+/g, ' ').trim() || '',
      speedAriaLabel: speed?.getAttribute('aria-label') || '',
      speedState: speed?.dataset.speed || '',
      badgeText: badge.textContent.replace(/\s+/g, ' ').trim(),
      badgeParentClass: badge.parentElement?.className || '',
      overlapArea: Math.round(overlapWidth * overlapHeight),
      autoBox: {
        left: Math.round(autoBox.left),
        top: Math.round(autoBox.top),
        right: Math.round(autoBox.right),
        bottom: Math.round(autoBox.bottom)
      },
      badgeBox: {
        left: Math.round(badgeBox.left),
        top: Math.round(badgeBox.top),
        right: Math.round(badgeBox.right),
        bottom: Math.round(badgeBox.bottom)
      },
      dialogBox: {
        left: Math.round(dialogBox.left),
        top: Math.round(dialogBox.top),
        right: Math.round(dialogBox.right),
        bottom: Math.round(dialogBox.bottom)
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  });
}

test('对话阅读控制应清晰呈现自动播放、速度与已读快进状态', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/');

  await page.setViewportSize({ width: 1440, height: 900 });
  await showDialog(page);
  const desktopInitial = await readState(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-reading-controls.png') });

  await page.keyboard.press('a');
  const desktopAfterAuto = await readState(page);
  await page.keyboard.press('s');
  const desktopAfterSpeed = await readState(page);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBeforeSpeedTap = await readState(page);
  const speedButton = page.locator('#ui-dialog-speed');
  let mobileSpeedTapAvailable = false;
  if (await speedButton.count()) {
    mobileSpeedTapAvailable = true;
    await speedButton.click();
  }
  const mobileAfterSpeedTap = await readState(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-reading-controls.png') });

  await page.evaluate(() => window.__dialogReadingProbe?.destroy());

  const report = {
    schemaVersion: 1,
    round: 'R016',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktopInitial,
    desktopAfterAuto,
    desktopAfterSpeed,
    mobileBeforeSpeedTap,
    mobileSpeedTapAvailable,
    mobileAfterSpeedTap
  };
  report.passed = desktopInitial.dialogBox.left >= 0 &&
    desktopInitial.dialogBox.right <= desktopInitial.viewport.width &&
    mobileBeforeSpeedTap.dialogBox.left >= 0 &&
    mobileBeforeSpeedTap.dialogBox.right <= mobileBeforeSpeedTap.viewport.width;
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.desktopInitial.speedExists).toBeFalsy();
    expect(before.desktopInitial.overlapArea).toBeGreaterThan(0);

    expect(desktopInitial.controlsExists).toBeTruthy();
    expect(desktopInitial.controlsRole).toBe('group');
    expect(desktopInitial.overlapArea).toBe(0);
    expect(desktopInitial.autoText).toContain('关');
    expect(desktopInitial.autoAriaPressed).toBe('false');
    expect(desktopInitial.autoAriaLabel).toContain('关闭');
    expect(desktopInitial.speedExists).toBeTruthy();
    expect(desktopInitial.speedText).toContain('中');
    expect(desktopInitial.speedAriaLabel).toContain('中');
    expect(desktopInitial.badgeParentClass).toContain('ui-dialog-reading-controls');

    expect(desktopAfterAuto.autoText).toContain('开');
    expect(desktopAfterAuto.autoAriaPressed).toBe('true');
    expect(desktopAfterSpeed.speedText).toContain('快');
    expect(desktopAfterSpeed.speedState).toBe('fast');

    expect(mobileSpeedTapAvailable).toBeTruthy();
    expect(mobileBeforeSpeedTap.speedState).not.toBe(mobileAfterSpeedTap.speedState);
    expect(mobileAfterSpeedTap.overlapArea).toBe(0);
  }
});
