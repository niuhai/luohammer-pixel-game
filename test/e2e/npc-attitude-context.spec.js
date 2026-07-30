import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R032', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const NODE = {
  id: 'act6_supplier',
  actSub: '锤子倒闭 · 供应商围堵',
  text: '会议室里没有人先开口。供应商代表盯着你手里的还款方案，等你给出一个能让所有人相信的答案。'
};

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async node => {
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

    const [{ GameScene }, { DialogSystem }, { toast }] = await Promise.all([
      import('/luohammer-pixel-game/src/scenes/GameScene.js'),
      import('/luohammer-pixel-game/src/systems/DialogSystem.js'),
      import('/luohammer-pixel-game/src/systems/ToastSystem.js')
    ]);

    const scene = Object.create(GameScene.prototype);
    scene.state = {
      currentNode: node.id,
      trust: 5,
      reputation: 5,
      pressure: 9,
      _showNpcAttitude: true
    };
    scene.vibrate = () => {};
    scene.time = {
      delayedCall(_delay, callback) {
        const id = window.setTimeout(callback, 0);
        return { remove: () => window.clearTimeout(id) };
      }
    };
    scene.audio = { playDialogAdvance() {} };
    scene.dialog = new DialogSystem(scene);

    window.__r032Probe = {
      scene,
      toast,
      node,
      completions: 0
    };
  }, NODE);
}

async function resetProbe(page) {
  await page.evaluate(() => {
    const probe = window.__r032Probe;
    probe.toast.clear();
    probe.scene.dialog.hide();
    if (probe.scene.dialog._onHideAnimationEnd) {
      probe.scene.dialog.el.removeEventListener(
        'animationend',
        probe.scene.dialog._onHideAnimationEnd
      );
      probe.scene.dialog._onHideAnimationEnd = null;
    }
    probe.scene.dialog._finishHide();
    probe.completions = 0;
  });
  await page.waitForTimeout(240);
}

async function showAttitude(page) {
  await page.evaluate(phase => {
    const probe = window.__r032Probe;
    const inferred = probe.scene._inferNpcAttitude(
      probe.node,
      '供应商围堵 · 还款谈判'
    );
    if (phase === 'before') {
      probe.scene.dialog.show('老罗', probe.node.text, () => {
        probe.completions += 1;
      });
      probe.toast.info(inferred, 3500);
    } else {
      probe.scene.dialog.show('老罗', probe.node.text, () => {
        probe.completions += 1;
      }, null, { insight: inferred });
    }
    probe.scene.dialog.skipTyping();
  }, PHASE);
  await expect(page.locator('#ui-dialog')).toHaveClass(/visible/);
  await page.waitForTimeout(260);
}

async function readAttitude(page) {
  return page.evaluate(() => {
    const dialog = document.getElementById('ui-dialog');
    const insight = document.getElementById('ui-dialog-insight');
    const rect = dialog?.getBoundingClientRect();
    const insightRect = insight && !insight.hidden ? insight.getBoundingClientRect() : null;
    return {
      dialogWithinViewport: rect
        ? rect.left >= -2 && rect.right <= innerWidth + 2 &&
          rect.top >= -2 && rect.bottom <= innerHeight + 2
        : null,
      dialogHeight: rect ? Math.round(rect.height) : 0,
      insightVisible: Boolean(insight && !insight.hidden),
      insightTone: insight?.dataset.tone || '',
      insightRole: insight?.getAttribute('role') || null,
      insightLabel: insight?.getAttribute('aria-label') || '',
      insightWithinDialog: Boolean(
        rect && insightRect &&
        insightRect.left >= rect.left && insightRect.right <= rect.right &&
        insightRect.top >= rect.top && insightRect.bottom <= rect.bottom
      ),
      skill: insight?.querySelector('.ui-dialog-insight-skill')?.textContent.trim() || '',
      context: insight?.querySelector('.ui-dialog-insight-context')?.textContent.trim() || '',
      attitude: insight?.querySelector('.ui-dialog-insight-attitude')?.textContent.trim() || '',
      summary: insight?.querySelector('.ui-dialog-insight-summary')?.textContent.trim() || '',
      basis: insight?.querySelector('.ui-dialog-insight-basis')?.textContent.trim() || '',
      toastCount: document.querySelectorAll('.toast-item').length,
      text: document.getElementById('ui-dialog-text')?.textContent.trim() || '',
      continueHeight: Math.round(
        document.getElementById('ui-dialog-continue')?.getBoundingClientRect().height || 0
      )
    };
  });
}

test.describe('R032 洞察人心的态度线索与对话上下文', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口把态度、依据和场景上下文留在剧情阅读层', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetProbe(page);
      await showAttitude(page);
      const state = await readAttitude(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-attitude-dialog.png`)
        });
      }

      expect(state.dialogWithinViewport).toBe(true);
      expect(state.text).toContain('供应商代表');
      if (PHASE === 'before') {
        expect(state.insightVisible).toBe(false);
        expect(state.toastCount).toBe(1);
      } else {
        expect(state.insightVisible).toBe(true);
        expect(state.insightTone).toBe('warning');
        expect(state.insightRole).toBe('note');
        expect(state.insightLabel).toContain('压力 9');
        expect(state.insightWithinDialog).toBe(true);
        expect(state.skill).toContain('洞察人心');
        expect(state.context).toContain('供应商围堵');
        expect(state.attitude).toContain('试探');
        expect(state.summary).toContain('紧绷');
        expect(state.basis).toContain('压力 9 ≥ 8');
        expect(state.toastCount).toBe(0);
        expect(state.continueHeight).toBeGreaterThanOrEqual(44);
      }
      matrix.push({ id: viewport.id, state });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'attitude-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('态度线索在阅读与选择等待阶段保持，不进入通知队列', async ({ page }) => {
    test.skip(PHASE === 'before', '稳定上下文只验收改造后的实现');
    await installProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await resetProbe(page);
    await showAttitude(page);

    await page.evaluate(() => window.__r032Probe.scene.dialog.notifyChoicesVisible(true));
    await page.waitForTimeout(3900);
    const state = await readAttitude(page);
    expect(state.insightVisible).toBe(true);
    expect(state.attitude).toContain('试探');
    expect(state.toastCount).toBe(0);
    expect(await page.locator('#ui-dialog').evaluate(
      element => element.classList.contains('awaiting-choice')
    )).toBe(true);
  });
});
