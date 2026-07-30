import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(120_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R036', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const INITIAL_META = {
  exp: 5,
  unlockedSkills: ['tough_mind', 'iron_will', 'phoenix'],
  seenEndings: [],
  playCount: 2,
  totalChoices: 18,
  seenEvents: [],
  achievementScore: 0,
  claimedMilestones: [],
  claimedAchievementMilestones: [],
  titles: []
};

async function installProbe(page) {
  await page.goto('/');
  await page.evaluate(async initialMeta => {
    if (window.game?.destroy) {
      window.game.destroy(false);
      delete window.game;
    }
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const rotate = document.getElementById('rotate-hint');
    if (rotate) rotate.style.display = 'none';

    const [{ EndingScene }, { MetaProgression }] = await Promise.all([
      import('/luohammer-pixel-game/src/scenes/EndingScene.js'),
      import('/luohammer-pixel-game/src/systems/MetaProgression.js')
    ]);
    localStorage.setItem('luohammer_meta_progress', JSON.stringify(initialMeta));
    const scene = Object.create(EndingScene.prototype);
    scene.meta = new MetaProgression();
    scene.audio = { playAchievement() {} };
    scene._expGained = 3;
    scene._isNewEnding = true;

    const trigger = document.createElement('button');
    trigger.id = 'r036-skill-tree-trigger';
    trigger.textContent = '打开技能树';
    trigger.style.cssText = 'position:fixed;left:8px;top:8px;';
    document.body.appendChild(trigger);
    trigger.focus();

    window.__r036Probe = {
      scene,
      trigger,
      render() {
        scene._showSkillTree();
      }
    };
  }, INITIAL_META);
}

async function readSkillTreeState(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('ui-skill-tree-overlay');
    const panel = overlay?.querySelector('.skill-tree-panel');
    const scroll = overlay?.querySelector('.skill-tree-scroll');
    const exp = document.getElementById('skill-tree-exp');
    const close = overlay?.querySelector('.skill-tree-close') ||
      [...(overlay?.querySelectorAll('button') || [])].find(button =>
        button.textContent.trim() === '关闭'
      );
    const overlayRect = overlay?.getBoundingClientRect();
    const panelRect = panel?.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();
    const treeCards = overlay?.querySelectorAll('.skill-tree-branch') || [];
    const skillButtons = overlay?.querySelectorAll('.skill-tree-node') || [];
    const clickableDivs = [...(overlay?.querySelectorAll('div') || [])].filter(
      element => getComputedStyle(element).cursor === 'pointer'
    );
    return {
      role: overlay?.getAttribute('role') || null,
      ariaModal: overlay?.getAttribute('aria-modal') || null,
      ariaLabelledby: overlay?.getAttribute('aria-labelledby') || null,
      overlayWithinViewport: overlayRect
        ? overlayRect.left >= -2 &&
          overlayRect.right <= innerWidth + 2 &&
          overlayRect.top >= -2 &&
          overlayRect.bottom <= innerHeight + 2
        : false,
      panelWithinViewport: panelRect
        ? panelRect.left >= -2 &&
          panelRect.right <= innerWidth + 2 &&
          panelRect.top >= -2 &&
          panelRect.bottom <= innerHeight + 2
        : null,
      expText: exp?.textContent.replace(/\s+/g, ' ').trim() || '',
      treeCount: treeCards.length,
      skillButtonCount: skillButtons.length,
      availableCount: overlay?.querySelectorAll('.skill-tree-node.is-available').length || 0,
      unlockedCount: overlay?.querySelectorAll('.skill-tree-node.is-unlocked').length || 0,
      excludedCount: overlay?.querySelectorAll('.skill-tree-node.is-excluded').length || 0,
      clickableDivCount: clickableDivs.length,
      hasReasonText: /需先解锁|还差 \d+ EXP|分支已锁/.test(overlay?.textContent || ''),
      closeHeight: Math.round(closeRect?.height || 0),
      scrollable: scroll
        ? scroll.scrollHeight > scroll.clientHeight + 2
        : overlay
          ? overlay.scrollHeight > overlay.clientHeight + 2
          : false,
      activeSkillId: document.activeElement?.dataset?.skillId || '',
      activeElementId: document.activeElement?.id || ''
    };
  });
}

test.describe('R036 技能树状态说明、永久消费确认与焦点闭环', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口呈现可理解、可滚动和可聚焦的技能状态', async ({ page }) => {
    await installProbe(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => window.__r036Probe.render());
      await page.waitForTimeout(300);
      const state = await readSkillTreeState(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-skill-tree.png`)
        });
      }

      expect(state.overlayWithinViewport).toBe(true);
      expect(state.expText).toContain('5 EXP');
      if (PHASE === 'before') {
        expect(state.role).toBeNull();
        expect(state.skillButtonCount).toBe(0);
        expect(state.clickableDivCount).toBeGreaterThan(0);
        expect(state.hasReasonText).toBe(false);
      } else {
        expect(state.role).toBe('dialog');
        expect(state.ariaModal).toBe('true');
        expect(state.ariaLabelledby).toBe('skill-tree-title');
        expect(state.panelWithinViewport).toBe(true);
        expect(state.treeCount).toBe(4);
        expect(state.skillButtonCount).toBe(24);
        expect(state.availableCount).toBeGreaterThan(0);
        expect(state.unlockedCount).toBe(3);
        expect(state.hasReasonText).toBe(true);
        expect(state.closeHeight).toBeGreaterThanOrEqual(44);
        expect(state.activeSkillId).toBe('survival_instinct');
        if (viewport.width <= 390) expect(state.scrollable).toBe(true);
      }
      matrix.push({ id: viewport.id, state });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'skill-tree-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('永久 EXP 消费先确认、原子解锁并恢复焦点', async ({ page }) => {
    test.skip(PHASE === 'before', '确认与焦点闭环只验收改造后的实现');
    await installProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.__r036Probe.render());

    const skill = page.locator('[data-skill-id="survival_instinct"]');
    await skill.click();
    await expect(page.locator('.skill-tree-confirm')).toBeVisible();
    await expect(page.locator('.skill-tree-confirm')).toContainText('5 → 1 EXP');
    await expect(page.locator('.skill-tree-confirm-action')).toBeFocused();
    expect(await page.locator('#skill-tree-exp').textContent()).toContain('5 EXP');

    await page.keyboard.press('Escape');
    await expect(page.locator('.skill-tree-confirm')).toBeHidden();
    await expect(skill).toBeFocused();
    expect(await page.locator('#skill-tree-exp').textContent()).toContain('5 EXP');

    await skill.click();
    await page.locator('.skill-tree-confirm-action').click();
    await expect(page.locator('[data-skill-id="survival_instinct"]')).toContainText('已解锁');
    await expect(page.locator('[data-skill-id="mountain_calm"]')).toContainText('分支已锁');
    await expect(page.locator('#skill-tree-exp')).toContainText('1 EXP');
    await expect(page.locator('[data-skill-id="survival_instinct"]')).toBeFocused();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('luohammer_meta_progress'))
    );
    expect(stored.exp).toBe(1);
    expect(stored.unlockedSkills.filter(id => id === 'survival_instinct')).toHaveLength(1);

    await page.keyboard.press('Escape');
    await expect(page.locator('#ui-skill-tree-overlay')).toHaveCount(0);
    await expect(page.locator('#r036-skill-tree-trigger')).toBeFocused();
  });
});
