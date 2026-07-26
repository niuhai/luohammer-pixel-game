// R82 诊断：812x375 横屏属性面板溢出 + 390x844 竖屏死区 实测
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4174/luohammer-pixel-game/';

async function enterGame(page) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  // 竖屏提示条：若出现则点"横屏继续/竖屏继续"关掉，避免干扰
  const rotateBtn = page.locator('#rotate-hint-dismiss');
  if (await rotateBtn.isVisible().catch(() => false)) await rotateBtn.click().catch(() => {});
  // 标题屏：继续游戏 / 新游戏 / 开始游戏 任一
  const startBtn = page.locator('.ui-boot-btn:has-text("继续游戏"), .ui-boot-btn:has-text("新游戏"), .ui-boot-btn:has-text("开始游戏")').first();
  await startBtn.waitFor({ state: 'visible', timeout: 10000 });
  await startBtn.click();
  // 星图开场：空格推进直到天赋 overlay 或对话框出现
  for (let i = 0; i < 20; i++) {
    const talentVisible = await page.locator('.ui-talent-overlay.visible').count();
    const dialogVisible = await page.locator('#ui-dialog.visible').count();
    if (talentVisible || dialogVisible) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
  }
  // 天赋选择：选前两张卡，确认
  const talentOverlay = page.locator('.ui-talent-overlay.visible');
  if (await talentOverlay.count()) {
    const cards = page.locator('.ui-talent-card');
    await cards.nth(0).click();
    await cards.nth(1).click();
    const confirm = page.locator('.ui-talent-confirm, button:has-text("出发"), button:has-text("确认")').first();
    await confirm.click();
  }
  // 推进到对话框可见且属性面板可见
  for (let i = 0; i < 12; i++) {
    const statsVisible = await page.locator('.ui-stats.visible').count();
    if (statsVisible) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(600);
}

async function measure(page, label) {
  const data = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) };
    };
    const items = [...document.querySelectorAll('.ui-stat-item')].map(el => {
      const b = el.getBoundingClientRect();
      return { text: el.textContent.trim().slice(0, 12), right: Math.round(b.right), w: Math.round(b.width) };
    });
    return {
      innerW: window.innerWidth, innerH: window.innerHeight,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      bodyScrollW: document.body.scrollWidth,
      stats: r('.ui-stats'),
      statItems: items,
      toggleHint: r('.ui-stats-toggle-hint'),
      canvas: r('canvas'),
      dialog: r('#ui-dialog'),
      dialogAuto: r('#ui-dialog-auto'),
      dialogContinue: r('#ui-dialog-continue'),
      soundBtn: r('.ui-sound-toggle'),
      menuBtn: r('.ui-menu-toggle'),
    };
  });
  console.log(`\n=== ${label} (${data.innerW}x${data.innerH}) ===`);
  console.log(`scrollW=${data.scrollW} clientW=${data.clientW} bodyScrollW=${data.bodyScrollW} ${data.scrollW > data.clientW ? '!!水平溢出!!' : '无水平溢出'}`);
  console.log('canvas:', JSON.stringify(data.canvas));
  console.log('stats:', JSON.stringify(data.stats), data.stats && data.stats.right > data.innerW ? `!!越界 right=${data.stats.right} > ${data.innerW}` : '');
  console.log('statItems:', JSON.stringify(data.statItems));
  console.log('toggleHint:', JSON.stringify(data.toggleHint), data.toggleHint && data.toggleHint.right > data.innerW ? '!!越界' : '');
  console.log('dialog:', JSON.stringify(data.dialog));
  console.log('dialogAuto:', JSON.stringify(data.dialogAuto), data.dialogAuto && data.dialogAuto.right > data.innerW ? '!!越界' : '');
  console.log('dialogContinue:', JSON.stringify(data.dialogContinue));
  console.log('soundBtn:', JSON.stringify(data.soundBtn), ' menuBtn:', JSON.stringify(data.menuBtn));
  return data;
}

(async () => {
  const browser = await chromium.launch();
  // 横屏 812x375（手机横持，官方推荐形态）
  const ctxL = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pageL = await ctxL.newPage();
  await enterGame(pageL);
  await measure(pageL, 'LANDSCAPE 812x375');
  await pageL.screenshot({ path: 'shots/r82-diag-landscape.png' });
  await ctxL.close();

  // 竖屏 390x844
  const ctxP = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pageP = await ctxP.newPage();
  await enterGame(pageP);
  await measure(pageP, 'PORTRAIT 390x844');
  await pageP.screenshot({ path: 'shots/r82-diag-portrait.png' });
  await ctxP.close();

  await browser.close();
  console.log('\n诊断完成，截图: shots/r82-diag-landscape.png / shots/r82-diag-portrait.png');
})().catch(e => { console.error('DIAG FAIL:', e.message); process.exit(1); });
