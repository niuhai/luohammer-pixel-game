import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R014');
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

async function seedSaves(page) {
  await page.evaluate(async state => {
    localStorage.clear();
    localStorage.setItem('luohammer_orientation_hint_seen', '1');
    const { SaveSystem } = await import(
      '/luohammer-pixel-game/src/systems/SaveSystem.js'
    );
    const save = new SaveSystem();
    save.save(state);
    save.save({ ...state, pride: 8 }, 'slot1');
  }, SAVED_STATE);
}

async function openSavePanel(page, mode) {
  await page.evaluate(async ({ state, panelMode }) => {
    const [{ showSaveLoadPanel }, { SaveSystem }] = await Promise.all([
      import('/luohammer-pixel-game/src/ui/SaveLoadPanel.js'),
      import('/luohammer-pixel-game/src/systems/SaveSystem.js')
    ]);
    showSaveLoadPanel({
      mode: panelMode,
      saveSystem: new SaveSystem(),
      currentState: state
    });
  }, { state: SAVED_STATE, panelMode: mode });
  const panel = page.locator('#ui-saveload-overlay');
  await expect(panel).toHaveClass(/visible/);
  return panel;
}

async function readConfirmState(page) {
  return page.locator('#ui-saveload-confirm').evaluate(element => {
    const button = element.querySelector('#ui-saveload-confirm-ok');
    const cancel = element.querySelector('#ui-saveload-confirm-cancel');
    const box = element.querySelector('.ui-saveload-confirm-box');
    const style = getComputedStyle(button);
    const boxStyle = getComputedStyle(box);
    return {
      intent: element.dataset.intent || '',
      ariaHidden: element.getAttribute('aria-hidden'),
      role: element.getAttribute('role') || '',
      text: element.querySelector('#ui-saveload-confirm-text')?.textContent
        .replace(/\s+/g, ' ').trim() || '',
      kicker: element.querySelector('.ui-saveload-confirm-kicker')?.textContent
        .replace(/\s+/g, ' ').trim() || '',
      confirmLabel: button.textContent.trim(),
      confirmClass: button.className,
      confirmAriaLabel: button.getAttribute('aria-label') || '',
      cancelFocused: document.activeElement === cancel,
      confirmColor: style.color,
      confirmBorderColor: style.borderColor,
      confirmBackground: style.backgroundColor,
      boxBorderColor: boxStyle.borderColor
    };
  });
}

test('覆盖与删除存档应使用匹配的确认语义、样式和安全焦点', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
  await seedSaves(page);

  await openSavePanel(page, 'manage');
  const autoCard = page.locator('.ui-saveload-slot[data-slot-id="auto"]');
  const deleteButton = autoCard.locator('.ui-saveload-btn.danger');
  await deleteButton.click();
  await expect(page.locator('#ui-saveload-confirm')).toHaveClass(/visible/);
  const deletion = await readConfirmState(page);
  await page.screenshot({ path: path.join(OUT, 'delete-confirm.png') });

  await page.keyboard.press('Escape');
  const deleteCancel = {
    closed: !(await page.locator('#ui-saveload-confirm').evaluate(
      element => element.classList.contains('visible')
    )),
    focusReturned: await deleteButton.evaluate(element => document.activeElement === element),
    savePreserved: await page.evaluate(() => localStorage.getItem('luohammer_save') !== null)
  };
  await page.keyboard.press('Escape');
  await expect(page.locator('#ui-saveload-overlay')).toHaveCount(0, { timeout: 2_000 });

  await openSavePanel(page, 'save');
  const slotOne = page.locator('.ui-saveload-slot[data-slot-id="slot1"]');
  const overwriteButton = slotOne.locator('.ui-saveload-btn.primary');
  await overwriteButton.click();
  await expect(page.locator('#ui-saveload-confirm')).toHaveClass(/visible/);
  const overwrite = await readConfirmState(page);
  await page.screenshot({ path: path.join(OUT, 'overwrite-confirm.png') });

  const report = {
    schemaVersion: 1,
    round: 'R014',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    deletion,
    deleteCancel,
    overwrite
  };
  report.passed = deletion.text.includes('删除') &&
    overwrite.text.includes('覆盖') &&
    deletion.cancelFocused &&
    overwrite.cancelFocused &&
    deleteCancel.closed &&
    deleteCancel.focusReturned &&
    deleteCancel.savePreserved;
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.deletion.confirmLabel).toBe('确认覆盖');
    expect(deletion.intent).toBe('delete');
    expect(deletion.role).toBe('alertdialog');
    expect(deletion.ariaHidden).toBe('false');
    expect(deletion.kicker).toBe('危险操作');
    expect(deletion.confirmLabel).toBe('确认删除');
    expect(deletion.confirmClass).toContain('danger');
    expect(deletion.confirmClass).not.toContain('primary');
    expect(deletion.confirmAriaLabel).toContain('确认删除');
    expect(deletion.confirmBorderColor).not.toBe(overwrite.confirmBorderColor);
    expect(deletion.boxBorderColor).not.toBe(overwrite.boxBorderColor);

    expect(overwrite.intent).toBe('overwrite');
    expect(overwrite.role).toBe('alertdialog');
    expect(overwrite.ariaHidden).toBe('false');
    expect(overwrite.kicker).toBe('覆盖存档');
    expect(overwrite.confirmLabel).toBe('确认覆盖');
    expect(overwrite.confirmClass).toContain('primary');
    expect(overwrite.confirmAriaLabel).toContain('确认覆盖');
  }
});
