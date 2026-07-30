// 复赛帖 4 截图位重采：基于当前 build（vite preview :4173），1280x720
// 输出到 demo-footage/screenshots/ 与根仓 帖子截图包/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4173/luohammer-pixel-game/';
const OUT1 = path.resolve('demo-footage/screenshots');
const OUT2 = path.resolve('../帖子截图包');
fs.mkdirSync(OUT1, { recursive: true });
fs.mkdirSync(OUT2, { recursive: true });

const SAVE = (node, over = {}) => {
  const state = {
    pride: 6, wealth: 3, reputation: 6, failures: 2, pressure: 5, trust: 5,
    pressureMax: 10, failurePenalty: 1, successBonus: 1,
    talentSpecials: [], currentStageId: 'youth', currentNode: node,
    flags: [], triggeredEvents: [], history: [], achievements: [],
    gameStartTime: Date.now() - 180000, ...over
  };
  return `localStorage.clear();
    localStorage.setItem('luohammer_kbd_hint_shown', '1'); // 截图物料不出现键盘提示 toast
    localStorage.setItem('luohammer_save', JSON.stringify(${JSON.stringify(state)}));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(${JSON.stringify(state)}));`;
};

async function withPage(fn) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  try { await fn(page); } catch (e) { console.log('WARN:', e.message.split('\n')[0]); }
  await browser.close();
}

async function shot(page, name1, name2) {
  await page.screenshot({ path: path.join(OUT1, name1) });
  await page.screenshot({ path: path.join(OUT2, name2) });
  console.log('shot:', name1, '/', name2);
}

(async () => {
  // 位1：标题画面（stagger 入场完成后 + 金句打字机）
  await withPage(async (page) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.mouse.move(640, 400);
    await page.waitForTimeout(6000);
    await shot(page, 'title-desktop.png', '截图位1-标题画面.png');
  });

  // 位2：天赋抽取（5 选 2，翻牌入场完成后）
  await withPage(async (page) => {
    await page.goto(BASE);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('luohammer_kbd_hint_shown', '1'); });
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
    const intro = page.locator('#ui-intro-overlay');
    await page.waitForTimeout(2500);
    if (await intro.isVisible().catch(() => false)) await intro.click({ force: true });
    await page.locator('#ui-talent-overlay').waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(2500); // 翻牌入场 + 稀有度光晕
    const cards = page.locator('#ui-talent-cards .ui-talent-card');
    await cards.nth(0).hover().catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'talent-desktop.png', '截图位2-天赋抽取.png');
  });

  // 位3：剧情选择（含 R026-R039 决策因果链 UI）
  await withPage(async (page) => {
    await page.goto(BASE);
    await page.evaluate(SAVE('act0_dad', { pride: 4, wealth: 3, reputation: 3 }));
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
    await page.locator('#ui-dialog.visible').waitFor({ timeout: 20000 });
    for (let i = 0; i < 20; i++) {
      if (await page.locator('#ui-choices .ui-choice-btn').first().isVisible().catch(() => false)) break;
      await page.locator('#ui-dialog').click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1800);
    const c = page.locator('#ui-choices .ui-choice-btn').first();
    if (await c.isVisible().catch(() => false)) { await c.hover(); await page.waitForTimeout(700); }
    await shot(page, 'choice-desktop.png', '截图位3-剧情选择.png');
  });

  // 位4：杀手时刻 6 亿（等数字落地 + AI 点评 scrim 同框；轮询选择器而非固定时刻表）
  await withPage(async (page) => {
    await page.goto(BASE);
    await page.evaluate(SAVE('act6_night', { pride: 6, wealth: 1, reputation: 6, failures: 3, pressure: 7, trust: 4, currentStageId: 'act6' }));
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
    // 数字元素出现（落地动画 0.4s）→ 等落地+反弹+AI点评 scrim 出现
    await page.waitForSelector('.ui-killer-moment-number', { timeout: 15000 });
    await page.waitForTimeout(1800); // 落地(0.4s)+反弹+波纹+点评 scrim(1.5s)同框
    await shot(page, 'killer-desktop.png', '截图位4-杀手时刻6亿.png');
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT1, 'killer-frame-b.png') }); // 备选：点评完整、数字将淡出前
  });

  console.log('ALL SHOTS DONE');
})();
