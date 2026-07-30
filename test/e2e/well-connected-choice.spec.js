import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R033', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const HIGH_STAKES_CHOICES = [
  {
    label: '公开承诺一个月内还清全部欠款',
    check: {
      attr: 'reputation',
      min: 7,
      successNext: 'promise_kept',
      failNext: 'promise_broken',
      successEffects: { trust: 2 },
      failEffects: { reputation: -2, pressure: 2 }
    }
  },
  {
    label: '要求供应商继续相信你的个人信用',
    next: 'credit_route',
    requires: { reputation: 7 }
  },
  {
    label: '先争取三个月缓冲，再按比例还款',
    next: 'installment_route',
    effects: { pressure: -1 }
  }
];

const ORDINARY_CHOICES = [
  { label: '继续听完对方的意见', next: 'listen' },
  { label: '直接结束这段谈话', next: 'leave' }
];

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async ({ phase, highStakesChoices, ordinaryChoices }) => {
    if (window.game?.destroy) {
      window.game.destroy(false);
      delete window.game;
    }
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

    const [{ DialogSystem }, { ChoiceSystem }] = await Promise.all([
      import('/luohammer-pixel-game/src/systems/DialogSystem.js'),
      import('/luohammer-pixel-game/src/systems/ChoiceSystem.js')
    ]);
    const talentPresentation = phase === 'after'
      ? await import('/luohammer-pixel-game/src/ui/TalentChoicePresentation.js')
      : null;
    const keydownHandlers = new Set();
    const scene = {
      state: {
        currentNode: 'act6_supplier',
        reputation: 4,
        trust: 5,
        pressure: 8,
        history: [],
        flags: new Set(),
        _extraChoices: true
      },
      input: {
        keyboard: {
          on(eventName, handler) {
            if (eventName !== 'keydown') return;
            keydownHandlers.add(handler);
            document.addEventListener('keydown', handler);
          },
          off(eventName, handler) {
            if (eventName !== 'keydown') return;
            keydownHandlers.delete(handler);
            document.removeEventListener('keydown', handler);
          }
        }
      },
      time: {
        delayedCall(_delay, callback) {
          const id = window.setTimeout(callback, 0);
          return { remove: () => window.clearTimeout(id) };
        }
      },
      audio: {
        playDialogAdvance() {},
        playHover() {}
      },
      vibrate() {}
    };
    scene.dialog = new DialogSystem(scene);
    scene.choices = new ChoiceSystem(scene);

    const cloneChoices = source => source.map(choice => ({
      ...choice,
      effects: choice.effects ? { ...choice.effects } : undefined,
      requires: choice.requires ? { ...choice.requires } : undefined,
      check: choice.check
        ? {
            ...choice.check,
            successEffects: { ...choice.check.successEffects },
            failEffects: { ...choice.check.failEffects }
          }
        : undefined
    }));

    const clearKeyHandlers = () => {
      for (const handler of keydownHandlers) {
        document.removeEventListener('keydown', handler);
      }
      keydownHandlers.clear();
    };

    const renderScenario = scenario => {
      scene.choices.hide(true);
      clearKeyHandlers();
      scene.dialog.hide();
      if (scene.dialog._onHideAnimationEnd) {
        scene.dialog.el.removeEventListener(
          'animationend',
          scene.dialog._onHideAnimationEnd
        );
        scene.dialog._onHideAnimationEnd = null;
      }
      scene.dialog._finishHide();
      const baseChoices = cloneChoices(
        scenario === 'ordinary' ? ordinaryChoices : highStakesChoices
      );
      let talentChoice = null;
      if (phase === 'before') {
        const fallback = baseChoices.find(choice => choice.next && !choice.check);
        talentChoice = {
          label: '◈ 【八面玲珑】以圆滑方式应对，留有余地',
          next: fallback ? fallback.next : undefined,
          effects: { trust: 1, pressure: 1 }
        };
      } else {
        talentChoice = talentPresentation.buildWellConnectedChoice(
          baseChoices,
          scene.state,
          { context: '供应商围堵 · 还款谈判' }
        );
      }
      if (talentChoice) baseChoices.push(talentChoice);
      window.__r033Probe.selected = [];
      scene.dialog.show(
        scenario === 'ordinary' ? '项目伙伴' : '供应商代表',
        scenario === 'ordinary'
          ? '对方在等你决定，这只是一次没有门槛的普通交流。'
          : '还款方案摆在桌上。每一句承诺，都要有人承担后果。'
      );
      scene.dialog.skipTyping();
      scene.choices.show(baseChoices, choice => {
        window.__r033Probe.selected.push({
          label: choice.label,
          next: choice.next,
          source: choice.talentChoice?.name || ''
        });
      });
      return baseChoices.length;
    };

    window.__r033Probe = {
      scene,
      renderScenario,
      selected: []
    };
  }, {
    phase: PHASE,
    highStakesChoices: HIGH_STAKES_CHOICES,
    ordinaryChoices: ORDINARY_CHOICES
  });
}

async function waitForChoiceAnimations(page) {
  await page.locator('#ui-choices .ui-choice-btn').evaluateAll(async buttons => {
    const animations = buttons.flatMap(button => button.getAnimations());
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  });
}

async function readChoiceState(page) {
  return page.evaluate(() => {
    const panel = document.getElementById('ui-choices');
    const buttons = [...panel.querySelectorAll('.ui-choice-btn')];
    const special = buttons.at(-1);
    const panelRect = panel.getBoundingClientRect();
    const specialRect = special?.getBoundingClientRect();
    const dialogRect = document.getElementById('ui-dialog')?.getBoundingClientRect();
    const moreHintRect = panel.querySelector('.ui-choices-more')?.getBoundingClientRect();
    const overflowAllowance = Math.round(moreHintRect?.height || 0);
    const specialCenterX = specialRect
      ? Math.round(specialRect.left + specialRect.width * 0.72)
      : 0;
    const specialHitPoints = specialRect
      ? [
          specialRect.top + 3,
          specialRect.top + specialRect.height / 2,
          specialRect.bottom - 3
        ]
      : [];
    const hitDetails = specialHitPoints.map(y => {
      const hit = document.elementFromPoint(specialCenterX, Math.round(y));
      return {
        y: Math.round(y),
        tag: hit?.tagName || '',
        className: String(hit?.className || '')
      };
    });
    return {
      buttonCount: buttons.length,
      panelWithinViewport:
        panelRect.left >= -2 &&
        panelRect.right <= innerWidth + 2 &&
        panelRect.top >= -2 &&
        panelRect.bottom <= innerHeight + 2,
      specialWithinViewport: specialRect
        ? specialRect.left >= -2 &&
          specialRect.right <= innerWidth + 2 &&
          specialRect.top >= -2 &&
          specialRect.bottom <= innerHeight + 2
        : false,
      specialWithinPanel: specialRect
        ? specialRect.top >= panelRect.top - 2 &&
          specialRect.bottom <= panelRect.bottom + overflowAllowance + 2
        : false,
      specialUnoccluded: Boolean(special) && specialHitPoints.every(y => {
        const hit = document.elementFromPoint(specialCenterX, Math.round(y));
        return Boolean(hit && (hit === special || special.contains(hit)));
      }),
      specialAboveDialog: specialRect && dialogRect
        ? specialRect.bottom <= dialogRect.top + 2
        : false,
      specialHeight: Math.round(specialRect?.height || 0),
      specialClass: special?.classList.contains('talent-choice') || false,
      specialSource: special?.dataset.talentSource || '',
      specialText: special?.textContent.replace(/\s+/g, ' ').trim() || '',
      badge: special?.querySelector('.choice-talent-badge')?.textContent.trim() || '',
      route: special?.querySelector('.choice-talent-route')?.textContent.trim() || '',
      benefit: special?.querySelector('.choice-talent-benefit')?.textContent.trim() || '',
      tradeoff: special?.querySelector('.choice-talent-tradeoff')?.textContent.trim() || '',
      focusedIndex: buttons.indexOf(document.activeElement),
      enabledCount: buttons.filter(button => !button.disabled).length,
      geometry: {
        panelTop: Math.round(panelRect.top),
        panelBottom: Math.round(panelRect.bottom),
        specialTop: Math.round(specialRect?.top || 0),
        specialBottom: Math.round(specialRect?.bottom || 0),
        dialogTop: Math.round(dialogRect?.top || 0),
        overflowAllowance,
        hitDetails
      }
    };
  });
}

test.describe('R033 八面玲珑的关键节点协商路径与去向说明', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口呈现技能来源、替代路线与收益代价', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => window.__r033Probe.renderScenario('high-stakes'));
      await waitForChoiceAnimations(page);
      const state = await readChoiceState(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-well-connected-choice.png`)
        });
      }

      expect(state.buttonCount).toBe(4);
      expect(state.panelWithinViewport).toBe(true);
      expect(state.specialWithinViewport).toBe(true);
      expect(
        state.specialWithinPanel,
        `${viewport.id} ${JSON.stringify(state.geometry)}`
      ).toBe(true);
      expect(
        state.specialAboveDialog,
        `${viewport.id} ${JSON.stringify(state.geometry)}`
      ).toBe(true);
      expect(
        state.specialUnoccluded,
        `${viewport.id} ${JSON.stringify(state.geometry)}`
      ).toBe(true);
      expect(state.specialHeight).toBeGreaterThanOrEqual(44);
      if (PHASE === 'before') {
        expect(state.specialClass).toBe(false);
        expect(state.specialText).toContain('【八面玲珑】');
        expect(state.route).toBe('');
        expect(state.benefit).toBe('');
        expect(state.tradeoff).toBe('');
      } else {
        expect(state.specialClass).toBe(true);
        expect(state.specialSource).toBe('well_connected');
        expect(state.badge).toContain('八面玲珑');
        expect(state.route).toContain('避开名声检定');
        expect(state.route).toContain('先争取三个月缓冲');
        expect(state.benefit).toContain('信任 +1');
        expect(state.tradeoff).toContain('压力 +1');
        expect(state.enabledCount).toBe(3);
      }
      matrix.push({ id: viewport.id, state });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'well-connected-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('只在关键抉择注入，并保持数字键单次选择安全出口', async ({ page }) => {
    test.skip(PHASE === 'before', '关键节点资格与安全出口只验收改造后的实现');
    await installProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const ordinaryState = await page.evaluate(() => {
      const count = window.__r033Probe.renderScenario('ordinary');
      const panel = document.getElementById('ui-choices');
      return {
        count,
        buttonCount: panel.querySelectorAll('.ui-choice-btn').length,
        talentCount: panel.querySelectorAll('.ui-choice-btn.talent-choice').length
      };
    });
    expect(ordinaryState).toEqual({
      count: 2,
      buttonCount: 2,
      talentCount: 0
    });

    await page.evaluate(() => window.__r033Probe.renderScenario('high-stakes'));
    await page.keyboard.press('4');
    await page.waitForTimeout(80);
    await page.keyboard.press('4');
    const selected = await page.evaluate(() => window.__r033Probe.selected);
    expect(selected).toEqual([{
      label: '以圆滑方式应对，留有余地',
      next: 'installment_route',
      source: '八面玲珑'
    }]);
  });
});
