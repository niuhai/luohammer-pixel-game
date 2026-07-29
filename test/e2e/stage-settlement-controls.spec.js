import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R015');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

async function showSettlement(page) {
  await page.evaluate(async () => {
    const bootOverlay = document.getElementById('ui-boot-overlay');
    if (bootOverlay) {
      bootOverlay.classList.remove('visible');
      bootOverlay.style.display = 'none';
    }
    const introSkipHint = document.getElementById('ui-intro-skip-hint');
    if (introSkipHint) introSkipHint.style.display = 'none';
    const { GameScene } = await import(
      '/luohammer-pixel-game/src/scenes/GameScene.js'
    );
    const state = {
      pride: 6,
      wealth: 4,
      reputation: 5,
      failures: 1,
      pressure: 2,
      trust: 5,
      achievements: [],
      talentSpecials: [],
      flags: new Set()
    };
    const scene = {
      state,
      debug: { logStageSettlement() {} },
      audio: { playStageSettlement() {} },
      stats: { update() {} },
      _settlementTimer: null,
      _trackedTimeout(callback, delay) {
        return setTimeout(callback, Math.min(delay, 30));
      },
      _applyEffectsWithTalentFeedback() {},
      _recordDirectTalentTrigger() {}
    };
    window.__settlementProbe = { scene, completed: 0 };
    GameScene.prototype._showStageSettlement.call(scene, {
      id: 'probe-stage',
      name: '创业试炼',
      period: '2006—2011',
      settlement: {
        text: '那些在风口与低谷之间做出的选择，已经成为下一段人生的底色。',
        checks: []
      }
    }, () => {
      window.__settlementProbe.completed += 1;
    });
  });
  await expect(page.locator('.ui-settlement-overlay')).toHaveClass(/visible/);
  await page.waitForTimeout(220);
}

async function readSettlement(page) {
  return page.locator('.ui-settlement-overlay').evaluate(overlay => {
    const card = overlay.querySelector('.ui-settlement-card');
    const button = overlay.querySelector('#ui-settlement-continue');
    const countdown = overlay.querySelector('#ui-settlement-countdown');
    const cardBox = card.getBoundingClientRect();
    return {
      role: overlay.getAttribute('role') || '',
      ariaModal: overlay.getAttribute('aria-modal') || '',
      labelledBy: overlay.getAttribute('aria-labelledby') || '',
      describedBy: overlay.getAttribute('aria-describedby') || '',
      cardTabIndex: card.getAttribute('tabindex'),
      continueFocused: document.activeElement === button,
      continueLabel: button.getAttribute('aria-label') || button.textContent.trim(),
      countdownText: countdown.textContent.trim(),
      countdownLive: countdown.getAttribute('aria-live') || '',
      cardBox: {
        left: Math.round(cardBox.left),
        top: Math.round(cardBox.top),
        right: Math.round(cardBox.right),
        bottom: Math.round(cardBox.bottom),
        width: Math.round(cardBox.width),
        height: Math.round(cardBox.height)
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  });
}

async function cleanupSettlement(page) {
  await page.evaluate(() => {
    const probe = window.__settlementProbe;
    if (probe?.scene?._settlementTimer) {
      clearInterval(probe.scene._settlementTimer);
      probe.scene._settlementTimer = null;
    }
    document.querySelectorAll('.ui-settlement-overlay').forEach(element => element.remove());
  });
}

test('阶段结算应支持完整阅读、键盘焦点和移动端可达性', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/');
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});

  await page.setViewportSize({ width: 1440, height: 900 });
  await showSettlement(page);
  const desktopInitial = await readSettlement(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-settlement.png') });

  await page.locator('.ui-settlement-card').dispatchEvent('pointerdown');
  await page.waitForTimeout(1_150);
  const desktopAfterInteraction = await readSettlement(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-settlement-paused.png') });
  await page.locator('#ui-settlement-continue').click();
  await expect(page.locator('.ui-settlement-overlay')).toHaveCount(0, { timeout: 2_000 });
  const closeResult = await page.evaluate(() => ({
    completed: window.__settlementProbe.completed
  }));

  await page.setViewportSize({ width: 390, height: 844 });
  await showSettlement(page);
  const mobile = await readSettlement(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-settlement.png') });
  await page.keyboard.press('Tab');
  const mobileAfterKeyboard = await readSettlement(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-settlement-paused.png') });
  await page.keyboard.press('Enter');
  await expect(page.locator('.ui-settlement-overlay')).toHaveCount(0, { timeout: 2_000 });
  const mobileCloseResult = await page.evaluate(() => ({
    completed: window.__settlementProbe.completed
  }));
  await cleanupSettlement(page);

  const report = {
    schemaVersion: 1,
    round: 'R015',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktopInitial,
    desktopAfterInteraction,
    closeResult,
    mobile,
    mobileAfterKeyboard,
    mobileCloseResult
  };
  report.passed = desktopInitial.cardBox.left >= 0 &&
    desktopInitial.cardBox.right <= desktopInitial.viewport.width &&
    mobile.cardBox.left >= 0 &&
    mobile.cardBox.right <= mobile.viewport.width &&
    mobile.cardBox.top >= 0 &&
    mobile.cardBox.bottom <= mobile.viewport.height &&
    closeResult.completed === 1;
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.desktopInitial.role).toBe('');
    expect(before.desktopInitial.continueFocused).toBeFalsy();
    expect(before.desktopAfterInteraction.countdownText)
      .not.toBe(before.desktopInitial.countdownText);

    expect(desktopInitial.role).toBe('dialog');
    expect(desktopInitial.ariaModal).toBe('true');
    expect(desktopInitial.labelledBy).toBe('ui-settlement-title');
    expect(desktopInitial.describedBy).toContain('ui-settlement-summary');
    expect(desktopInitial.continueFocused).toBeTruthy();
    expect(desktopInitial.continueLabel).toContain('继续');
    expect(desktopAfterInteraction.countdownText).toContain('已暂停');
    expect(desktopAfterInteraction.countdownText)
      .not.toMatch(/^\d+s 后自动继续$/);
    expect(mobile.continueFocused).toBeTruthy();
    expect(mobileAfterKeyboard.continueFocused).toBeTruthy();
    expect(mobileAfterKeyboard.countdownText).toContain('已暂停');
    expect(mobileCloseResult.completed).toBe(1);
  }
});
