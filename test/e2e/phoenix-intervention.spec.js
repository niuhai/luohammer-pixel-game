import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R029', PHASE);
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

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async crashEvent => {
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
      _phoenixRevive: 1,
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
      delayedCall(_delay, callback) {
        const id = window.setTimeout(callback, 0);
        return { remove: () => window.clearTimeout(id) };
      }
    };
    scene.audio = {
      playAchievementRare() {},
      playPressureWarning() {}
    };
    scene.stats = { update() {} };
    scene._playCrashSequence = () => {};
    scene._replaceCharacterNameInText = text => text;
    scene._applyEffectsWithTalentFeedback = (effects = {}) => {
      for (const [key, value] of Object.entries(effects)) {
        if (typeof value === 'number') scene.state[key] = (scene.state[key] || 0) + value;
      }
    };
    scene._proceedAfterChoice = () => {
      window.__r029Probe.unexpectedFlow += 1;
    };
    scene._goToNextNode = () => {
      window.__r029Probe.unexpectedFlow += 1;
    };
    scene.dialog = new DialogSystem(scene);
    scene.choices = new ChoiceSystem(scene);
    scene.consequenceOverlay = new ConsequenceOverlay(scene);

    window.__r029Probe = {
      scene,
      toast,
      crashEvent,
      flowCompletions: 0,
      unexpectedFlow: 0
    };
  }, CRASH_EVENT);
}

async function resetProbe(page) {
  await page.evaluate(() => {
    const probe = window.__r029Probe;
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
      pride: 6,
      wealth: 5,
      reputation: 5,
      failures: 1,
      pressure: 10,
      pressureMax: 10,
      trust: 5,
      _phoenixRevive: 1,
      flags: new Set()
    });
    probe.flowCompletions = 0;
    probe.unexpectedFlow = 0;
  });
  await page.waitForTimeout(260);
}

async function showOffer(page) {
  await page.evaluate(() => {
    const probe = window.__r029Probe;
    probe.scene._offerPhoenixRevive(
      probe.crashEvent,
      { label: '原选择', next: 'next' },
      false,
      () => { probe.flowCompletions += 1; }
    );
  });

  if (PHASE === 'before') {
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
    await expect(page.locator('#ui-dialog-name')).toHaveText('▲ 不死鸟觉醒');
    await page.evaluate(() => {
      const { dialog } = window.__r029Probe.scene;
      dialog.skipTyping();
      dialog._onDialogClick();
    });
    await expect(page.locator('#ui-choices')).toHaveClass(/visible/);
  } else {
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'decision'
    );
    await page.waitForTimeout(350);
  }
}

async function readOffer(page) {
  return page.evaluate(() => {
    const probe = window.__r029Probe;
    const modern = document.querySelector('#ui-consequence-overlay.visible');
    const choices = modern
      ? [...modern.querySelectorAll('.ui-consequence-choice')]
      : [...document.querySelectorAll('#ui-choices.visible .ui-choice-btn')];
    const card = modern?.querySelector('.ui-consequence-card');
    const dialog = document.querySelector('#ui-dialog.visible');
    const rect = (card || dialog)?.getBoundingClientRect();
    const text = (modern?.textContent || dialog?.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      stage: modern?.getAttribute('data-consequence-stage') || 'legacy-decision',
      title: modern
        ? modern.querySelector('#ui-consequence-title')?.textContent.trim()
        : document.getElementById('ui-dialog-name')?.textContent.trim(),
      role: modern?.getAttribute('role') || dialog?.getAttribute('role'),
      ariaModal: modern?.getAttribute('aria-modal') || null,
      choiceCount: choices.length,
      effectCount: modern?.querySelectorAll('.ui-consequence-effect').length || 0,
      noteCount: modern?.querySelectorAll('.ui-consequence-choice-note').length || 0,
      causeCount: modern?.querySelectorAll('.ui-consequence-cause').length || 0,
      exactChargeVisible: text.includes('剩余复活 1 次') || text.includes('剩余机会 1 次'),
      safeLineVisible: text.includes('压力 3') || text.includes('降至 3'),
      preserveCostVisible: text.includes('进入 2 个崩溃恢复方案'),
      focusInside: modern
        ? modern.contains(document.activeElement)
        : document.getElementById('ui-choices')?.contains(document.activeElement),
      minChoiceHeight: choices.length
        ? Math.min(...choices.map(choice => choice.getBoundingClientRect().height))
        : 0,
      touchActions: choices.map(choice => getComputedStyle(choice).touchAction),
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null,
      pressure: probe.scene.state.pressure,
      charges: probe.scene.state._phoenixRevive,
      flowCompletions: probe.flowCompletions
    };
  });
}

async function chooseRevive(page) {
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

async function readReviveResult(page) {
  return page.evaluate(() => {
    const probe = window.__r029Probe;
    const overlay = document.querySelector('#ui-consequence-overlay.visible');
    const card = overlay?.querySelector('.ui-consequence-card');
    const rect = card?.getBoundingClientRect();
    return {
      visible: Boolean(overlay),
      stage: overlay?.getAttribute('data-consequence-stage') || null,
      pressureTransition: Boolean(
        overlay?.querySelector('.ui-consequence-pressure-transition')
      ),
      resourceTransition: Boolean(
        overlay?.querySelector('.ui-consequence-resource-transition')
      ),
      skippedPenaltyVisible: (overlay?.textContent || '').includes('跳过崩溃'),
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      actionHeight: overlay
        ? Math.round(
          overlay.querySelector('.ui-consequence-continue')?.getBoundingClientRect().height || 0
        )
        : 0,
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null,
      pressure: probe.scene.state.pressure,
      charges: probe.scene.state._phoenixRevive,
      flowCompletions: probe.flowCompletions,
      toastVisible: Boolean(document.querySelector('.toast-item.show'))
    };
  });
}

async function finishRevive(page) {
  if (PHASE !== 'after') return;
  await page.locator('#ui-consequence-continue').click();
  await expect.poll(
    () => page.evaluate(() => window.__r029Probe.flowCompletions)
  ).toBe(1);
}

async function choosePreserve(page) {
  const selector = PHASE === 'before'
    ? '#ui-choices.visible .ui-choice-btn'
    : '#ui-consequence-overlay .ui-consequence-choice';
  await page.locator(selector).nth(1).click();
  if (PHASE === 'after') {
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'result'
    );
  } else {
    await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
      'data-consequence-stage',
      'decision'
    );
  }
}

async function readPreserveResult(page) {
  return page.evaluate(() => {
    const probe = window.__r029Probe;
    const overlay = document.querySelector('#ui-consequence-overlay.visible');
    return {
      stage: overlay?.getAttribute('data-consequence-stage') || null,
      title: overlay?.querySelector('#ui-consequence-title')?.textContent.trim() || null,
      resourceTransition: Boolean(
        overlay?.querySelector('.ui-consequence-resource-transition')
      ),
      preserveVisible: (overlay?.textContent || '').includes('复活机会已保留'),
      charges: probe.scene.state._phoenixRevive,
      pressure: probe.scene.state.pressure
    };
  });
}

async function handoffToCrash(page) {
  if (PHASE === 'after') {
    await page.locator('#ui-consequence-continue').click();
  }
  await expect(page.locator('#ui-consequence-overlay')).toHaveAttribute(
    'data-consequence-stage',
    'decision'
  );
  await expect(page.locator('#ui-consequence-title')).toHaveText('压力到达极限');
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const probe = window.__r029Probe;
    return {
      title: document.getElementById('ui-consequence-title')?.textContent.trim(),
      choiceCount: document.querySelectorAll('.ui-consequence-choice').length,
      charges: probe.scene.state._phoenixRevive,
      pressure: probe.scene.state.pressure
    };
  });
}

test.describe('R029 不死鸟技能介入', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口比较机会消耗、复活结果与保留后的崩溃交接', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetProbe(page);
      await showOffer(page);
      const offer = await readOffer(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-phoenix-offer.png`)
        });
      }
      await chooseRevive(page);
      const reviveResult = await readReviveResult(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-phoenix-revive-result.png`)
        });
      }
      await finishRevive(page);

      await resetProbe(page);
      await showOffer(page);
      await choosePreserve(page);
      const preserveResult = await readPreserveResult(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-phoenix-preserve-result.png`)
        });
      }
      const crashHandoff = await handoffToCrash(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-phoenix-crash-handoff.png`)
        });
      }

      matrix.push({
        id: viewport.id,
        offer,
        reviveResult,
        preserveResult,
        crashHandoff
      });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'phoenix-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );

    for (const row of matrix) {
      expect(row.offer.choiceCount).toBe(2);
      expect(row.offer.safeLineVisible).toBe(true);
      expect(row.offer.minChoiceHeight).toBeGreaterThanOrEqual(44);
      if (PHASE === 'before') {
        expect(row.offer.stage).toBe('legacy-decision');
        expect(row.offer.effectCount).toBe(0);
        expect(row.offer.noteCount).toBe(0);
        expect(row.offer.causeCount).toBe(0);
        expect(row.offer.exactChargeVisible).toBe(false);
        expect(row.offer.preserveCostVisible).toBe(false);
        expect(row.offer.pressure).toBe(10);
        expect(row.offer.charges).toBe(1);
        expect(row.reviveResult.visible).toBe(false);
        expect(row.reviveResult.pressure).toBe(3);
        expect(row.reviveResult.charges).toBe(0);
        expect(row.reviveResult.flowCompletions).toBe(1);
        expect(row.reviveResult.toastVisible).toBe(true);
        expect(row.preserveResult.stage).toBe('decision');
      } else {
        expect(row.offer.stage).toBe('decision');
        expect(row.offer.role).toBe('dialog');
        expect(row.offer.ariaModal).toBe('true');
        expect(row.offer.effectCount).toBeGreaterThanOrEqual(1);
        expect(row.offer.noteCount).toBe(2);
        expect(row.offer.causeCount).toBe(1);
        expect(row.offer.exactChargeVisible).toBe(true);
        expect(row.offer.preserveCostVisible).toBe(true);
        expect(row.offer.focusInside).toBe(true);
        expect(row.offer.touchActions.every(value => value === 'manipulation')).toBe(true);
        expect(row.offer.withinViewport).toBe(true);
        expect(row.offer.pressure).toBe(10);
        expect(row.offer.charges).toBe(1);
        expect(row.offer.flowCompletions).toBe(0);
        expect(row.reviveResult.visible).toBe(true);
        expect(row.reviveResult.stage).toBe('result');
        expect(row.reviveResult.pressureTransition).toBe(true);
        expect(row.reviveResult.resourceTransition).toBe(true);
        expect(row.reviveResult.skippedPenaltyVisible).toBe(true);
        expect(row.reviveResult.focusInside).toBe(true);
        expect(row.reviveResult.actionHeight).toBeGreaterThanOrEqual(44);
        expect(row.reviveResult.withinViewport).toBe(true);
        expect(row.reviveResult.pressure).toBe(3);
        expect(row.reviveResult.charges).toBe(0);
        expect(row.reviveResult.flowCompletions).toBe(0);
        expect(row.reviveResult.toastVisible).toBe(false);
        expect(row.preserveResult.stage).toBe('result');
        expect(row.preserveResult.title).toBe('复活机会已保留');
        expect(row.preserveResult.resourceTransition).toBe(true);
        expect(row.preserveResult.preserveVisible).toBe(true);
      }
      expect(row.preserveResult.charges).toBe(1);
      expect(row.preserveResult.pressure).toBe(10);
      expect(row.crashHandoff.title).toBe('压力到达极限');
      expect(row.crashHandoff.choiceCount).toBe(2);
      expect(row.crashHandoff.charges).toBe(1);
      expect(row.crashHandoff.pressure).toBe(10);
    }
  });
});
