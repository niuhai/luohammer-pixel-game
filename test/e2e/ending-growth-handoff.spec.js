import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

test.setTimeout(180_000);

const PHASE = process.env.UI_ITERATION_PHASE === 'before' ? 'before' : 'after';
const EVIDENCE_DIR = path.join('.iteration', 'evidence', 'R037', PHASE);
const VIEWPORTS = [
  { id: 'desktop-1440x900', width: 1440, height: 900 },
  { id: 'desktop-1366x768', width: 1366, height: 768 },
  { id: 'desktop-1920x1080', width: 1920, height: 1080 },
  { id: 'mobile-390x844', width: 390, height: 844 },
  { id: 'mobile-375x812', width: 375, height: 812 },
  { id: 'mobile-360x800', width: 360, height: 800 }
];

const ENDING_STATE = {
  pride: 7,
  wealth: 6,
  reputation: 5,
  failures: 2,
  pressure: 4,
  trust: 6,
  pressureMax: 10,
  failurePenalty: 1,
  successBonus: 1,
  talentSpecials: [],
  currentStageId: 'youth',
  currentNode: 'ending_scholar',
  progress: 95,
  flags: [],
  triggeredEvents: [],
  history: [],
  achievements: [],
  gameStartTime: Date.now() - 60_000
};

const INITIAL_META = {
  exp: 2,
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

async function enterEnding(page) {
  await page.goto('/');
  await page.evaluate(({ state, meta }) => {
    localStorage.clear();
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    localStorage.setItem('luohammer_meta_progress', JSON.stringify(meta));
  }, { state: ENDING_STATE, meta: INITIAL_META });
  await page.reload();
  await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
  await page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }).click();
  await expect(page.locator('#ui-ending-overlay')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#ui-ending-title')).not.toBeEmpty({ timeout: 15_000 });
  await page.waitForTimeout(1800);
}

async function readGrowthState(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('ui-ending-overlay');
    const actions = document.getElementById('ui-ending-buttons');
    const growth = overlay?.querySelector('.ui-ending-growth');
    const directButtons = [...(actions?.children || [])]
      .filter(element => element.matches('.ui-ending-btn'));
    const visibleExpText = [...(overlay?.querySelectorAll('*') || [])]
      .filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return element.children.length === 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          /\bEXP\b/.test(element.textContent || '');
      })
      .map(element => element.textContent.replace(/\s+/g, ' ').trim());
    const actionsRect = actions?.getBoundingClientRect();
    const growthRect = growth?.getBoundingClientRect();
    const scene = window.game?.scene?.getScene('EndingScene');
    return {
      expGained: scene?._expGained ?? null,
      totalExp: scene?.meta?.getExp?.() ?? null,
      hasGrowthHandoff: Boolean(growth),
      growthVisible: Boolean(growthRect?.width && growthRect?.height),
      growthText: growth?.textContent.replace(/\s+/g, ' ').trim() || '',
      directButtonCount: directButtons.length,
      directButtonLabels: directButtons.map(button =>
        button.textContent.replace(/\s+/g, ' ').trim()
      ),
      visibleExpText,
      actionsWithinViewport: actionsRect
        ? actionsRect.left >= -2 &&
          actionsRect.right <= innerWidth + 2 &&
          actionsRect.top >= -2 &&
          actionsRect.bottom <= innerHeight + 2
        : false,
      growthWithinViewport: growthRect
        ? growthRect.left >= -2 &&
          growthRect.right <= innerWidth + 2 &&
          growthRect.top >= -2 &&
          growthRect.bottom <= innerHeight + 2
        : false,
      activeClass: document.activeElement?.className || ''
    };
  });
}

test.describe('R037 结局 EXP 结算与技能树成长入口', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('六视口把本局 EXP、总余额和可解锁机会交接给下一周目', async ({ page }) => {
    await enterEnding(page);
    const matrix = [];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(200);
      const state = await readGrowthState(page);

      if (viewport.id === 'desktop-1440x900' || viewport.id === 'mobile-390x844') {
        await page.screenshot({
          path: path.join(EVIDENCE_DIR, `${viewport.id}-ending-growth.png`)
        });
      }

      const expectedExpGained = PHASE === 'before' ? 3 : 4;
      const expectedTotalExp = PHASE === 'before' ? 5 : 6;
      expect(state.expGained).toBe(expectedExpGained);
      expect(state.totalExp).toBe(expectedTotalExp);
      expect(state.directButtonCount).toBe(3);
      expect(state.actionsWithinViewport).toBe(true);
      if (PHASE === 'before') {
        expect(state.hasGrowthHandoff).toBe(false);
        expect(state.visibleExpText).toEqual([]);
      } else {
        expect(state.hasGrowthHandoff).toBe(true);
        expect(state.growthVisible).toBe(true);
        expect(state.growthWithinViewport).toBe(true);
        expect(state.growthText).toContain('本局 +4 EXP');
        expect(state.growthText).toContain('总计 6 EXP');
        expect(state.growthText).toContain('可解锁');
      }
      matrix.push({ id: viewport.id, state });
    }

    if (PHASE === 'before') {
      await page.locator('.ui-ending-btn-more').click();
      await expect(page.locator('#ui-ending-more-menu')).toBeVisible();
      await expect(page.locator('#ui-ending-more-menu .ui-ending-btn-sub').first())
        .toContainText('技能树 (5 EXP)');
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'ending-growth-matrix.json'),
      `${JSON.stringify({ phase: PHASE, matrix }, null, 2)}\n`,
      'utf8'
    );
  });

  test('成长入口一键打开技能树并把焦点送回结局', async ({ page }) => {
    test.skip(PHASE === 'before', '直接成长入口与焦点闭环只验收改造后的实现');
    await enterEnding(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const growth = page.locator('.ui-ending-growth');
    await growth.click();
    await expect(page.locator('#ui-skill-tree-overlay')).toBeVisible();
    const skill = page.locator('[data-skill-id="survival_instinct"]');
    await expect(skill).toBeFocused();
    await skill.click();
    await page.locator('.skill-tree-confirm-action').click();
    await expect(page.locator('#skill-tree-exp')).toContainText('2 EXP');
    await page.locator('.skill-tree-close').click();
    await expect(page.locator('#ui-skill-tree-overlay')).toHaveCount(0);
    await expect(growth).toBeFocused();
    await expect(growth).toContainText('总计 2 EXP');
    await expect(growth).toContainText('3 项技能可解锁');
  });
});
