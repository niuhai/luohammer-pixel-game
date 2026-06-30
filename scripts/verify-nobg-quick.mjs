import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.join(path.resolve(), 'test-screenshots', 'nobg-verify-quick');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('启动浏览器...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 900, height: 600 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[console] ' + msg.text());
  });
  page.on('pageerror', err => errors.push('[pageerror] ' + err.message));

  console.log('导航到 http://localhost:5174/ ...');
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(4000);

  // 按ESC关闭任何弹窗/帮助面板
  await page.keyboard.press('Escape');
  await sleep(500);

  // 检查标题页
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-title.png'), fullPage: false });
  console.log('截图00: 标题页');

  // 点击"新游戏"或"开始游戏"按钮
  let startBtn = page.locator('#ui-boot-buttons button').filter({ hasText: '新游戏' });
  if (await startBtn.count() === 0) {
    startBtn = page.locator('#ui-boot-buttons button').filter({ hasText: '开始游戏' });
  }
  await startBtn.waitFor({ state: 'visible', timeout: 15000 });
  await startBtn.click({ force: true });
  console.log('点击开始/新游戏');
  await sleep(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-after-start.png'), fullPage: false });

  // 跳过开场 - 点击任意位置或按Space
  await page.keyboard.press('Space');
  await sleep(500);
  await page.mouse.click(450, 300);
  await sleep(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-after-intro.png'), fullPage: false });
  console.log('截图02: 开场后');

  // 按ESC处理可能的弹窗
  await page.keyboard.press('Escape');
  await sleep(500);

  // 天赋选择
  const talentOverlay = page.locator('#ui-talent-overlay');
  try {
    await talentOverlay.waitFor({ state: 'visible', timeout: 20000 });
    console.log('天赋选择界面可见');
  } catch (e) {
    // 可能已经跳过了，直接截图看
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-no-talent.png'), fullPage: false });
    console.log('等待天赋界面超时，保存debug截图');
    // 尝试按Space继续
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Space');
      await sleep(800);
    }
  }
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-talent.png'), fullPage: false });
  console.log('截图03: 天赋选择');
  
  // 选天赋
  const cards = page.locator('#ui-talent-cards .ui-talent-card');
  const cardCount = await cards.count();
  console.log('天赋卡片数量:', cardCount);
  if (cardCount > 0) {
    await cards.first().waitFor({ state: 'visible', timeout: 5000 });
    await cards.nth(0).click();
    await sleep(300);
    if (cardCount > 1) await cards.nth(1).click();
    await sleep(300);
    const confirmBtn = page.locator('#ui-talent-confirm');
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click({ force: true });
      console.log('点击确认天赋');
    }
  }
  await sleep(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-after-talent.png'), fullPage: false });

  // 处理各种弹窗
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Space');
    await page.mouse.click(450, 400);
    await sleep(800);
  }
  await sleep(1000);

  // 等待游戏主场景
  const chapter = page.locator('#ui-chapter');
  try {
    await chapter.waitFor({ state: 'visible', timeout: 15000 });
    console.log('游戏章节可见');
  } catch (e) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug-no-chapter.png'), fullPage: false });
    console.log('等待章节超时');
  }
  await sleep(2000);

  // 游戏主场景截图 (young角色)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-game-young.png'), fullPage: false });
  console.log('截图05: 游戏场景(young)');

  // 推进对话
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Space');
    await sleep(400);
    await page.mouse.click(450, 400);
    await sleep(400);
  }
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-game-progress.png'), fullPage: false });
  console.log('截图06: 剧情推进后');

  // 再推进一些
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Space');
    await sleep(400);
    await page.mouse.click(450, 400);
    await sleep(400);
  }
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-game-more.png'), fullPage: false });
  console.log('截图07: 更多剧情后');

  console.log('\n=== 截图完成 ===');
  console.log('保存目录:', SCREENSHOT_DIR);
  if (errors.length > 0) {
    console.log('\n页面错误:');
    errors.forEach(e => console.log('  ', e));
  } else {
    console.log('无页面错误!');
  }

  await browser.close();
})();
