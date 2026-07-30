import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R031', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const EVENT = {
  id: 'r031_foresight_probe',
  title: '合作方突然撤回承诺',
  text: '发布会只剩最后一个晚上，合作方要求重新谈判，否则就撤走全部渠道支持。',
  rarity: 'rare',
  choices: [
    {
      label: '接受临时加码，先守住发布计划',
      effects: { wealth: -2, reputation: 2, pressure: 1 }
    },
    {
      label: '拒绝加码，承担渠道撤离风险',
      effects: { reputation: -1, trust: 1, pressure: 2 }
    }
  ]
};

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async event => {
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const rotate = document.getElementById('rotate-hint');
    if (rotate) rotate.style.display = 'none';

    const [{ RandomEventSystem }, { toast }] = await Promise.all([
      import('/luohammer-pixel-game/src/systems/RandomEventSystem.js'),
      import('/luohammer-pixel-game/src/systems/ToastSystem.js')
    ]);

    const handlers = new Set();
    const scene = {
      state: {
        currentNode: 'act3_startup',
        currentStageId: 'startup',
        talentSpecials: [],
        _showEventOmen: true
      },
      input: {
        keyboard: {
          on(name, handler) {
            if (name !== 'keydown') return;
            handlers.add(handler);
            window.addEventListener('keydown', handler);
          },
          off(name, handler) {
            if (name !== 'keydown') return;
            handlers.delete(handler);
            window.removeEventListener('keydown', handler);
          }
        }
      }
    };
    const origin = document.createElement('button');
    origin.id = 'r031-focus-origin';
    origin.textContent = '原剧情操作';
    origin.style.position = 'fixed';
    origin.style.left = '8px';
    origin.style.top = '8px';
    document.body.appendChild(origin);

    const random = new RandomEventSystem(scene);
    random.onComplete = (effects, flag, eventId) => {
      window.__r031Probe.completions += 1;
      window.__r031Probe.completion = { effects, flag, eventId };
    };
    window.__r031Probe = {
      event,
      random,
      toast,
      origin,
      completions: 0,
      completion: null
    };
  }, EVENT);
}

async function resetProbe(page) {
  await page.evaluate(() => {
    const probe = window.__r031Probe;
    probe.random.hide();
    probe.toast.clear();
    probe.completions = 0;
    probe.completion = null;
    probe.random.onComplete = (effects, flag, eventId) => {
      probe.completions += 1;
      probe.completion = { effects, flag, eventId };
    };
    probe.origin.focus();
  });
  await page.waitForTimeout(260);
}

async function showForesight(page) {
  await page.evaluate(phase => {
    const { random, toast, event } = window.__r031Probe;
    if (phase === 'before') {
      random._showEvent(event);
      toast.info('◯ 预知未来：你预感到一个随机事件正在发生……', 3500);
    } else {
      random._presentEvent(event);
    }
  }, PHASE);

  await expect(page.locator('#ui-random-event-overlay')).toHaveClass(/active/);
  if (PHASE === 'after') {
    await expect(page.locator('#ui-random-event-overlay')).toHaveAttribute(
      'data-event-stage',
      'omen'
    );
  }
  await page.waitForTimeout(500);
}

async function readStage(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('ui-random-event-overlay');
    const card = overlay?.querySelector('.ui-random-event-card');
    const reveal = overlay?.querySelector('.ui-random-event-omen-reveal');
    const choices = [...(overlay?.querySelectorAll('.ui-random-event-choice-btn') || [])];
    const rect = card?.getBoundingClientRect();
    return {
      stage: overlay?.dataset.eventStage || 'legacy-decision',
      label: overlay?.querySelector('.ui-random-event-label')?.textContent.trim() || '',
      title: document.getElementById('ui-random-event-title')?.textContent.trim() || '',
      body: document.getElementById('ui-random-event-body')?.textContent.trim() || '',
      hasOmenSummary: Boolean(overlay?.querySelector('.ui-random-event-omen-summary')),
      impactCount: overlay?.querySelectorAll('.ui-random-event-omen-impact').length || 0,
      revealVisible: Boolean(reveal),
      revealHeight: reveal ? Math.round(reveal.getBoundingClientRect().height) : 0,
      choiceCount: choices.length,
      minChoiceHeight: choices.length
        ? Math.min(...choices.map(choice => choice.getBoundingClientRect().height))
        : 0,
      toastCount: document.querySelectorAll('.toast-item').length,
      focusInside: Boolean(overlay?.contains(document.activeElement)),
      focusedClass: document.activeElement?.className || '',
      role: overlay?.getAttribute('role'),
      ariaModal: overlay?.getAttribute('aria-modal'),
      withinViewport: rect
        ? rect.left >= 0 && rect.right <= innerWidth &&
          rect.top >= 0 && rect.bottom <= innerHeight
        : null,
      touchAction: reveal ? getComputedStyle(reveal).touchAction : null
    };
  });
}

async function revealEvent(page) {
  await page.locator('.ui-random-event-omen-reveal').click();
  await expect(page.locator('#ui-random-event-overlay')).toHaveAttribute(
    'data-event-stage',
    'decision'
  );
  await expect(page.locator('.ui-random-event-choice-btn')).toHaveCount(2);
  await page.waitForTimeout(260);
}

test.describe('R031 预知未来的事件预兆与揭示交接', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口先呈现可读预兆，再把焦点交给真实事件', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetProbe(page);
      await showForesight(page);
      const omen = await readStage(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-foresight-omen.png`)
        });
      }

      expect(omen.withinViewport).toBe(true);
      if (PHASE === 'before') {
        expect(omen.stage).toBe('legacy-decision');
        expect(omen.title).toBe(EVENT.title);
        expect(omen.choiceCount).toBe(2);
        expect(omen.toastCount).toBe(1);
        expect(omen.hasOmenSummary).toBe(false);
        expect(omen.revealVisible).toBe(false);
      } else {
        expect(omen.stage).toBe('omen');
        expect(omen.role).toBe('dialog');
        expect(omen.ariaModal).toBe('true');
        expect(omen.label).toContain('预知未来');
        expect(omen.title).toContain(EVENT.title);
        expect(omen.body).toContain('尚未发生');
        expect(omen.hasOmenSummary).toBe(true);
        expect(omen.impactCount).toBe(4);
        expect(omen.revealVisible).toBe(true);
        expect(omen.revealHeight).toBeGreaterThanOrEqual(48);
        expect(omen.choiceCount).toBe(0);
        expect(omen.toastCount).toBe(0);
        expect(omen.focusInside).toBe(true);
        expect(omen.focusedClass).toContain('ui-random-event-omen-reveal');
        expect(omen.touchAction).toBe('manipulation');

        await revealEvent(page);
        const decision = await readStage(page);
        expect(decision.stage).toBe('decision');
        expect(decision.title).toBe(EVENT.title);
        expect(decision.choiceCount).toBe(2);
        expect(decision.minChoiceHeight).toBeGreaterThanOrEqual(44);
        expect(decision.hasOmenSummary).toBe(false);
        expect(decision.toastCount).toBe(0);
        expect(decision.focusInside).toBe(true);
        expect(decision.focusedClass).toContain('ui-random-event-choice-btn');

        if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
          await page.screenshot({
            path: path.join(EVIDENCE_DIR, `${viewport.id}-foresight-reveal.png`)
          });
        }
        matrix.push({ id: viewport.id, omen, decision });
        continue;
      }

      matrix.push({ id: viewport.id, omen });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'foresight-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('键盘揭示、选择和结果确认只完成一次事件', async ({ page }) => {
    test.skip(PHASE === 'before', '完整揭示闭环只验收改造后的实现');
    await installProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await resetProbe(page);
    await showForesight(page);

    await expect(page.locator('.ui-random-event-omen-reveal')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ui-random-event-overlay')).toHaveAttribute(
      'data-event-stage',
      'decision'
    );
    await expect(page.locator('.ui-random-event-choice-btn').first()).toBeFocused();

    await page.keyboard.press('2');
    await expect(page.locator('#ui-random-event-feedback')).toHaveClass(/visible/, {
      timeout: 2_000
    });
    await expect(page.locator('#ui-random-event-feedback-continue')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ui-random-event-feedback')).not.toHaveClass(/visible/);

    const completion = await page.evaluate(() => ({
      count: window.__r031Probe.completions,
      value: window.__r031Probe.completion
    }));
    expect(completion.count).toBe(1);
    expect(completion.value.eventId).toBe(EVENT.id);
    expect(completion.value.effects).toEqual(expect.objectContaining({
      reputation: -1,
      trust: 1,
      pressure: 2
    }));
  });
});
