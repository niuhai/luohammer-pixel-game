import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R011');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

const TEST_STATE = {
  pride: 6,
  wealth: 4,
  reputation: 5,
  failures: 1,
  pressure: 3,
  trust: 5,
  pressureMax: 10,
  failurePenalty: 1,
  successBonus: 1,
  talentSpecials: [],
  currentStageId: 'teacher',
  currentNode: 'act1_first',
  flags: [],
  triggeredEvents: [],
  history: [],
  achievements: [],
  gameStartTime: Date.now() - 60_000
};

async function enterSavedGame(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(state => {
    localStorage.clear();
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    localStorage.setItem('luohammer_orientation_hint_seen', '1');
  }, TEST_STATE);
  await page.reload();
  const continueButton = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await expect(continueButton).toBeVisible({ timeout: 15_000 });
  await continueButton.click();
  await expect(page.locator('#ui-chapter')).toHaveClass(/visible/, { timeout: 15_000 });
  await expect(page.locator('#ui-menu-toggle')).toBeVisible();
}

async function readPersistentControls(page) {
  return page.locator(
    '#ui-sound-toggle, #ui-menu-toggle, #ui-narration-toggle, #ui-voice-toggle'
  ).evaluateAll(elements => {
    const visible = elements
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.id,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      });
    const union = visible.length ? {
      left: Math.min(...visible.map(item => item.left)),
      right: Math.max(...visible.map(item => item.right)),
      top: Math.min(...visible.map(item => item.top)),
      bottom: Math.max(...visible.map(item => item.bottom))
    } : null;
    if (union) {
      union.width = union.right - union.left;
      union.height = union.bottom - union.top;
      union.area = union.width * union.height;
    }
    return { count: visible.length, controls: visible, union };
  });
}

async function readPauseMenu(page) {
  return page.locator('#ui-menu-confirm').evaluate(element => {
    const focusables = [...element.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )];
    const settingStates = [...element.querySelectorAll('.ui-menu-setting-state')]
      .map(state => state.textContent.trim());
    return {
      focusedId: document.activeElement?.id || '',
      focusableIds: focusables.map(item => item.id),
      settingCount: element.querySelectorAll('.ui-menu-setting').length,
      settingStates,
      primaryAction: element.querySelector('.ui-menu-confirm-btn.primary')?.textContent.trim() || '',
      dangerAction: element.querySelector('.ui-menu-confirm-btn.danger')?.textContent.trim() || '',
      actionOrder: [...element.querySelectorAll('.ui-menu-confirm-btn')]
        .map(button => button.textContent.trim())
    };
  });
}

test('移动端应收纳低频控制，并让暂停菜单优先安全返回游戏', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });

  await enterSavedGame(page, { width: 390, height: 844 });
  const mobileControls = await readPersistentControls(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-gameplay.png') });

  await page.locator('#ui-menu-toggle').click();
  const modal = page.locator('#ui-menu-confirm');
  await expect(modal).toHaveClass(/visible/);
  const menu = await readPauseMenu(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-pause-menu.png') });

  const lastFocusableId = menu.focusableIds.at(-1);
  if (lastFocusableId) {
    await page.locator(`#${lastFocusableId}`).focus();
    await page.keyboard.press('Tab');
  }
  const focusAfterLastTab = await page.evaluate(() => document.activeElement?.id || '');
  const focusWrapped = focusAfterLastTab === menu.focusableIds[0];

  const settingFlow = {
    soundChanged: false,
    narrationChanged: false,
    voiceChanged: false
  };
  if (PHASE === 'after') {
    for (const [key, selector] of Object.entries({
      soundChanged: '#ui-menu-sound-setting',
      narrationChanged: '#ui-menu-narration-setting',
      voiceChanged: '#ui-menu-voice-setting'
    })) {
      const button = page.locator(selector);
      const before = await button.locator('.ui-menu-setting-state').textContent();
      await button.click();
      const after = await button.locator('.ui-menu-setting-state').textContent();
      settingFlow[key] = before !== after;
    }
  }

  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/visible/);
  const focusRestoredToMenu = await page.evaluate(
    () => document.activeElement?.id === 'ui-menu-toggle'
  );

  await page.setViewportSize({ width: 900, height: 560 });
  const desktopControls = await readPersistentControls(page);

  const report = {
    schemaVersion: 1,
    round: 'R011',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    mobileViewport: { width: 390, height: 844 },
    mobileControls,
    desktopControls,
    menu,
    focusAfterLastTab,
    focusWrapped,
    focusRestoredToMenu,
    settingFlow
  };
  report.passed = mobileControls.count > 0 &&
    desktopControls.count > 0 &&
    menu.actionOrder.includes('继续游戏') &&
    menu.actionOrder.includes('返回菜单');
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(mobileControls.count).toBe(2);
    expect(mobileControls.count).toBeLessThan(before.mobileControls.count);
    expect(mobileControls.union.area).toBeLessThan(before.mobileControls.union.area);
    expect(desktopControls.count).toBe(4);
    expect(menu.settingCount).toBe(3);
    expect(menu.primaryAction).toBe('继续游戏');
    expect(menu.dangerAction).toBe('返回菜单');
    expect(focusWrapped).toBeTruthy();
    expect(focusRestoredToMenu).toBeTruthy();
    expect(Object.values(settingFlow).every(Boolean)).toBeTruthy();
  }
});
