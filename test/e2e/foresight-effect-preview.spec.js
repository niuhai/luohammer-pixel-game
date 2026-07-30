import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R035', PHASE);
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
    label: '押上全部筹码，换取最后一次翻盘',
    next: 'all_in',
    effects: {
      pride: 1,
      wealth: -2,
      reputation: 1,
      trust: 2,
      pressure: 2,
      failures: 1
    }
  },
  {
    label: '提出长期合作，让供应商共同渡过难关',
    next: 'cooperate',
    effects: { trust: 2, pressure: -1 }
  },
  {
    label: '立刻变卖资产偿还一部分欠款',
    next: 'sell_assets',
    effects: { wealth: -2, failures: 1 }
  },
  {
    label: '把答案留到下一次董事会再说',
    next: 'defer',
    flag: 'defer_board'
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
        _autoPreview: true,
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
      window.__r035Probe.selected = [];
      scene.dialog.show(
        '财务负责人',
        '方向只是概括。先把每个选择立刻改变的数值看清，再决定要承担哪一种代价。'
      );
      scene.dialog.skipTyping();
      scene.choices.show(choices, choice => {
        window.__r035Probe.selected.push(choice.next);
      });
    };

    window.__r035Probe = { scene, render, selected: [] };
  }, CHOICES);
}

async function readPreviewState(page) {
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
      hasMoreHint: Boolean(panel.querySelector('.ui-choices-more')),
      previews: buttons.map(button => {
        const preview = button.querySelector('.choice-auto-preview');
        const tokens = [...button.querySelectorAll('.choice-effect-token')];
        return {
          text: preview?.textContent.replace(/\s+/g, ' ').trim() || '',
          source: preview?.querySelector('.choice-effect-source')?.textContent.trim() || '',
          scope: preview?.querySelector('.choice-effect-scope')?.textContent.trim() || '',
          tokenCount: tokens.length,
          tokens: tokens.map(token => ({
            text: token.textContent.trim(),
            tone: token.dataset.tone || '',
            className: token.className
          })),
          insideChoiceText: Boolean(
            preview && button.querySelector('.ui-choice-text')?.contains(preview)
          ),
          alignmentCount: button.querySelectorAll('.choice-alignment').length
        };
      })
    };
  });
}

test.describe('R035 先见之明的即时影响芯片与洞察层级', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口把多项即时影响与命运方向分层呈现', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => window.__r035Probe.render());
      await page.waitForTimeout(650);
      const state = await readPreviewState(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-foresight-effects.png`)
        });
      }

      expect(state.buttonCount).toBe(4);
      expect(state.panelWithinViewport).toBe(true);
      expect(state.lastAboveDialog).toBe(true);
      expect(state.minimumButtonHeight).toBeGreaterThanOrEqual(44);
      expect(state.hasMoreHint).toBe(false);
      expect(state.previews.map(item => item.alignmentCount)).toEqual([1, 1, 1, 1]);
      if (PHASE === 'before') {
        expect(state.previews.map(item => item.text)).toEqual([
          '理想+1 · 财富-2 · 名声+1 · 信任+2 · 压力+2 · 翻车+1',
          '信任+2 · 压力-1',
          '财富-2 · 翻车+1',
          ''
        ]);
        expect(state.previews.every(item => item.source === '')).toBe(true);
        expect(state.previews.every(item => item.tokenCount === 0)).toBe(true);
      } else {
        expect(state.previews.map(item => item.tokenCount)).toEqual([6, 2, 2, 0]);
        expect(state.previews.slice(0, 3).every(
          item => item.source.includes('先见之明')
        )).toBe(true);
        expect(state.previews.slice(0, 3).every(
          item => item.scope === '即时影响'
        )).toBe(true);
        expect(state.previews[0].tokens.map(token => token.text)).toEqual([
          '理想 +1',
          '财富 -2',
          '名声 +1',
          '信任 +2',
          '压力 +2',
          '翻车 +1'
        ]);
        expect(state.previews[0].tokens.map(token => token.tone)).toEqual([
          'positive',
          'negative',
          'positive',
          'positive',
          'negative',
          'negative'
        ]);
        expect(state.previews.slice(0, 3).every(item => item.insideChoiceText)).toBe(true);
      }
      matrix.push({ id: viewport.id, state });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'foresight-effects-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('影响芯片不改变数字键的单次选择行为', async ({ page }) => {
    test.skip(PHASE === 'before', '结构化即时影响只验收改造后的实现');
    await installProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.__r035Probe.render());

    await page.keyboard.press('1');
    await page.waitForTimeout(80);
    await page.keyboard.press('1');
    expect(await page.evaluate(() => window.__r035Probe.selected)).toEqual([
      'all_in'
    ]);
  });
});
