import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R019');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

async function showTalentProbe(page) {
  await page.evaluate(async () => {
    window.__talentVisualProbe?.system?.destroy();
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const skip = document.getElementById('ui-intro-skip-hint');
    if (skip) skip.style.display = 'none';

    const [{ TalentSystem }, { TALENTS }] = await Promise.all([
      import('/luohammer-pixel-game/src/systems/TalentSystem.js'),
      import('/luohammer-pixel-game/src/data/talents.js')
    ]);
    const ids = ['stubborn', 'all_in', 'bookworm', 'iron_will', 'social_butterfly'];
    const talents = ids.map(id => TALENTS.find(talent => talent.id === id));
    const scene = { audio: { enabled: false } };
    const system = new TalentSystem(scene);
    system.show(talents, () => {});
    system._clearRevealTimers();
    window.__talentVisualProbe = { system, talents, TalentSystem };
  });
  await expect(page.locator('#ui-talent-overlay')).toBeVisible();
  await expect(page.locator('.ui-talent-card')).toHaveCount(5);
}

async function pauseTalentAnimationsAt(page, currentTime) {
  await page.evaluate(time => {
    const animations = document.getAnimations().filter(animation => {
      const target = animation.effect?.target;
      return target instanceof Element && Boolean(target.closest('.ui-talent-card'));
    });
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = time;
    }
  }, currentTime);
  await page.waitForTimeout(32);
}

async function readTalentState(page) {
  return page.locator('#ui-talent-overlay').evaluate(overlay => {
    const cards = [...overlay.querySelectorAll('.ui-talent-card')];
    const cardBoxes = cards.map(card => {
      const rect = card.getBoundingClientRect();
      const inner = card.querySelector('.ui-talent-card-inner');
      const transform = getComputedStyle(inner).transform;
      let facing = 0;
      try {
        facing = transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).m11;
      } catch {
        facing = 0;
      }
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        opacity: Number(getComputedStyle(card).opacity),
        frontFacing: facing > 0,
        disabled: card.disabled,
        revealed: card.classList.contains('is-revealed'),
        selected: card.classList.contains('selected'),
        ariaPressed: card.getAttribute('aria-pressed')
      };
    });
    const confirm = overlay.querySelector('#ui-talent-confirm');
    const confirmBox = confirm.getBoundingClientRect();
    const cardsBox = overlay.querySelector('#ui-talent-cards').getBoundingClientRect();
    return {
      ariaBusy: overlay.getAttribute('aria-busy') || '',
      hint: overlay.querySelector('.ui-talent-hint')
        ?.textContent.replace(/\s+/g, ' ').trim() || '',
      combo: overlay.querySelector('.ui-talent-combo')
        ?.textContent.replace(/\s+/g, ' ').trim() || '',
      cardBoxes,
      visibleCardCount: cardBoxes.filter(card => card.opacity > 0.1).length,
      frontFacingCount: cardBoxes.filter(card => card.frontFacing).length,
      disabledCount: cardBoxes.filter(card => card.disabled).length,
      selectedCount: cardBoxes.filter(card => card.selected).length,
      cardsViewport: {
        height: Math.round(cardsBox.height),
        scrollHeight: overlay.querySelector('#ui-talent-cards').scrollHeight
      },
      confirm: {
        text: confirm.textContent.replace(/\s+/g, ' ').trim(),
        disabled: confirm.disabled,
        focused: document.activeElement === confirm,
        left: Math.round(confirmBox.left),
        top: Math.round(confirmBox.top),
        right: Math.round(confirmBox.right),
        bottom: Math.round(confirmBox.bottom),
        width: Math.round(confirmBox.width),
        height: Math.round(confirmBox.height)
      },
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
}

async function readTiming(page) {
  return page.locator('.ui-talent-card').evaluateAll(cards => {
    const dealDelays = cards.map(card =>
      Number.parseFloat(card.style.getPropertyValue('--talent-deal-delay')) || 0
    );
    const revealDelays = cards.map(card =>
      Number.parseFloat(card.style.getPropertyValue('--talent-reveal-delay')) || 0
    );
    const dealDuration = Number.parseFloat(getComputedStyle(cards[0]).animationDuration) * 1000;
    const flipDuration = Number.parseFloat(
      getComputedStyle(cards[0].querySelector('.ui-talent-card-inner')).animationDuration
    ) * 1000;
    return {
      dealDelays,
      revealDelays,
      dealDuration: Math.round(dealDuration),
      flipDuration: Math.round(flipDuration),
      allBackStableWindow: Math.round(
        Math.min(...revealDelays) - (Math.max(...dealDelays) + dealDuration)
      ),
      totalSequence: Math.round(Math.max(...revealDelays) + flipDuration)
    };
  });
}

async function settleCardsForInteraction(page) {
  await page.evaluate(() => {
    const { system } = window.__talentVisualProbe;
    for (const animation of document.getAnimations()) {
      const target = animation.effect?.target;
      if (target instanceof Element && target.closest('.ui-talent-card')) {
        animation.cancel();
      }
    }
    const cards = [...system.cardsEl.querySelectorAll('.ui-talent-card')];
    if (typeof system._completeReveal === 'function') {
      system._completeReveal(cards);
      return;
    }
    for (const card of cards) {
      card.disabled = false;
      card.removeAttribute('aria-disabled');
      card.tabIndex = 0;
      card.classList.remove('is-dealing');
      card.classList.add('is-revealed');
    }
    system.overlay.removeAttribute('aria-busy');
    system._focusFirstAvailableCard();
  });
  await page.waitForTimeout(50);
}

async function measureLiveUnlock(page) {
  return page.evaluate(async () => {
    const old = window.__talentVisualProbe;
    old.system.destroy();
    const system = new old.TalentSystem({ audio: { enabled: false } });
    const unlockedAt = Array(old.talents.length).fill(null);
    const startedAt = performance.now();
    system.show(old.talents, () => {});
    const cards = [...system.cardsEl.querySelectorAll('.ui-talent-card')];
    const result = await new Promise(resolve => {
      const poll = setInterval(() => {
        cards.forEach((card, index) => {
          if (!card.disabled && unlockedAt[index] === null) {
            unlockedAt[index] = performance.now() - startedAt;
          }
        });
        if (unlockedAt.every(value => value !== null)) {
          clearInterval(poll);
          resolve({
            unlockedAt,
            focusedPosition: document.activeElement?.dataset?.position || ''
          });
        }
      }, 8);
      setTimeout(() => {
        clearInterval(poll);
        resolve({
          unlockedAt,
          focusedPosition: document.activeElement?.dataset?.position || ''
        });
      }, 4000);
    });
    window.__talentVisualProbe = { ...old, system };
    const values = result.unlockedAt.filter(value => value !== null);
    return {
      unlockedCount: values.length,
      unlockSpread: values.length
        ? Math.round(Math.max(...values) - Math.min(...values))
        : -1,
      totalUnlockTime: values.length ? Math.round(Math.max(...values)) : -1,
      focusedPosition: result.focusedPosition
    };
  });
}

test('天赋翻牌应有清晰阶段、跨端容量和选择确认反馈', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/');
  await page.setViewportSize({ width: 1440, height: 900 });
  await showTalentProbe(page);

  const timing = await readTiming(page);
  await pauseTalentAnimationsAt(page, 120);
  const startFrame = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-deal-start.png') });

  const backFrameTime = Math.max(
    0,
    Math.min(...timing.revealDelays) -
      Math.max(20, Math.round(timing.allBackStableWindow / 2))
  );
  await pauseTalentAnimationsAt(page, backFrameTime);
  const backFrame = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-deal-backs.png') });

  const midFrameTime = Math.round(
    timing.revealDelays[0] + timing.flipDuration * 0.68
  );
  await pauseTalentAnimationsAt(page, midFrameTime);
  const midFrame = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-deal-mid.png') });

  await pauseTalentAnimationsAt(page, timing.totalSequence + 40);
  const endFrame = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-deal-end.png') });

  await settleCardsForInteraction(page);
  const desktopFinal = await readTalentState(page);
  const cards = page.locator('.ui-talent-card');
  await cards.nth(0).click();
  await cards.nth(3).click();
  const desktopSelected = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-selected.png') });

  await cards.nth(3).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const confirmKeyboardReachable = await page.evaluate(
    () => document.activeElement?.id === 'ui-talent-confirm'
  );

  await cards.nth(0).click();
  await cards.nth(3).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFinal = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-final.png') });
  await cards.nth(0).click();
  await cards.nth(3).click();
  const mobileSelected = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-selected.png') });

  await page.setViewportSize({ width: 375, height: 812 });
  const mobileGuard = await readTalentState(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-375-selected.png') });

  const liveUnlock = await measureLiveUnlock(page);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const old = window.__talentVisualProbe;
    old.system.destroy();
    const system = new old.TalentSystem({ audio: { enabled: false } });
    system.show(old.talents, () => {});
    window.__talentVisualProbe = { ...old, system };
  });
  const reducedMotion = await readTalentState(page);
  reducedMotion.focusedPosition = await page.evaluate(
    () => document.activeElement?.dataset?.position || ''
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  const report = {
    schemaVersion: 1,
    round: 'R019',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    timing,
    backFrameTime,
    midFrameTime,
    startFrame,
    backFrame,
    midFrame,
    endFrame,
    desktopFinal,
    desktopSelected,
    confirmKeyboardReachable,
    mobileFinal,
    mobileSelected,
    mobileGuard,
    liveUnlock,
    reducedMotion
  };
  const layoutFits = state =>
    state.cardBoxes.every(card =>
      card.left >= 0 &&
      card.right <= state.viewport.width &&
      card.top >= 0 &&
      card.bottom <= state.viewport.height
    ) &&
    state.confirm.left >= 0 &&
    state.confirm.right <= state.viewport.width &&
    state.confirm.top >= 0 &&
    state.confirm.bottom <= state.viewport.height;
  report.passed = layoutFits(desktopFinal) &&
    layoutFits(mobileFinal) &&
    liveUnlock.unlockedCount === 5 &&
    desktopSelected.selectedCount === 2 &&
    !desktopSelected.confirm.disabled;
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.timing.allBackStableWindow).toBeLessThanOrEqual(0);
    expect(before.liveUnlock.unlockSpread).toBeGreaterThan(300);
    expect(Math.min(...before.mobileGuard.cardBoxes.map(card => card.left)))
      .toBeLessThan(0);
    expect(before.mobileFinal.cardBoxes.some(card => card.opacity < 0.99))
      .toBeTruthy();

    expect(timing.allBackStableWindow).toBeGreaterThanOrEqual(80);
    expect(timing.totalSequence).toBeLessThanOrEqual(1500);
    expect(startFrame.frontFacingCount).toBe(0);
    expect(backFrame.visibleCardCount).toBe(5);
    expect(backFrame.frontFacingCount).toBe(0);
    expect(midFrame.frontFacingCount).toBeGreaterThan(0);
    expect(midFrame.frontFacingCount).toBeLessThan(5);
    expect(endFrame.frontFacingCount).toBe(5);
    expect(startFrame.ariaBusy).toBe('true');
    expect(startFrame.hint).toContain('揭晓');
    expect(liveUnlock.unlockSpread).toBeLessThanOrEqual(40);
    expect(liveUnlock.focusedPosition).toBe('1/5');
    expect(reducedMotion.disabledCount).toBe(0);
    expect(reducedMotion.frontFacingCount).toBe(5);
    expect(reducedMotion.ariaBusy).toBe('false');
    expect(reducedMotion.focusedPosition).toBe('1/5');
    expect(desktopSelected.cardBoxes.every(card => card.height >= 44)).toBeTruthy();
    expect(mobileSelected.cardBoxes.every(card => card.height >= 88)).toBeTruthy();
    expect(layoutFits(mobileGuard)).toBeTruthy();
    expect(mobileFinal.cardBoxes.every(card => card.opacity === 1)).toBeTruthy();
    expect(mobileGuard.cardsViewport.scrollHeight)
      .toBeLessThanOrEqual(mobileGuard.cardsViewport.height + 2);
    expect(desktopSelected.confirm.height).toBeGreaterThanOrEqual(44);
    expect(mobileSelected.confirm.height).toBeGreaterThanOrEqual(44);
    expect(confirmKeyboardReachable).toBeTruthy();
  }

  await page.evaluate(() => window.__talentVisualProbe?.system?.destroy());
});
