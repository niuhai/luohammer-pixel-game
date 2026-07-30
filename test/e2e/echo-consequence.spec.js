import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R028', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const CONSEQUENCES = [
  {
    id: 'bookworm_consequence',
    title: '那本书改变了你',
    cause: '源自先前选择「欠钱也要把书买下来」· 青年阶段兑现',
    sourceLabel: '欠钱也要把书买下来',
    text: '你当年欠着钱也要买的那本书，改变了你看世界的方式。',
    effects: { pride: 1, reputation: 1 }
  },
  {
    id: 'fighter_consequence',
    title: '旧事被重新翻出',
    cause: '源自先前选择「打不过也要打」· 青年阶段兑现',
    sourceLabel: '打不过也要打',
    text: '你当年打架的事被人翻出来了。有人说你暴力，有人说你有担当。',
    effects: { reputation: -1, pride: 1 }
  }
];

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async consequences => {
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const rotate = document.getElementById('rotate-hint');
    if (rotate) rotate.style.display = 'none';

    const [
      { GameScene },
      { DialogSystem },
      { ChoiceSystem },
      { ConsequenceOverlay },
      { toast }
    ] = await Promise.all([
      import('/luohammer-pixel-game/src/scenes/GameScene.js'),
      import('/luohammer-pixel-game/src/systems/DialogSystem.js'),
      import('/luohammer-pixel-game/src/systems/ChoiceSystem.js'),
      import('/luohammer-pixel-game/src/ui/ConsequenceOverlay.js'),
      import('/luohammer-pixel-game/src/systems/ToastSystem.js')
    ]);

    const scene = Object.create(GameScene.prototype);
    scene.state = {
      pride: 8,
      wealth: 8,
      reputation: 5,
      failures: 0,
      pressure: 2,
      pressureMax: 10,
      trust: 5,
      currentNode: 'act6_night',
      currentStageId: 'dark',
      talentSpecials: [],
      flags: new Set(),
      triggeredEvents: new Set(),
      history: [],
      achievements: []
    };
    scene.vibrate = () => {};
    scene.isGameplayInputBlocked = () => false;
    scene._trackedTimeout = (callback, delay) => window.setTimeout(callback, delay);
    scene.time = {
      delayedCall(_delay, callback) {
        const id = window.setTimeout(callback, 0);
        return { remove: () => window.clearTimeout(id) };
      }
    };
    scene.audio = {
      playConsequence() {},
      playRandomEvent() {}
    };
    scene.stats = { update() {} };
    scene.debug = { logComboTrigger() {} };
    scene.meta = { addSeenEvent() {} };
    scene.randomEventSystem = {
      onNodeAdvanced() {},
      tryTrigger() { return false; }
    };
    scene._recordDirectTalentTrigger = () => {};
    scene._replaceCharacterNameInText = text => text;
    scene._applyEffectsWithTalentFeedback = (effects = {}) => {
      for (const [key, value] of Object.entries(effects)) {
        if (typeof value === 'number') scene.state[key] = (scene.state[key] || 0) + value;
      }
    };
    scene._goToNextNode = () => {
      window.__r028Probe.flowCompletions += 1;
    };
    scene.dialog = new DialogSystem(scene);
    scene.choices = new ChoiceSystem(scene);
    scene.consequenceOverlay = new ConsequenceOverlay(scene);

    window.__r028Probe = {
      scene,
      toast,
      consequences,
      flowCompletions: 0,
      echoCompletions: 0
    };
  }, CONSEQUENCES);
}

async function resetProbe(page, state = {}) {
  await page.evaluate(nextState => {
    const probe = window.__r028Probe;
    probe.toast.clear();
    probe.scene.consequenceOverlay.hide({ restoreFocus: false });
    probe.scene.choices.hide(true);
    probe.scene.dialog.hide();
    if (probe.scene.dialog._onHideAnimationEnd) {
      probe.scene.dialog.el.removeEventListener(
        'animationend',
        probe.scene.dialog._onHideAnimationEnd
      );
      probe.scene.dialog._onHideAnimationEnd = null;
    }
    probe.scene.dialog._finishHide();
    Object.assign(probe.scene.state, {
      pride: 8,
      wealth: 8,
      reputation: 5,
      failures: 0,
      pressure: 2,
      pressureMax: 10,
      trust: 5,
      currentNode: 'act6_night',
      currentStageId: 'dark',
      talentSpecials: [],
      flags: new Set(),
      triggeredEvents: new Set(),
      ...nextState
    });
    probe.flowCompletions = 0;
    probe.echoCompletions = 0;
  }, state);
  await page.waitForTimeout(260);
}

async function showCombo(page) {
  await page.evaluate(() => {
    window.__r028Probe.scene._proceedAfterChoice({
      label: '让理想和财富同时站上高位',
      next: 'next'
    });
  });
  if (PHASE === 'before') {
    await expect(page.locator('.toast-item.show')).toBeVisible();
  } else {
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'notice'
    );
    await page.waitForTimeout(350);
  }
}

async function readCombo(page) {
  return page.evaluate(() => {
    const probe = window.__r028Probe;
    const overlay = document.querySelector('#ui-consequence-overlay.visible');
    const card = overlay?.querySelector('.ui-consequence-card');
    const rect = card?.getBoundingClientRect();
    return {
      stage: overlay?.getAttribute('data-consequence-stage') || null,
      title: overlay?.querySelector('#ui-consequence-title')?.textContent.trim() || null,
      toastVisible: Boolean(document.querySelector('.toast-item.show')),
      causeCount: overlay?.querySelectorAll('.ui-consequence-cause').length || 0,
      effectCount: overlay?.querySelectorAll('.ui-consequence-effect').length || 0,
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      reputation: probe.scene.state.reputation,
      flowCompletions: probe.flowCompletions,
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null
    };
  });
}

async function settleCombo(page) {
  if (PHASE === 'before') {
    return {
      visible: false,
      stage: null,
      transitionCount: 0,
      reputation: await page.evaluate(() => window.__r028Probe.scene.state.reputation),
      flowBeforeFinalConfirm: await page.evaluate(
        () => window.__r028Probe.flowCompletions
      )
    };
  }

  await page.locator('#ui-consequence-continue').click();
  await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
    'data-consequence-stage',
    'result'
  );
  return page.evaluate(() => {
    const probe = window.__r028Probe;
    const overlay = document.querySelector('#ui-consequence-overlay.visible');
    return {
      visible: Boolean(overlay),
      stage: overlay?.getAttribute('data-consequence-stage') || null,
      transitionCount: overlay?.querySelectorAll('.ui-consequence-transition').length || 0,
      selectedVisible: (overlay?.textContent || '').includes('理想') &&
        (overlay?.textContent || '').includes('财富'),
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      reputation: probe.scene.state.reputation,
      flowBeforeFinalConfirm: probe.flowCompletions
    };
  });
}

async function finishCombo(page) {
  if (PHASE !== 'after') return;
  await page.locator('#ui-consequence-continue').click();
  await expect(page.locator('#ui-consequence-overlay')).not.toHaveClass(/visible/);
  await expect.poll(
    () => page.evaluate(() => window.__r028Probe.flowCompletions)
  ).toBe(1);
}

async function showEcho(page) {
  await page.evaluate(() => {
    const probe = window.__r028Probe;
    probe.scene._showConsequences(
      probe.consequences,
      0,
      () => { probe.echoCompletions += 1; }
    );
  });
  if (PHASE === 'before') {
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
    await expect(page.locator('#ui-dialog-name')).toHaveText('往事回响');
  } else {
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'notice'
    );
    await page.waitForTimeout(350);
  }
}

async function readEcho(page) {
  return page.evaluate(() => {
    const probe = window.__r028Probe;
    const overlay = document.querySelector('#ui-consequence-overlay.visible');
    const dialog = document.querySelector('#ui-dialog.visible');
    const card = overlay?.querySelector('.ui-consequence-card');
    const rect = (card || dialog)?.getBoundingClientRect();
    return {
      stage: overlay?.getAttribute('data-consequence-stage') || 'legacy-notice',
      title: overlay
        ? overlay.querySelector('#ui-consequence-title')?.textContent.trim()
        : document.getElementById('ui-dialog-name')?.textContent.trim(),
      causeCount: overlay?.querySelectorAll('.ui-consequence-cause').length || 0,
      effectCount: overlay?.querySelectorAll('.ui-consequence-effect').length || 0,
      progressVisible: Boolean(overlay?.querySelector('.ui-consequence-progress')),
      sourceVisible: (overlay?.textContent || '').includes('欠钱也要把书买下来'),
      focusInside: overlay
        ? overlay.contains(document.activeElement)
        : document.getElementById('ui-dialog')?.contains(document.activeElement),
      pride: probe.scene.state.pride,
      reputation: probe.scene.state.reputation,
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null
    };
  });
}

async function settleFirstEcho(page) {
  if (PHASE === 'before') {
    await page.evaluate(() => {
      const { dialog } = window.__r028Probe.scene;
      dialog.skipTyping();
      dialog._onDialogClick();
    });
    await page.waitForTimeout(180);
    return page.evaluate(() => {
      const probe = window.__r028Probe;
      return {
        stage: 'legacy-next',
        resultVisible: false,
        transitionCount: 0,
        pride: probe.scene.state.pride,
        reputation: probe.scene.state.reputation
      };
    });
  }

  await page.locator('#ui-consequence-continue').click();
  await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
    'data-consequence-stage',
    'result'
  );
  return page.evaluate(() => {
    const probe = window.__r028Probe;
    const overlay = document.querySelector('#ui-consequence-overlay.visible');
    return {
      stage: overlay?.getAttribute('data-consequence-stage') || null,
      resultVisible: Boolean(overlay),
      transitionCount: overlay?.querySelectorAll('.ui-consequence-transition').length || 0,
      sourceVisible: (overlay?.textContent || '').includes('欠钱也要把书买下来'),
      pride: probe.scene.state.pride,
      reputation: probe.scene.state.reputation
    };
  });
}

async function advanceEchoResult(page) {
  if (PHASE !== 'after') return null;
  await page.locator('#ui-consequence-continue').click();
  await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
    'data-consequence-stage',
    'notice'
  );
  return page.locator('#ui-consequence-progress').textContent();
}

test.describe('R028 属性联动与往事回响', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口保持来源、影响、结果与连续队列可读可操作', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetProbe(page);
      await showCombo(page);
      const combo = await readCombo(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-combo-notice.png`)
        });
      }
      const comboResult = await settleCombo(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-combo-result.png`)
        });
      }
      await finishCombo(page);

      await resetProbe(page, { pride: 5, wealth: 5 });
      await showEcho(page);
      const echo = await readEcho(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-echo-notice.png`)
        });
      }
      const echoResult = await settleFirstEcho(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-echo-result.png`)
        });
      }
      const nextProgress = await advanceEchoResult(page);
      matrix.push({
        id: viewport.id,
        combo,
        comboResult,
        echo,
        echoResult,
        nextProgress
      });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'echo-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );

    for (const row of matrix) {
      if (PHASE === 'before') {
        expect(row.combo.toastVisible).toBe(true);
        expect(row.combo.stage).toBeNull();
        expect(row.combo.causeCount).toBe(0);
        expect(row.combo.effectCount).toBe(0);
        expect(row.combo.reputation).toBe(7);
        expect(row.combo.flowCompletions).toBe(1);
        expect(row.comboResult.visible).toBe(false);
        expect(row.echo.title).toBe('往事回响');
        expect(row.echo.causeCount).toBe(0);
        expect(row.echo.effectCount).toBe(0);
        expect(row.echo.progressVisible).toBe(false);
        expect(row.echoResult.resultVisible).toBe(false);
      } else {
        expect(row.combo.toastVisible).toBe(false);
        expect(row.combo.stage).toBe('notice');
        expect(row.combo.title).toBe('理想主义富翁');
        expect(row.combo.causeCount).toBe(1);
        expect(row.combo.effectCount).toBe(1);
        expect(row.combo.focusInside).toBe(true);
        expect(row.combo.reputation).toBe(5);
        expect(row.combo.flowCompletions).toBe(0);
        expect(row.combo.withinViewport).toBe(true);
        expect(row.comboResult.visible).toBe(true);
        expect(row.comboResult.stage).toBe('result');
        expect(row.comboResult.transitionCount).toBeGreaterThanOrEqual(1);
        expect(row.comboResult.reputation).toBe(7);
        expect(row.comboResult.flowBeforeFinalConfirm).toBe(0);
        expect(row.echo.stage).toBe('notice');
        expect(row.echo.title).toBe('那本书改变了你');
        expect(row.echo.causeCount).toBe(1);
        expect(row.echo.effectCount).toBe(2);
        expect(row.echo.progressVisible).toBe(true);
        expect(row.echo.sourceVisible).toBe(true);
        expect(row.echo.focusInside).toBe(true);
        expect(row.echo.withinViewport).toBe(true);
        expect(row.echoResult.stage).toBe('result');
        expect(row.echoResult.resultVisible).toBe(true);
        expect(row.echoResult.transitionCount).toBe(2);
        expect(row.echoResult.sourceVisible).toBe(true);
        expect(row.nextProgress).toContain('2 / 2');
      }
    }
  });
});
