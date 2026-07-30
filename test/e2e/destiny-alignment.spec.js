import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R034', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const CHOICES = [
  {
    label: '提出长期合作，让供应商共同渡过难关',
    next: 'cooperate',
    effects: { trust: 2, pressure: -1 }
  },
  {
    label: '接受苛刻期限，换取供应商继续供货',
    next: 'tradeoff',
    effects: { trust: 2, pressure: 2 }
  },
  {
    label: '把答案留到下一次董事会再说',
    next: 'defer',
    flag: 'defer_board'
  },
  {
    label: '公开承诺一个月内还清全部欠款',
    check: {
      attr: 'reputation',
      min: 7,
      successNext: 'promise_kept',
      failNext: 'promise_broken',
      successEffects: { trust: 2, reputation: 1 },
      failEffects: { reputation: -2, pressure: 2 }
    }
  }
];

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async choices => {
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
    const keydownHandlers = new Set();
    const scene = {
      state: {
        currentNode: 'act6_supplier',
        reputation: 4,
        trust: 5,
        pressure: 8,
        history: [],
        flags: new Set(),
        _showAlignment: true
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

    const render = () => {
      scene.choices.hide(true);
      scene.dialog.hide();
      if (scene.dialog._onHideAnimationEnd) {
        scene.dialog.el.removeEventListener(
          'animationend',
          scene.dialog._onHideAnimationEnd
        );
        scene.dialog._onHideAnimationEnd = null;
      }
      scene.dialog._finishHide();
      window.__r034Probe.selected = [];
      scene.dialog.show(
        '供应商代表',
        '现在不是猜“好或坏”的时候。每条路线的收益、代价和未知，都必须分开看。'
      );
      scene.dialog.skipTyping();
      scene.choices.show(choices, choice => {
        window.__r034Probe.selected.push(choice.next || choice.check?.successNext);
      });
    };

    window.__r034Probe = { scene, render, selected: [] };
  }, CHOICES);
}

async function readAlignmentState(page) {
  return page.evaluate(() => {
    const panel = document.getElementById('ui-choices');
    const dialog = document.getElementById('ui-dialog');
    const buttons = [...panel.querySelectorAll('.ui-choice-btn')];
    const panelRect = panel.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const lastRect = buttons.at(-1)?.getBoundingClientRect();
    return {
      buttonCount: buttons.length,
      panelWithinViewport:
        panelRect.left >= -2 &&
        panelRect.right <= innerWidth + 2 &&
        panelRect.top >= -2 &&
        panelRect.bottom <= innerHeight + 2,
      lastAboveDialog: lastRect
        ? lastRect.bottom <= dialogRect.top + 2
        : false,
      minimumButtonHeight: Math.round(Math.min(
        ...buttons.map(button => button.getBoundingClientRect().height)
      )),
      alignments: buttons.map(button => {
        const alignment = button.querySelector('.choice-alignment');
        return {
          text: alignment?.textContent.replace(/\s+/g, ' ').trim() || '',
          className: alignment?.className || '',
          source: alignment?.querySelector('.choice-alignment-source')?.textContent.trim() || '',
          verdict: alignment?.querySelector('.choice-alignment-verdict')?.textContent.trim() || '',
          basis: alignment?.querySelector('.choice-alignment-basis')?.textContent.trim() || '',
          insideChoiceText: Boolean(
            alignment && button.querySelector('.ui-choice-text')?.contains(alignment)
          )
        };
      })
    };
  });
}

test.describe('R034 命运之眼的真实方向分类与判断依据', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口区分向好、取舍、未知和检定分叉', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => window.__r034Probe.render());
      await page.waitForTimeout(650);
      const state = await readAlignmentState(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-destiny-alignment.png`)
        });
      }

      expect(state.buttonCount).toBe(4);
      expect(state.panelWithinViewport).toBe(true);
      expect(state.lastAboveDialog).toBe(true);
      expect(state.minimumButtonHeight).toBeGreaterThanOrEqual(44);
      if (PHASE === 'before') {
        expect(state.alignments.map(item => item.text)).toEqual([
          '向好',
          '中性',
          '中性',
          '中性'
        ]);
        expect(state.alignments.every(item => item.source === '')).toBe(true);
        expect(state.alignments.every(item => item.basis === '')).toBe(true);
      } else {
        expect(state.alignments.map(item => item.verdict)).toEqual([
          '向好',
          '有得有失',
          '走向未明',
          '检定分叉'
        ]);
        expect(state.alignments.every(item => item.source.includes('命运之眼'))).toBe(true);
        expect(state.alignments[0].basis).toContain('可见收益');
        expect(state.alignments[1].basis).toContain('收益与代价并存');
        expect(state.alignments[2].basis).toContain('没有可见的即时数值');
        expect(state.alignments[3].basis).toContain('成功向好');
        expect(state.alignments[3].basis).toContain('失败向坏');
        expect(state.alignments.every(item => item.insideChoiceText)).toBe(true);
      }
      matrix.push({ id: viewport.id, state });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'destiny-alignment-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('方向说明不改变数字键的单次选择行为', async ({ page }) => {
    test.skip(PHASE === 'before', '结构化方向说明只验收改造后的实现');
    await installProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.__r034Probe.render());

    await page.keyboard.press('4');
    await page.waitForTimeout(80);
    await page.keyboard.press('4');
    expect(await page.evaluate(() => window.__r034Probe.selected)).toEqual([
      'promise_kept'
    ]);
  });
});
