const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-screenshots', 'nobg-verify');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickWhenVisible(page, selector, timeout = 10000) {
  const el = page.locator(selector);
  await el.waitFor({ state: 'visible', timeout });
  await el.click({ force: true });
  return el;
}

(async () => {
  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 400, height: 700 },
    isMobile: true,
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[PAGE ERROR]', msg.text());
  });

  console.log('导航到游戏...');
  await page.goto('http://localhost:5174/');
  await page.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await page.reload();
  await sleep(2000);

  // 处理竖屏提示
  const portraitBtn = page.locator('button', { hasText: '继续竖屏游玩' });
  if (await portraitBtn.isVisible().catch(() => false)) {
    console.log('点击竖屏继续...');
    await portraitBtn.click({ force: true });
    await sleep(500);
  }

  // 点击开始游戏
  console.log('点击开始游戏...');
  await clickWhenVisible(page, '#ui-boot-buttons button:has-text("开始游戏")', 15000);
  await sleep(2000);

  // 跳过开场动画
  const introOverlay = page.locator('#ui-intro-overlay');
  if (await introOverlay.isVisible().catch(() => false)) {
    console.log('跳过开场动画...');
    await sleep(2000);
    await introOverlay.click({ force: true });
    await sleep(1000);
  }

  // 天赋选择 - 选前2个
  console.log('选择天赋...');
  const talentOverlay = page.locator('#ui-talent-overlay');
  await talentOverlay.waitFor({ state: 'visible', timeout: 30000 });
  await sleep(1000);
  const talentCards = page.locator('#ui-talent-cards .ui-talent-card');
  await talentCards.first().waitFor({ state: 'visible', timeout: 10000 });
  await talentCards.nth(0).click();
  await sleep(300);
  await talentCards.nth(1).click();
  await sleep(300);
  const confirmBtn = page.locator('#ui-talent-confirm');
  await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
  await confirmBtn.click({ force: true });
  await sleep(2000);

  // 处理阶段结算
  const settlementContinue = page.locator('#ui-settlement-continue');
  if (await settlementContinue.isVisible().catch(() => false)) {
    console.log('点击继续...');
    await settlementContinue.click({ force: true });
    await sleep(500);
  }

  // 等待游戏主场景加载
  console.log('等待游戏主场景...');
  const chapterEl = page.locator('#ui-chapter');
  await chapterEl.waitFor({ state: 'visible', timeout: 20000 });
  await sleep(1500);

  // 截图1: 初始场景(young角色)
  console.log('截图1: 初始场景...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-young.png'), fullPage: false });
  await sleep(1000);

  // 点击对话框继续/选项
  async function advanceDialog() {
    const dialog = page.locator('#ui-dialog.visible');
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.click({ force: true });
      await sleep(800);
      return true;
    }
    const firstChoice = page.locator('#ui-choices .ui-choice-btn').first();
    if (await firstChoice.isVisible().catch(() => false)) {
      await firstChoice.click({ force: true });
      await sleep(1500);
      return true;
    }
    return false;
  }

  // 推进剧情，截图多个关键节点
  for (let i = 0; i < 30; i++) {
    const advanced = await advanceDialog();
    if (!advanced) {
      await page.mouse.click(200, 500);
      await sleep(800);
    }
    // 每5步截图一次
    if (i % 5 === 4) {
      const idx = Math.floor(i / 5) + 2;
      console.log(`截图${idx}: 剧情推进中...`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `0${idx}-step-${i}.png`), fullPage: false });
    }
    await sleep(300);
  }

  console.log('截图完成! 保存在:', SCREENSHOT_DIR);
  await browser.close();
})();
