import { expect, test } from '@playwright/test';

test.setTimeout(90_000);

const ENDING_STATE = {
  pride: 6,
  wealth: 5,
  reputation: 5,
  failures: 2,
  pressure: 3,
  trust: 5,
  pressureMax: 10,
  failurePenalty: 1,
  successBonus: 1,
  talentSpecials: [],
  currentStageId: 'youth',
  currentNode: 'ending_scholar',
  flags: [],
  triggeredEvents: [],
  history: [],
  achievements: [],
  gameStartTime: Date.now() - 60_000
};

test('结局后的再来一次应清理本局并开启有差异的下一周目', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(state => {
    localStorage.clear();
    localStorage.setItem('luohammer_play_count', '1');
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    localStorage.setItem('luohammer_meta_progress', JSON.stringify({
      exp: 0,
      unlockedSkills: [],
      seenEndings: [],
      playCount: 1,
      totalChoices: 0,
      seenEvents: [],
      achievementScore: 0,
      claimedMilestones: [],
      claimedAchievementMilestones: [],
      titles: []
    }));
  }, ENDING_STATE);
  await page.reload();

  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }).click();
  await page.locator('#ui-ending-overlay').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('#ui-ending-title')).not.toBeEmpty({ timeout: 15_000 });

  const retry = page.locator('.ui-ending-btn-secondary');
  await expect(retry).toBeVisible();
  await retry.click();

  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15_000 });
  await expect(page.locator('#ui-boot-buttons button', { hasText: '开始游戏' })).toBeVisible();
  const afterRetry = await page.evaluate(() => ({
    save: localStorage.getItem('luohammer_save'),
    backup: localStorage.getItem('luohammer_save_backup'),
    meta: JSON.parse(localStorage.getItem('luohammer_meta_progress') || '{}')
  }));
  expect(afterRetry.save).toBeNull();
  expect(afterRetry.backup).toBeNull();
  expect(afterRetry.meta.seenEndings).toContain('scholar');

  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
  // 回访局会按设计跳过已看过的序章，直接把玩家交给新的天赋组合。
  await page.locator('#ui-talent-overlay').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#ui-talent-cards .ui-talent-card.is-revealed').first()
    .waitFor({ state: 'visible', timeout: 15_000 });

  const talentIds = await page.locator('#ui-talent-cards .ui-talent-card')
    .evaluateAll(cards => cards.map(card => card.dataset.talentId));
  expect(talentIds).toContain('time_traveler');
});
