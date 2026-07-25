// 验证：杀手时刻 scrim + 锁定选项提示折行
const { chromium } = require('playwright');
const OUT = 'test-screenshots/r22-review';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));

  // === A. 杀手时刻 scrim（直播场景验证——之前文字压环形灯） ===
  await page.goto('http://localhost:5173/luohammer-pixel-game/');
  await page.evaluate(() => {
    localStorage.clear();
    const state = {
      pride: 6, wealth: 1, reputation: 6, failures: 3, pressure: 7, trust: 4,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'act6', currentNode: 'act6_night',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 300000
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
  });
  await page.reload();
  const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  // AI 洞察在闷响后 ~1.5s 出现，5s 后淡出——抓峰值
  await page.waitForTimeout(5200);
  await page.screenshot({ path: `${OUT}/r13-killer-scrim.png` });

  // === B. 锁定选项提示折行 ===
  await page.evaluate(() => {
    const state = {
      pride: 10, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'youth', currentNode: 'intro',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 60000
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
  });
  await page.reload();
  const btn2 = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await btn2.waitFor({ state: 'visible', timeout: 15000 });
  await btn2.click();
  await page.locator('#ui-dialog.visible').waitFor({ timeout: 20000 });
  for (let i = 0; i < 16; i++) {
    if (await page.locator('#ui-choices .ui-choice-btn').first().isVisible().catch(() => false)) break;
    await page.locator('#ui-dialog').click({ force: true }).catch(() => {});
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/r14-lock-hint-wrap.png` });
  console.log('DONE');
  await browser.close();
})();
