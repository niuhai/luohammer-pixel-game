// 验证 6 亿杀手时刻 + 结局加载耗时测量
const { chromium } = require('playwright');
const OUT = 'test-screenshots/r22-review';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));

  // === 1. 6 亿杀手时刻 ===
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
  // 杀手时刻动画期间连续截图
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/r11-killer-1.png` });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/r11-killer-2.png` });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/r11-killer-3.png` });

  // === 2. 结局加载耗时 ===
  await page.evaluate(() => {
    const state = {
      pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
      pressureMax: 10, failurePenalty: 1, successBonus: 1,
      talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
      flags: [], triggeredEvents: [], history: [], achievements: [],
      gameStartTime: Date.now() - 60000
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
  });
  await page.reload();
  const btn2 = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await btn2.waitFor({ state: 'visible', timeout: 15000 });
  const t0 = Date.now();
  await btn2.click();
  await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
  console.log('结局加载耗时(点击继续→结局可见):', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/r12-ending.png` });

  await browser.close();
})();
