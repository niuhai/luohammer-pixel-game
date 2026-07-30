import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R030', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const CHOICE = {
  label: '公开回应合作方的质疑',
  check: {
    attr: 'reputation',
    min: 6,
    successNext: 'channel_support',
    failNext: 'public_doubt',
    successText: '团队获得了更多渠道支持。',
    failText: '临场回应没有压住质疑，舆论继续发酵。',
    successEffects: { reputation: 2, trust: 1 },
    failEffects: { reputation: -2, pressure: 3 }
  }
};

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async choice => {
    localStorage.setItem(
      'luohammer_dialog_settings',
      JSON.stringify({ autoPlay: false, typingSpeedIdx: 1 })
    );
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const rotate = document.getElementById('rotate-hint');
    if (rotate) rotate.style.display = 'none';

    const [{ GameScene }, { DialogSystem }] = await Promise.all([
      import('/luohammer-pixel-game/src/scenes/GameScene.js'),
      import('/luohammer-pixel-game/src/systems/DialogSystem.js')
    ]);

    const scene = Object.create(GameScene.prototype);
    scene.state = {
      pride: 5,
      wealth: 5,
      reputation: 5,
      failures: 0,
      pressure: 4,
      trust: 5,
      _freeRetry: 1,
      currentNode: 'act3_launch',
      currentStageId: 'startup',
      talentSpecials: [],
      flags: new Set(),
      history: [],
      achievements: []
    };
    scene.input = {
      keyboard: {
        on(name, handler) {
          if (name === 'keydown') window.addEventListener('keydown', handler);
        },
        off(name, handler) {
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
      playThresholdTrigger() {},
      playDialogAdvance() {}
    };
    scene.meta = { getEffect: () => null };
    scene.stats = {
      update() {
        window.__r030Probe.statUpdates += 1;
      }
    };
    scene.debug = {
      logCheck(attr, min, value, passed, nextNode) {
        window.__r030Probe.logs.push({ attr, min, value, passed, nextNode });
      }
    };
    scene._recordDirectTalentTrigger = () => {};
    scene._applyEffectsWithTalentFeedback = (effects = {}) => {
      for (const [key, value] of Object.entries(effects)) {
        if (typeof value === 'number') {
          scene.state[key] = (scene.state[key] || 0) + value;
        }
      }
    };
    scene._proceedToNode = (_choice, nextNode) => {
      window.__r030Probe.flowCompletions += 1;
      window.__r030Probe.nextNode = nextNode;
    };
    scene.dialog = new DialogSystem(scene);

    window.__r030Probe = {
      scene,
      choice,
      flowCompletions: 0,
      nextNode: null,
      statUpdates: 0,
      logs: []
    };
  }, CHOICE);
}

async function resetProbe(page) {
  await page.evaluate(() => {
    const probe = window.__r030Probe;
    document.querySelectorAll('.check-animation-overlay').forEach(element => element.remove());
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
      reputation: 5,
      trust: 5,
      pressure: 4,
      _freeRetry: 1
    });
    probe.flowCompletions = 0;
    probe.nextNode = null;
    probe.statUpdates = 0;
    probe.logs = [];
  });
  await page.waitForTimeout(220);
}

async function showSecondChanceResult(page) {
  await page.evaluate(() => {
    const probe = window.__r030Probe;
    probe.scene._performCheck(probe.choice, { id: 'r030_origin' });
  });

  if (PHASE === 'before') {
    await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
    await page.evaluate(() => window.__r030Probe.scene.dialog.skipTyping());
    await page.waitForTimeout(180);
  } else {
    await expect(page.locator('.check-animation-overlay')).toHaveClass(/visible/);
    await page.waitForTimeout(900);
    await expect(page.locator('.check-animation-result.intervened')).toBeVisible();
  }
}

async function readResultState(page) {
  return page.evaluate(() => {
    const probe = window.__r030Probe;
    const modern = document.querySelector('.check-animation-overlay.visible');
    const dialog = document.querySelector('#ui-dialog.visible');
    const surface = modern?.querySelector('.check-animation-content') || dialog;
    const action = modern?.querySelector('.check-animation-continue');
    const rect = surface?.getBoundingClientRect();
    const text = (modern?.textContent || dialog?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      modern: Boolean(modern),
      role: modern?.getAttribute('role') || dialog?.getAttribute('role'),
      ariaModal: modern?.getAttribute('aria-modal') || null,
      title: modern?.querySelector('.check-animation-result')?.textContent.trim()
        || document.getElementById('ui-dialog-name')?.textContent.trim(),
      text,
      hasEquation: Boolean(modern?.querySelector('.check-animation-equation')),
      hasIntervention: Boolean(modern?.querySelector('.check-animation-intervention')),
      hasInterventionFlow: Boolean(
        modern?.querySelector('.check-animation-intervention-flow')
      ),
      hasResourceTransition: Boolean(
        modern?.querySelector('.check-animation-intervention-resource')
      ),
      hasOriginalFailure: text.includes('原始结果') && text.includes('未通过'),
      hasFinalSuccess: text.includes('最终结果') && text.includes('成功'),
      hasFormula: text.includes('5') && text.includes('6'),
      effectCount: modern?.querySelectorAll('.check-animation-effect').length || 0,
      focusInside: modern
        ? modern.contains(document.activeElement)
        : Boolean(dialog?.contains(document.activeElement)),
      actionHeight: action ? Math.round(action.getBoundingClientRect().height) : 0,
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null,
      scrollable: surface ? surface.scrollHeight > surface.clientHeight : null,
      retryCharges: probe.scene.state._freeRetry,
      reputation: probe.scene.state.reputation,
      trust: probe.scene.state.trust,
      flowCompletions: probe.flowCompletions,
      nextNode: probe.nextNode,
      statUpdates: probe.statUpdates,
      logCount: probe.logs.length
    };
  });
}

async function confirmResult(page) {
  if (PHASE === 'before') {
    await page.evaluate(() => window.__r030Probe.scene.dialog._onDialogClick());
  } else {
    await page.locator('.check-animation-continue').click();
  }
  await page.waitForTimeout(280);
}

test.describe('R030 第二次机会自动翻盘的检定归因与资源结算', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口保留失败公式、技能介入、次数结算与确认后推进', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetProbe(page);
      await showSecondChanceResult(page);
      const result = await readResultState(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-second-chance-result.png`)
        });
      }

      expect(result.hasFormula).toBe(true);
      expect(result.reputation).toBe(5);
      expect(result.trust).toBe(5);
      expect(result.flowCompletions).toBe(0);
      if (PHASE === 'before') {
        expect(result.modern).toBe(false);
        expect(result.retryCharges).toBe(0);
        expect(result.hasEquation).toBe(false);
        expect(result.hasIntervention).toBe(false);
        expect(result.effectCount).toBe(0);
      } else {
        expect(result.withinViewport).toBe(true);
        expect(result.modern).toBe(true);
        expect(result.role).toBe('dialog');
        expect(result.ariaModal).toBe('true');
        expect(result.title).toContain('失败已被改写为成功');
        expect(result.retryCharges).toBe(1);
        expect(result.hasEquation).toBe(true);
        expect(result.hasIntervention).toBe(true);
        expect(result.hasInterventionFlow).toBe(true);
        expect(result.hasResourceTransition).toBe(true);
        expect(result.hasOriginalFailure).toBe(true);
        expect(result.hasFinalSuccess).toBe(true);
        expect(result.effectCount).toBe(2);
        expect(result.focusInside).toBe(true);
        expect(result.actionHeight).toBeGreaterThanOrEqual(48);
      }

      await confirmResult(page);
      const settled = await readResultState(page);
      expect(settled.retryCharges).toBe(0);
      expect(settled.reputation).toBe(7);
      expect(settled.trust).toBe(6);
      expect(settled.flowCompletions).toBe(1);
      expect(settled.nextNode).toBe('channel_support');
      expect(settled.statUpdates).toBe(1);
      expect(settled.logCount).toBe(1);

      matrix.push({ id: viewport.id, result, settled });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'second-chance-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });
});
