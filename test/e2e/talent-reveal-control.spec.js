import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R038', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

async function installTalentProbe(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    window.__r038Probe?.system?.destroy();
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const rotate = document.getElementById('rotate-hint');
    if (rotate) rotate.style.display = 'none';

    const [{ TalentSystem }, { TALENTS }] = await Promise.all([
      import('/luohammer-pixel-game/src/systems/TalentSystem.js'),
      import('/luohammer-pixel-game/src/data/talents.js')
    ]);
    const ids = ['stubborn', 'all_in', 'bookworm', 'iron_will', 'social_butterfly'];
    const talents = ids.map(id => TALENTS.find(talent => talent.id === id));
    const system = new TalentSystem({ audio: { enabled: false } });
    system.show(talents, () => {});
    window.__r038Probe = { system, talents };
  });
  await expect(page.locator('#ui-talent-overlay')).toBeVisible();
  await expect(page.locator('.ui-talent-card')).toHaveCount(5);
}

async function restartTalentProbe(page) {
  await page.evaluate(() => {
    const { system, talents } = window.__r038Probe;
    system.show(talents, () => {});
  });
}

async function forceReadyBefore(page) {
  await page.evaluate(() => {
    const { system } = window.__r038Probe;
    system._clearRevealTimers();
    for (const animation of document.getAnimations()) {
      const target = animation.effect?.target;
      if (target instanceof Element && target.closest('.ui-talent-card')) {
        animation.cancel();
      }
    }
    system._completeReveal([...system.cardsEl.querySelectorAll('.ui-talent-card')]);
  });
}

async function waitAndFreezeRevealFrame(page, delay) {
  await page.evaluate(async waitMs => {
    await new Promise(resolve => setTimeout(resolve, waitMs));
    window.__r038Probe.system._clearRevealTimers();
    for (const animation of document.getAnimations()) {
      const target = animation.effect?.target;
      if (target instanceof Element && target.closest('.ui-talent-card')) {
        animation.pause();
        animation.currentTime = waitMs;
      }
    }
  }, delay);
}

async function readRevealState(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('ui-talent-overlay');
    const cards = [...overlay.querySelectorAll('.ui-talent-card')];
    const skip = document.getElementById('ui-talent-skip');
    const skipRect = skip?.getBoundingClientRect();
    const confirmRect = document.getElementById('ui-talent-confirm').getBoundingClientRect();
    const cardRects = cards.map(card => {
      const rect = card.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom)
      };
    });
    const withinViewport = rect =>
      rect.left >= -2 &&
      rect.right <= innerWidth + 2 &&
      rect.top >= -2 &&
      rect.bottom <= innerHeight + 2;

    return {
      phase: overlay.dataset.phase || '',
      ariaBusy: overlay.getAttribute('aria-busy'),
      hint: overlay.querySelector('.ui-talent-hint')
        ?.textContent.replace(/\s+/g, ' ').trim() || '',
      subtitle: overlay.querySelector('.ui-talent-subtitle')
        ?.textContent.replace(/\s+/g, ' ').trim() || '',
      activeCount: cards.filter(card => card.classList.contains('is-reveal-active')).length,
      settledCount: cards.filter(card => card.classList.contains('is-reveal-settled')).length,
      activePosition: cards.find(card =>
        card.classList.contains('is-reveal-active')
      )?.dataset.position || '',
      disabledCount: cards.filter(card => card.disabled).length,
      revealedCount: cards.filter(card => card.classList.contains('is-revealed')).length,
      skipExists: Boolean(skip),
      skipVisible: Boolean(skip && !skip.hidden && skipRect?.width && skipRect?.height),
      skipHeight: Math.round(skipRect?.height || 0),
      skipFocused: document.activeElement === skip,
      firstCardFocused: document.activeElement === cards[0],
      cardsWithinViewport: cardRects.every(withinViewport),
      confirmWithinViewport: withinViewport(confirmRect),
      cardRects,
      activeElementId: document.activeElement?.id || '',
      activeElementPosition: document.activeElement?.dataset?.position || ''
    };
  });
}

test.describe('R038 天赋逐张揭晓状态、跳过控制与焦点交接', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('揭晓过程可感知、可跳过，并保持六视口容量', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installTalentProbe(page);
    const initial = await readRevealState(page);
    await waitAndFreezeRevealFrame(page, 850);
    const desktopReveal = await readRevealState(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'desktop-1440x900-talent-reveal.png')
    });
    await restartTalentProbe(page);
    await waitAndFreezeRevealFrame(page, 1180);
    const desktopProgress = await readRevealState(page);

    expect(desktopProgress.phase).toBe('revealing');
    expect(desktopProgress.ariaBusy).toBe('true');
    if (PHASE === 'before') {
      expect(initial.skipExists).toBe(false);
      expect(desktopReveal.activeCount).toBe(0);
      expect(desktopProgress.settledCount).toBe(0);
      await forceReadyBefore(page);
    } else {
      expect(initial.skipVisible).toBe(true);
      expect(initial.skipFocused).toBe(true);
      expect(initial.skipHeight).toBeGreaterThanOrEqual(44);
      expect(desktopReveal.activeCount).toBe(1);
      expect(desktopProgress.settledCount).toBeGreaterThan(0);
      expect(desktopProgress.hint).toMatch(/正在揭晓第 \d+ 张/);
      await page.locator('#ui-talent-skip').click();
    }

    await expect(page.locator('#ui-talent-overlay')).toHaveAttribute('data-phase', 'choosing');
    let ready = await readRevealState(page);
    expect(ready.disabledCount).toBe(0);
    expect(ready.revealedCount).toBe(5);
    expect(ready.firstCardFocused).toBe(true);
    if (PHASE === 'after') {
      expect(ready.skipVisible).toBe(false);
      expect(ready.settledCount).toBe(5);
    }

    const matrix = [];
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(120);
      ready = await readRevealState(page);
      expect(ready.cardsWithinViewport).toBe(true);
      expect(ready.confirmWithinViewport).toBe(true);
      matrix.push({ id: viewport.id, state: ready });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await restartTalentProbe(page);
    await waitAndFreezeRevealFrame(page, 850);
    const mobileReveal = await readRevealState(page);
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'mobile-390x844-talent-reveal.png')
    });
    if (PHASE === 'after') {
      expect(mobileReveal.skipVisible).toBe(true);
      expect(mobileReveal.activeCount).toBe(1);
      expect(mobileReveal.skipHeight).toBeGreaterThanOrEqual(44);
      await page.locator('#ui-talent-skip').click();
    } else {
      await forceReadyBefore(page);
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'talent-reveal-matrix.json'),
      `${JSON.stringify({
        phase: PHASE,
        initial,
        desktopReveal,
        desktopProgress,
        mobileReveal,
        matrix
      }, null, 2)}\n`,
      'utf8'
    );
  });

  test('自然揭晓结束后隐藏跳过按钮并把焦点交给第一张牌', async ({ page }) => {
    test.skip(PHASE === 'before', '逐张状态与隐藏按钮焦点交接只验收改造后的实现');
    await page.setViewportSize({ width: 390, height: 844 });
    await installTalentProbe(page);
    await expect(page.locator('#ui-talent-skip')).toBeFocused();
    await expect(page.locator('#ui-talent-overlay')).toHaveAttribute(
      'data-phase',
      'choosing',
      { timeout: 5000 }
    );
    await expect(page.locator('#ui-talent-skip')).toBeHidden();
    await expect(page.locator('.ui-talent-card').first()).toBeFocused();
    const state = await readRevealState(page);
    expect(state.settledCount).toBe(5);
    expect(state.activeCount).toBe(0);
    expect(state.ariaBusy).toBe('false');
  });
});
