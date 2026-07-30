import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R039', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900, mode: 'desktop' },
  { id: 'desktop-1366x768', width: 1366, height: 768, mode: 'desktop' },
  { id: 'desktop-1920x1080', width: 1920, height: 1080, mode: 'desktop' },
  { id: 'mobile-390x844', width: 390, height: 844, mode: 'mobile' },
  { id: 'mobile-375x812', width: 375, height: 812, mode: 'mobile' },
  { id: 'mobile-360x800', width: 360, height: 800, mode: 'mobile' }
];

async function installTalentProbe(page) {
  await page.goto('/');
  await page.evaluate(async () => {
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
    window.__r039Probe = { system, talents };
  });
  await expect(page.locator('.ui-talent-card')).toHaveCount(5);
}

async function restartTalentProbe(page) {
  await page.evaluate(() => {
    const { system, talents } = window.__r039Probe;
    system.show(talents, () => {});
  });
}

async function freezeAtHalfFlip(page) {
  await page.evaluate(() => {
    const { system } = window.__r039Probe;
    system._clearRevealTimers();
    const cards = [...system.cardsEl.querySelectorAll('.ui-talent-card')];
    for (const [index, card] of cards.entries()) {
      card.style.animation = 'none';
      card.style.opacity = '1';
      card.style.transform = 'none';
      card.classList.remove('is-reveal-active', 'is-reveal-settled');
      card.dataset.revealState = 'pending';
      const inner = card.querySelector('.ui-talent-card-inner');
      const animation = inner.getAnimations()[0];
      if (!animation) continue;
      animation.pause();
      const timing = animation.effect.getTiming();
      animation.currentTime = Number(timing.delay) + (index === 0
        ? Number(timing.duration) * 0.5
        : 0);
    }
    system._setActiveReveal(cards[0], 0);
  });
}

async function readMotionState(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('ui-talent-overlay');
    const cards = [...overlay.querySelectorAll('.ui-talent-card')];
    const active = cards.find(card => card.classList.contains('is-reveal-active'));
    const inner = active.querySelector('.ui-talent-card-inner');
    const activeFace = active.querySelector('.ui-talent-card-front');
    const cardRect = active.getBoundingClientRect();
    const faceRect = activeFace.getBoundingClientRect();
    const lastCardRect = cards.at(-1).getBoundingClientRect();
    const hintRect = overlay.querySelector('.ui-talent-hint').getBoundingClientRect();
    const confirmRect = document.getElementById('ui-talent-confirm').getBoundingClientRect();
    const transform = getComputedStyle(inner).transform;
    const matrix = new DOMMatrix(transform);
    const axis = Math.abs(matrix.m11) < Math.abs(matrix.m22) ? 'y' : 'x';
    const withinViewport = rect =>
      rect.left >= -2 &&
      rect.right <= innerWidth + 2 &&
      rect.top >= -2 &&
      rect.bottom <= innerHeight + 2;

    return {
      phase: overlay.dataset.phase,
      axis,
      animationName: getComputedStyle(inner).animationName,
      activeCount: cards.filter(card => card.classList.contains('is-reveal-active')).length,
      cardWidth: Math.round(cardRect.width),
      cardHeight: Math.round(cardRect.height),
      faceWidth: Math.round(faceRect.width),
      faceHeight: Math.round(faceRect.height),
      widthRetention: Number((faceRect.width / cardRect.width).toFixed(2)),
      heightRetention: Number((faceRect.height / cardRect.height).toFixed(2)),
      deckToHintGap: Math.round(hintRect.top - lastCardRect.bottom),
      cardsWithinViewport: cards.every(card => withinViewport(card.getBoundingClientRect())),
      confirmWithinViewport: withinViewport(confirmRect)
    };
  });
}

test.describe('R039 横竖卡面自适应翻牌轴与移动揭晓节奏', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('纵卡沿 Y 轴、横卡沿 X 轴翻转，并保持六视口槽位和进度可达', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installTalentProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await restartTalentProbe(page);
      await freezeAtHalfFlip(page);
      const state = await readMotionState(page);
      matrix.push({ id: viewport.id, state });

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-talent-half-flip.png`)
        });
      }

      expect(state.phase).toBe('revealing');
      expect(state.activeCount).toBe(1);
      expect(state.cardsWithinViewport).toBe(true);
      expect(state.confirmWithinViewport).toBe(true);
      if (viewport.mode === 'desktop') {
        expect(state.axis).toBe('y');
        expect(state.widthRetention).toBeLessThan(0.2);
        expect(state.heightRetention).toBeGreaterThan(0.9);
      } else if (PHASE === 'before') {
        expect(state.axis).toBe('y');
        expect(state.widthRetention).toBeLessThan(0.2);
        expect(state.deckToHintGap).toBeGreaterThan(60);
      } else {
        expect(state.axis).toBe('x');
        expect(state.widthRetention).toBeGreaterThan(0.9);
        expect(state.heightRetention).toBeLessThan(0.2);
        expect(state.deckToHintGap).toBeLessThanOrEqual(24);
      }
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'talent-flip-axis-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('减少动态效果仍直接进入完整可选择态', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await installTalentProbe(page);
    const state = await page.evaluate(() => {
      const overlay = document.getElementById('ui-talent-overlay');
      const cards = [...overlay.querySelectorAll('.ui-talent-card')];
      return {
        phase: overlay.dataset.phase,
        enabledCount: cards.filter(card => !card.disabled).length,
        animations: cards.reduce(
          (count, card) => count + card.getAnimations({ subtree: true }).length,
          0
        )
      };
    });
    expect(state).toEqual({
      phase: 'choosing',
      enabledCount: 5,
      animations: 0
    });
  });
});
