import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R026', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const EVENT = {
  id: 'r026_decision_probe',
  title: '合作方突然撤回承诺',
  text: '发布会只剩最后一个晚上，合作方突然要求你接受更苛刻的分成，否则就撤走全部渠道支持。团队已经连续熬了三天，所有人都在等你做决定。',
  rarity: 'rare',
  choices: [
    {
      label: '接受分成，先把产品送到用户手里',
      effects: { wealth: -2, reputation: 2, pressure: 1 },
      effectVariance: { reputation: [-1, 1] }
    },
    {
      label: '拒绝临时加码，自己承担发布风险',
      effects: { pride: 2, wealth: -1, pressure: 3 },
      effectVariance: { wealth: [-1, 1] }
    }
  ]
};

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async (event) => {
    document.getElementById('ui-boot-overlay')?.classList.remove('visible');
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) boot.style.display = 'none';
    const rotate = document.getElementById('rotate-hint');
    if (rotate) rotate.style.display = 'none';

    const [{ RandomEventSystem }, { GameScene }] = await Promise.all([
      import('/luohammer-pixel-game/src/systems/RandomEventSystem.js'),
      import('/luohammer-pixel-game/src/scenes/GameScene.js')
    ]);

    const handlers = new Map();
    const scene = {
      state: { currentNode: 'act3_startup', talentSpecials: [] },
      input: {
        keyboard: {
          on(name, handler) {
            handlers.set(name, handler);
            if (name === 'keydown') window.addEventListener('keydown', handler);
          },
          off(name, handler) {
            handlers.delete(name);
            if (name === 'keydown') window.removeEventListener('keydown', handler);
          }
        }
      }
    };

    const random = new RandomEventSystem(scene);
    const check = Object.create(GameScene.prototype);
    check._trackedTimeout = (callback, delay) => window.setTimeout(callback, delay);
    window.__r026Probe = {
      event,
      random,
      check,
      checkCallbacks: 0
    };
  }, EVENT);
}

async function showEvent(page) {
  await page.evaluate(() => {
    const { random, event } = window.__r026Probe;
    random.hide();
    random._showEvent(event);
  });
  await expect(page.locator('#ui-random-event-overlay')).toHaveClass(/active/);
  await page.waitForTimeout(700);
}

async function readEventState(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('ui-random-event-overlay');
    const card = overlay?.querySelector('.ui-random-event-card');
    const buttons = [...(overlay?.querySelectorAll('.ui-random-event-choice-btn') || [])];
    const viewport = { width: innerWidth, height: innerHeight };
    const cardBox = card ? {
      left: Math.round(card.getBoundingClientRect().left),
      top: Math.round(card.getBoundingClientRect().top),
      right: Math.round(card.getBoundingClientRect().right),
      bottom: Math.round(card.getBoundingClientRect().bottom),
      height: Math.round(card.getBoundingClientRect().height)
    } : null;
    return {
      viewport,
      role: overlay?.getAttribute('role'),
      ariaModal: overlay?.getAttribute('aria-modal'),
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      focusedClass: document.activeElement?.className || '',
      choiceCount: buttons.length,
      impactCount: overlay?.querySelectorAll('.ui-random-event-choice-impact').length || 0,
      minButtonHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
      cardBox,
      withinViewport: Boolean(cardBox &&
        cardBox.left >= 0 && cardBox.right <= viewport.width &&
        cardBox.top >= 0 && cardBox.bottom <= viewport.height),
      scrollable: Boolean(card && card.scrollHeight > card.clientHeight),
      labels: buttons.map(button => button.getAttribute('aria-label')),
      touchActions: buttons.map(button => getComputedStyle(button).touchAction)
    };
  });
}

async function showResult(page) {
  await page.evaluate(() => {
    const { random } = window.__r026Probe;
    random.hide();
    random._showFeedback(
      { reputation: -2, pressure: 3 },
      () => { window.__r026Probe.resultCallbacks = (window.__r026Probe.resultCallbacks || 0) + 1; },
      {
        eventTitle: '合作方突然撤回承诺',
        choiceLabel: '拒绝临时加码，自己承担发布风险'
      }
    );
  });
  await expect(page.locator('#ui-random-event-feedback')).toHaveClass(/visible/);
}

async function readResultState(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('ui-random-event-feedback');
    const card = overlay?.querySelector('.ui-random-event-feedback-card');
    const action = overlay?.querySelector('button');
    const rect = card?.getBoundingClientRect();
    return {
      role: overlay?.getAttribute('role'),
      ariaLive: overlay?.getAttribute('aria-live'),
      hasContinue: Boolean(action),
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      selectedChoiceVisible: (overlay?.textContent || '').includes('拒绝临时加码'),
      effectCount: overlay?.querySelectorAll('.ui-random-event-feedback-item').length || 0,
      actionHeight: action ? Math.round(action.getBoundingClientRect().height) : 0,
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
        : null,
      cardBox: rect ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom)
      } : null
    };
  });
}

async function showCheckResult(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.check-animation-overlay').forEach(element => element.remove());
    const { check } = window.__r026Probe;
    check._showCheckAnimation(
      {
        attr: 'reputation',
        min: 6,
        successText: '团队获得了更多渠道支持。',
        failText: '临场回应没有压住质疑，舆论继续发酵。',
        successEffects: { reputation: 2, trust: 1 },
        failEffects: { reputation: -2, pressure: 3 }
      },
      false,
      '名声',
      5,
      () => { window.__r026Probe.checkCallbacks += 1; },
      {
        rawValue: 4,
        bonus: 1,
        choiceLabel: '公开回应合作方的质疑',
        outcomeEffects: { reputation: -2, pressure: 3 }
      }
    );
  });
  await expect(page.locator('.check-animation-overlay')).toHaveClass(/visible/);
  await page.waitForTimeout(1100);
}

async function readCheckState(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('.check-animation-overlay');
    const content = overlay?.querySelector('.check-animation-content');
    const action = overlay?.querySelector('button');
    const rect = content?.getBoundingClientRect();
    return {
      role: overlay?.getAttribute('role'),
      ariaModal: overlay?.getAttribute('aria-modal'),
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      hasContinue: Boolean(action),
      actionHeight: action ? Math.round(action.getBoundingClientRect().height) : 0,
      hasEquation: Boolean(overlay?.querySelector('.check-animation-equation')),
      hasConsequence: Boolean(overlay?.querySelector('.check-animation-consequence')),
      text: (overlay?.textContent || '').replace(/\s+/g, ' ').trim(),
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
        : null,
      contentBox: rect ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom)
      } : null
    };
  });
}

test.describe('R026 随机事件与属性检定决策链', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口保持决策、结果和检定反馈可见且可操作', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await showEvent(page);
      const event = await readEventState(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-event.png`)
        });
      }

      await showResult(page);
      const result = await readResultState(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-event-result.png`)
        });
      }

      await page.evaluate(() => window.__r026Probe.random.hide());
      await showCheckResult(page);
      const check = await readCheckState(page);
      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-check-result.png`)
        });
      }
      await page.evaluate(() => document.querySelectorAll('.check-animation-overlay').forEach(
        element => element.remove()
      ));

      matrix.push({ id: viewport.id, event, result, check });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'decision-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );

    for (const row of matrix) {
      expect(row.event.role).toBe('dialog');
      expect(row.event.ariaModal).toBe('true');
      expect(row.event.focusInside).toBe(true);
      expect(row.event.choiceCount).toBe(2);
      expect(row.event.minButtonHeight).toBeGreaterThanOrEqual(44);
      expect(row.event.touchActions.every(value => value === 'manipulation')).toBe(true);

      if (PHASE === 'before') {
        expect(row.event.impactCount).toBe(0);
        expect(row.result.role).toBe('status');
        expect(row.result.ariaLive).toBe('assertive');
        expect(row.result.hasContinue).toBe(false);
        expect(row.result.selectedChoiceVisible).toBe(false);
        expect(row.check.role).toBe(null);
        expect(row.check.hasContinue).toBe(false);
        expect(row.check.focusInside).toBe(false);
      } else {
        expect(row.event.impactCount).toBe(2);
        expect(row.event.withinViewport).toBe(true);
        expect(row.result.role).toBe('dialog');
        expect(row.result.hasContinue).toBe(true);
        expect(row.result.focusInside).toBe(true);
        expect(row.result.selectedChoiceVisible).toBe(true);
        expect(row.result.actionHeight).toBeGreaterThanOrEqual(44);
        expect(row.result.withinViewport).toBe(true);
        expect(row.check.role).toBe('dialog');
        expect(row.check.ariaModal).toBe('true');
        expect(row.check.hasContinue).toBe(true);
        expect(row.check.focusInside).toBe(true);
        expect(row.check.actionHeight).toBeGreaterThanOrEqual(44);
        expect(row.check.hasEquation).toBe(true);
        expect(row.check.hasConsequence).toBe(true);
        expect(row.check.withinViewport).toBe(true);
      }
    }
  });

  test('键盘选择、结果确认和检定继续只推进一次', async ({ page }) => {
    test.skip(PHASE === 'before', '交互闭环只验收改造后实现');
    await installProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      const { random, event } = window.__r026Probe;
      window.__r026Probe.randomCompletion = null;
      random.onComplete = (effects, flag, eventId) => {
        window.__r026Probe.randomCompletion = { effects, flag, eventId };
      };
      random._showEvent(event);
    });
    await expect(page.locator('#ui-random-event-overlay')).toHaveClass(/active/);
    await expect(page.locator('.ui-random-event-choice-btn').first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.ui-random-event-choice-btn').nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ui-random-event-feedback')).toHaveClass(/visible/, {
      timeout: 2_000
    });
    await expect(page.locator('#ui-random-event-feedback-choice')).toContainText('拒绝临时加码');
    await expect(page.locator('#ui-random-event-feedback-continue')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('#ui-random-event-feedback')).not.toHaveClass(/visible/);
    const randomCompletion = await page.evaluate(() => window.__r026Probe.randomCompletion);
    expect(randomCompletion.eventId).toBe('r026_decision_probe');
    expect(randomCompletion.effects).toEqual(expect.objectContaining({
      pride: 2,
      pressure: 3
    }));

    await showCheckResult(page);
    const checkButton = page.locator('.check-animation-continue');
    await expect(checkButton).toBeFocused();
    await checkButton.click();
    await expect(page.locator('.check-animation-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => window.__r026Probe.checkCallbacks)).toBe(1);
  });
});
