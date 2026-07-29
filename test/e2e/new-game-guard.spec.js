import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R013');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

const SAVED_STATE = {
  pride: 7,
  wealth: 5,
  reputation: 6,
  failures: 1,
  pressure: 2,
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
  gameStartTime: Date.now() - 120_000
};

async function openReturningTitle(page) {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.evaluate(state => {
    localStorage.clear();
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    localStorage.setItem('luohammer_intro_seen', '1');
    localStorage.setItem('luohammer_orientation_hint_seen', '1');
  }, SAVED_STATE);
  await page.reload();
  await expect(page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }))
    .toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ui-boot-buttons button', { hasText: '新游戏' }))
    .toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
}

async function hasAutoSave(page) {
  return page.evaluate(() =>
    localStorage.getItem('luohammer_save') !== null &&
    localStorage.getItem('luohammer_save_backup') !== null
  );
}

test('新游戏应先警告且支持键盘、失焦和超时取消，再执行清档', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await openReturningTitle(page);
  const newGameButton = page.locator('.ui-boot-btn-danger');
  const saveBefore = await hasAutoSave(page);
  await page.screenshot({ path: path.join(OUT, 'new-game-idle.png') });

  await newGameButton.click();
  await page.waitForTimeout(200);
  const firstClick = {
    stayedOnTitle: await page.locator('#ui-boot-overlay').isVisible(),
    introVisible: await page.locator('#ui-intro-overlay').isVisible(),
    savePreserved: await hasAutoSave(page),
    confirming: await newGameButton.getAttribute('data-confirming').catch(() => null),
    text: await newGameButton.textContent().catch(() => '')
  };
  await page.screenshot({ path: path.join(OUT, 'new-game-first-click.png') });

  const cancellation = {
    escapeReset: false,
    blurReset: false,
    timeoutReset: false,
    savePreserved: false
  };
  let finalConfirmation = {
    introVisible: firstClick.introVisible,
    saveCleared: !firstClick.savePreserved
  };

  if (PHASE === 'after') {
    await page.keyboard.press('Escape');
    cancellation.escapeReset =
      await newGameButton.getAttribute('data-confirming') !== 'true' &&
      (await newGameButton.textContent())?.trim() === '新游戏';

    await newGameButton.click();
    await page.locator('#ui-boot-more-toggle').focus();
    cancellation.blurReset =
      await newGameButton.getAttribute('data-confirming') !== 'true';

    await newGameButton.click();
    await page.waitForTimeout(3_700);
    cancellation.timeoutReset =
      await newGameButton.getAttribute('data-confirming') !== 'true';
    cancellation.savePreserved = await hasAutoSave(page);

    await newGameButton.click();
    await expect(newGameButton).toHaveAttribute('data-confirming', 'true');
    await newGameButton.click();
    await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
    finalConfirmation = {
      introVisible: await page.locator('#ui-intro-overlay').isVisible(),
      saveCleared: !(await hasAutoSave(page))
    };
  }

  const report = {
    schemaVersion: 1,
    round: 'R013',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    viewport: { width: 375, height: 667 },
    saveBefore,
    firstClick,
    cancellation,
    finalConfirmation
  };
  report.passed = saveBefore && (firstClick.introVisible || firstClick.stayedOnTitle);
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.firstClick.savePreserved).toBeFalsy();
    expect(firstClick.stayedOnTitle).toBeTruthy();
    expect(firstClick.introVisible).toBeFalsy();
    expect(firstClick.savePreserved).toBeTruthy();
    expect(firstClick.confirming).toBe('true');
    expect(firstClick.text).toContain('确认');
    expect(cancellation.escapeReset).toBeTruthy();
    expect(cancellation.blurReset).toBeTruthy();
    expect(cancellation.timeoutReset).toBeTruthy();
    expect(cancellation.savePreserved).toBeTruthy();
    expect(finalConfirmation.introVisible).toBeTruthy();
    expect(finalConfirmation.saveCleared).toBeTruthy();
  }
});
