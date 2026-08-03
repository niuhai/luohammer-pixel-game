import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R018');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

async function openDialogProbe(page) {
  await page.evaluate(async () => {
    window.__dialogContinueProbe?.dialog?.destroy();
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
      state: { currentNode: null },
      vibrate() {},
      isGameplayInputBlocked() {
        return false;
      }
    };
    const dialog = new DialogSystem(scene);
    const probe = {
      dialog,
      advanceCalls: 0,
      completionCalls: 0
    };
    const originalAdvance = dialog._onDialogClick.bind(dialog);
    dialog._onDialogClick = () => {
      probe.advanceCalls += 1;
      return originalAdvance();
    };
    const longText = [
      '做产品最难的并不是把一个按钮摆到屏幕上，而是让玩家一眼知道此刻能做什么、做完会发生什么。',
      '当文字仍在出现时，继续操作应该明确表示显示全文；当一段读完时，它又应该准确告诉玩家将进入下一段。',
      '自动播放开启以后，玩家依旧需要保留立即推进的权利，但一次点击或一次按键只能推动一次剧情，不能跨过重要内容。',
      '最后一段结束时，控件还要把焦点安全交给后续选择，让触控、键盘和读屏体验遵循同一套清楚的状态。'
    ].join('');
    dialog.show('罗永浩', longText, () => {
      probe.completionCalls += 1;
    }, 'reflective');
    window.__dialogContinueProbe = probe;
  });
  await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
  await page.waitForTimeout(220);
}

async function readContinueState(page) {
  return page.locator('#ui-dialog').evaluate(dialog => {
    const control = dialog.querySelector('#ui-dialog-continue');
    const box = control.getBoundingClientRect();
    const dialogBox = dialog.getBoundingClientRect();
    return {
      tagName: control.tagName,
      type: control.getAttribute('type') || '',
      state: control.dataset.state || '',
      text: control.textContent.replace(/\s+/g, ' ').trim(),
      ariaLabel: control.getAttribute('aria-label') || '',
      ariaKeyShortcuts: control.getAttribute('aria-keyshortcuts') || '',
      hidden: control.hidden || getComputedStyle(control).display === 'none',
      focusable: control.tabIndex >= 0,
      focused: document.activeElement === control,
      height: Math.round(box.height),
      width: Math.round(box.width),
      dialogBox: {
        left: Math.round(dialogBox.left),
        top: Math.round(dialogBox.top),
        right: Math.round(dialogBox.right),
        bottom: Math.round(dialogBox.bottom)
      },
      viewport: {
        width: innerWidth,
        height: innerHeight
      }
    };
  });
}

test('剧情继续控件应表达打字、分段与自动播放状态且单次推进', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/');
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDialogProbe(page);

  const typing = await readContinueState(page);
  await page.screenshot({
    path: path.join(OUT, 'desktop-typing-control.png')
  });
  await page.evaluate(() => window.__dialogContinueProbe.dialog.skipTyping());
  const desktopReady = await readContinueState(page);
  await page.screenshot({
    path: path.join(OUT, 'desktop-continue-control.png')
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileReady = await readContinueState(page);
  await page.screenshot({
    path: path.join(OUT, 'mobile-continue-control.png')
  });

  await page.setViewportSize({ width: 375, height: 812 });
  const mobileGuard = await readContinueState(page);
  await page.screenshot({
    path: path.join(OUT, 'mobile-375-continue-control.png')
  });

  const callsBeforeEnter = await page.evaluate(
    () => window.__dialogContinueProbe.advanceCalls
  );
  await page.locator('#ui-dialog-continue').focus();
  const focusedBeforeEnter = await page.evaluate(
    () => document.activeElement?.id === 'ui-dialog-continue'
  );
  await page.keyboard.press('Enter');
  await page.waitForTimeout(220);
  const callsAfterEnter = await page.evaluate(
    () => window.__dialogContinueProbe.advanceCalls
  );
  const nextSegmentTyping = await readContinueState(page);

  await page.evaluate(() => {
    const { dialog } = window.__dialogContinueProbe;
    dialog.skipTyping();
    const last = dialog._segments.length - 1;
    if (dialog._segmentIndex !== last) dialog._showSegment(last);
  });
  await page.waitForTimeout(220);
  await page.evaluate(() => window.__dialogContinueProbe.dialog.skipTyping());
  const finalReady = await readContinueState(page);

  await page.locator('#ui-dialog-auto').click();
  const autoReady = await readContinueState(page);
  await page.evaluate(() =>
    window.__dialogContinueProbe.dialog.notifyChoicesVisible(true)
  );
  const choiceState = await readContinueState(page);

  const report = {
    schemaVersion: 1,
    round: 'R018',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    typing,
    desktopReady,
    mobileReady,
    mobileGuard,
    keyboardFlow: {
      focusedBeforeEnter,
      advanceDelta: callsAfterEnter - callsBeforeEnter
    },
    nextSegmentTyping,
    finalReady,
    autoReady,
    choiceState
  };
  report.passed = desktopReady.dialogBox.left >= 0 &&
    desktopReady.dialogBox.right <= desktopReady.viewport.width &&
    mobileReady.dialogBox.left >= 0 &&
    mobileReady.dialogBox.right <= mobileReady.viewport.width &&
    mobileGuard.dialogBox.left >= 0 &&
    mobileGuard.dialogBox.right <= mobileGuard.viewport.width &&
    report.keyboardFlow.advanceDelta === 1;
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.typing.hidden).toBeTruthy();
    expect(before.desktopReady.tagName).toBe('DIV');
    expect(before.desktopReady.focusable).toBeFalsy();
    expect(before.desktopReady.height).toBeLessThan(44);

    expect(typing.tagName).toBe('BUTTON');
    expect(typing.type).toBe('button');
    expect(typing.state).toBe('typing');
    expect(typing.text).toContain('显示本段全文');
    expect(typing.hidden).toBeFalsy();
    expect(desktopReady.state).toBe('next-segment');
    expect(desktopReady.text).toContain('下一段');
    expect(desktopReady.ariaLabel).toContain('共');
    expect(desktopReady.height).toBeGreaterThanOrEqual(44);
    expect(mobileReady.height).toBeGreaterThanOrEqual(44);
    expect(mobileReady.dialogBox.bottom).toBeLessThanOrEqual(
      mobileReady.viewport.height
    );
    expect(mobileGuard.height).toBeGreaterThanOrEqual(44);
    expect(mobileGuard.dialogBox.bottom).toBeLessThanOrEqual(
      mobileGuard.viewport.height
    );
    expect(report.keyboardFlow.focusedBeforeEnter).toBeTruthy();
    expect(report.keyboardFlow.advanceDelta).toBe(1);
    expect(nextSegmentTyping.state).toBe('typing');
    expect(finalReady.state).toBe('continue');
    expect(finalReady.text).toContain('继续剧情');
    expect(autoReady.state).toBe('auto');
    expect(autoReady.text).toContain('自动');
    expect(choiceState.hidden).toBeTruthy();
    expect(choiceState.height).toBe(0);
  }

  await page.evaluate(() => window.__dialogContinueProbe?.dialog?.destroy());
});
