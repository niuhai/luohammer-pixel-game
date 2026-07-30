import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R027', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const CRASH_EVENT = {
  id: 'pressure_crash',
  text: '你撑不住了。压力已经到了极限，你必须决定怎样让自己重新站稳。',
  choices: [
    {
      label: '承认崩溃，停下来重新整理',
      effects: { pride: -2, reputation: -1, pressure: -5, failures: 1 }
    },
    {
      label: '咬牙撑住，先把眼前的事做完',
      effects: { pressure: -3 }
    }
  ]
};

const THRESHOLD_TRIGGER = {
  id: 'stress_erosion_trust',
  title: '高压正在侵蚀信任',
  cause: '压力 7 ≥ 触发线 7，且信任 5 ≥ 5',
  text: '高压之下你开始对身边人失去耐心。一次失控的争吵后，你发现信任正在流失。',
  effects: { trust: -1, pressure: 1 },
  flag: 'stress_erosion_trust_triggered'
};

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async ({ crashEvent, thresholdTrigger }) => {
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const rotate = document.getElementById('rotate-hint');
    if (rotate) rotate.style.display = 'none';

    const [{ GameScene }, { DialogSystem }, { ChoiceSystem }] = await Promise.all([
      import('/luohammer-pixel-game/src/scenes/GameScene.js'),
      import('/luohammer-pixel-game/src/systems/DialogSystem.js'),
      import('/luohammer-pixel-game/src/systems/ChoiceSystem.js')
    ]);
    const consequenceModule = await import(
      '/luohammer-pixel-game/src/ui/ConsequenceOverlay.js'
    ).catch(() => null);

    const keyboardHandlers = new Map();
    const scene = Object.create(GameScene.prototype);
    scene.state = {
      pride: 6,
      wealth: 5,
      reputation: 5,
      failures: 1,
      pressure: 10,
      pressureMax: 10,
      trust: 5,
      currentNode: 'act6_night',
      currentStageId: 'dark',
      talentSpecials: [],
      flags: new Set(),
      history: [],
      achievements: []
    };
    scene.input = {
      keyboard: {
        on(name, handler) {
          keyboardHandlers.set(handler, name);
          if (name === 'keydown') window.addEventListener('keydown', handler);
        },
        off(name, handler) {
          keyboardHandlers.delete(handler);
          if (name === 'keydown') window.removeEventListener('keydown', handler);
        }
      }
    };
    scene.vibrate = () => {};
    scene.isGameplayInputBlocked = () => false;
    scene._trackedTimeout = (callback, delay) => window.setTimeout(callback, delay);
    scene.time = {
      now: 0,
      delayedCall(_delay, callback) {
        const id = window.setTimeout(callback, 0);
        return { remove: () => window.clearTimeout(id) };
      }
    };
    scene.audio = {
      playPressureWarning() {},
      playThresholdTrigger() {},
      playAchievementRare() {}
    };
    scene.stats = { update() {} };
    scene._playCrashSequence = () => {};
    scene._recordDirectTalentTrigger = () => {};
    scene._replaceCharacterNameInText = text => text;
    scene._applyEffectsWithTalentFeedback = (effects = {}) => {
      for (const [key, value] of Object.entries(effects)) {
        if (typeof value === 'number') scene.state[key] = (scene.state[key] || 0) + value;
      }
    };
    scene._proceedAfterChoice = () => {
      window.__r027Probe.flowCompletions += 1;
    };
    scene._goToNextNode = () => {
      window.__r027Probe.flowCompletions += 1;
    };
    scene.dialog = new DialogSystem(scene);
    scene.choices = new ChoiceSystem(scene);
    if (consequenceModule?.ConsequenceOverlay) {
      scene.consequenceOverlay = new consequenceModule.ConsequenceOverlay(scene);
    }

    window.__r027Probe = {
      scene,
      crashEvent,
      thresholdTrigger,
      flowCompletions: 0,
      thresholdCompletions: 0
    };
  }, { crashEvent: CRASH_EVENT, thresholdTrigger: THRESHOLD_TRIGGER });
}

async function resetProbe(page, state = {}) {
  await page.evaluate((nextState) => {
    const probe = window.__r027Probe;
    probe.scene.consequenceOverlay?.hide();
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
    document.querySelectorAll('.ui-crash-burst-title, .ui-crash-burst-ring').forEach(
      element => element.remove()
    );
    Object.assign(probe.scene.state, {
      pride: 6,
      wealth: 5,
      reputation: 5,
      failures: 1,
      pressure: 10,
      pressureMax: 10,
      trust: 5,
      flags: new Set(),
      ...nextState
    });
  }, state);
}

async function showCrashDecision(page) {
  await page.evaluate(() => {
    const { scene, crashEvent } = window.__r027Probe;
    scene._handlePressureCrash(crashEvent, { label: '原选择', next: 'next' });
  });

  if (PHASE === 'before') {
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
    await page.evaluate(() => {
      const { dialog } = window.__r027Probe.scene;
      dialog.skipTyping();
      dialog._onDialogClick();
    });
    await expect(page.locator('#ui-choices')).toHaveClass(/visible/);
  } else {
    await expect(page.locator('#ui-consequence-overlay')).toHaveClass(/visible/);
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'decision'
    );
    await page.waitForTimeout(350);
  }
}

async function readCrashState(page) {
  return page.evaluate(() => {
    const modern = document.querySelector('#ui-consequence-overlay.visible');
    const root = modern || document;
    const choices = modern
      ? [...modern.querySelectorAll('.ui-consequence-choice')]
      : [...document.querySelectorAll('#ui-choices.visible .ui-choice-btn')];
    const card = modern?.querySelector('.ui-consequence-card');
    const dialog = document.querySelector('#ui-dialog.visible');
    const viewport = { width: innerWidth, height: innerHeight };
    const cardRect = (card || dialog)?.getBoundingClientRect();
    return {
      role: modern?.getAttribute('role') || dialog?.getAttribute('role'),
      ariaModal: modern?.getAttribute('aria-modal') || null,
      focusInside: modern
        ? modern.contains(document.activeElement)
        : document.getElementById('ui-choices')?.contains(document.activeElement),
      stage: modern?.getAttribute('data-consequence-stage') || 'legacy-decision',
      title: modern
        ? modern.querySelector('#ui-consequence-title')?.textContent.trim()
        : document.getElementById('ui-dialog-name')?.textContent.trim(),
      causeCount: root.querySelectorAll('.ui-consequence-cause').length,
      choiceCount: choices.length,
      effectCount: root.querySelectorAll('.ui-consequence-effect').length,
      minChoiceHeight: choices.length
        ? Math.min(...choices.map(choice => choice.getBoundingClientRect().height))
        : 0,
      touchActions: choices.map(choice => getComputedStyle(choice).touchAction),
      withinViewport: cardRect
        ? cardRect.left >= 0 && cardRect.right <= viewport.width &&
          cardRect.top >= 0 && cardRect.bottom <= viewport.height
        : null,
      text: (modern?.textContent || dialog?.textContent || '').replace(/\s+/g, ' ').trim()
    };
  });
}

async function chooseFirstCrashAction(page) {
  const selector = PHASE === 'before'
    ? '#ui-choices.visible .ui-choice-btn'
    : '#ui-consequence-overlay .ui-consequence-choice';
  await page.locator(selector).first().click();
  if (PHASE === 'after') {
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'result'
    );
  } else {
    await page.waitForTimeout(80);
  }
}

async function readCrashResult(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('#ui-consequence-overlay.visible');
    const action = overlay?.querySelector('.ui-consequence-continue');
    const card = overlay?.querySelector('.ui-consequence-card');
    const rect = card?.getBoundingClientRect();
    return {
      visible: Boolean(overlay),
      stage: overlay?.getAttribute('data-consequence-stage') || null,
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      selectedVisible: (overlay?.textContent || '').includes('承认崩溃'),
      pressureTransitionVisible: Boolean(
        overlay?.querySelector('.ui-consequence-pressure-transition')
      ),
      effectCount: overlay?.querySelectorAll('.ui-consequence-effect').length || 0,
      actionHeight: action ? Math.round(action.getBoundingClientRect().height) : 0,
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null
    };
  });
}

async function showThreshold(page) {
  await page.evaluate(() => {
    const { scene, thresholdTrigger } = window.__r027Probe;
    scene._showThresholdTriggers(
      [thresholdTrigger],
      0,
      () => { window.__r027Probe.thresholdCompletions += 1; },
      { label: '原选择', next: 'next' }
    );
  });
  if (PHASE === 'before') {
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
    await expect(page.locator('#ui-dialog-name')).toHaveText('✦ 隐藏事件');
  } else {
    await expect(page.locator('#ui-consequence-overlay')).toHaveClass(/visible/);
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'notice'
    );
    await page.waitForTimeout(350);
  }
}

async function readThresholdState(page) {
  return page.evaluate(() => {
    const modern = document.querySelector('#ui-consequence-overlay.visible');
    const action = modern?.querySelector('.ui-consequence-continue');
    const card = modern?.querySelector('.ui-consequence-card');
    const dialog = document.querySelector('#ui-dialog.visible');
    const rect = (card || dialog)?.getBoundingClientRect();
    return {
      role: modern?.getAttribute('role') || dialog?.getAttribute('role'),
      ariaModal: modern?.getAttribute('aria-modal') || null,
      stage: modern?.getAttribute('data-consequence-stage') || 'legacy-notice',
      title: modern
        ? modern.querySelector('#ui-consequence-title')?.textContent.trim()
        : document.getElementById('ui-dialog-name')?.textContent.trim(),
      causeCount: modern?.querySelectorAll('.ui-consequence-cause').length || 0,
      effectCount: modern?.querySelectorAll('.ui-consequence-effect').length || 0,
      progressVisible: Boolean(modern?.querySelector('.ui-consequence-progress')),
      focusInside: Boolean(modern?.contains(document.activeElement)),
      actionHeight: action ? Math.round(action.getBoundingClientRect().height) : 0,
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null,
      text: (modern?.textContent || dialog?.textContent || '').replace(/\s+/g, ' ').trim()
    };
  });
}

test.describe('R027 压力崩溃与阈值结果链', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口保持崩溃选择、结果和阈值原因可读可达', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetProbe(page);
      await showCrashDecision(page);
      const crash = await readCrashState(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-crash-decision.png`)
        });
      }

      await chooseFirstCrashAction(page);
      const crashResult = await readCrashResult(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-crash-result.png`)
        });
      }

      await resetProbe(page, { pressure: 7, trust: 5 });
      await showThreshold(page);
      const threshold = await readThresholdState(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-threshold.png`)
        });
      }
      matrix.push({ id: viewport.id, crash, crashResult, threshold });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'consequence-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );

    for (const row of matrix) {
      expect(row.crash.choiceCount).toBe(2);
      expect(row.crash.minChoiceHeight).toBeGreaterThanOrEqual(44);
      if (PHASE === 'before') {
        expect(row.crash.causeCount).toBe(0);
        expect(row.crash.effectCount).toBe(0);
        expect(row.crashResult.visible).toBe(false);
        expect(row.threshold.title).toBe('✦ 隐藏事件');
        expect(row.threshold.causeCount).toBe(0);
        expect(row.threshold.effectCount).toBe(0);
        expect(row.threshold.progressVisible).toBe(false);
      } else {
        expect(row.crash.role).toBe('dialog');
        expect(row.crash.ariaModal).toBe('true');
        expect(row.crash.focusInside).toBe(true);
        expect(row.crash.causeCount).toBe(1);
        expect(row.crash.effectCount).toBeGreaterThanOrEqual(5);
        expect(row.crash.touchActions.every(value => value === 'manipulation')).toBe(true);
        expect(row.crash.withinViewport).toBe(true);
        expect(row.crashResult.visible).toBe(true);
        expect(row.crashResult.stage).toBe('result');
        expect(row.crashResult.focusInside).toBe(true);
        expect(row.crashResult.selectedVisible).toBe(true);
        expect(row.crashResult.pressureTransitionVisible).toBe(true);
        expect(row.crashResult.actionHeight).toBeGreaterThanOrEqual(44);
        expect(row.crashResult.withinViewport).toBe(true);
        expect(row.threshold.role).toBe('dialog');
        expect(row.threshold.ariaModal).toBe('true');
        expect(row.threshold.stage).toBe('notice');
        expect(row.threshold.title).toBe('高压正在侵蚀信任');
        expect(row.threshold.causeCount).toBe(1);
        expect(row.threshold.effectCount).toBe(2);
        expect(row.threshold.progressVisible).toBe(true);
        expect(row.threshold.focusInside).toBe(true);
        expect(row.threshold.actionHeight).toBeGreaterThanOrEqual(44);
        expect(row.threshold.withinViewport).toBe(true);
      }
    }
  });
});
