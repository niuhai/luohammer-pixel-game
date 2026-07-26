// R82 诊断2：竖屏天赋卡命中遮挡 + 横屏对话框 AUTO 按钮 实测
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4174/luohammer-pixel-game/';

async function toTalent(page) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const rotateBtn = page.locator('#rotate-hint-dismiss');
  if (await rotateBtn.isVisible().catch(() => false)) await rotateBtn.click().catch(() => {});
  const startBtn = page.locator('.ui-boot-btn:has-text("继续游戏"), .ui-boot-btn:has-text("新游戏"), .ui-boot-btn:has-text("开始游戏")').first();
  await startBtn.waitFor({ state: 'visible', timeout: 10000 });
  await startBtn.click();
  for (let i = 0; i < 20; i++) {
    if (await page.locator('.ui-talent-overlay.visible').count()) return true;
    if (await page.locator('#ui-dialog.visible').count()) return false;
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
  }
  return false;
}

async function hitTestTalent(page, label) {
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ui-talent-card')];
    return cards.map((card, i) => {
      const b = card.getBoundingClientRect();
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const el = document.elementFromPoint(cx, cy);
      return {
        i, cx: Math.round(cx), cy: Math.round(cy),
        cardClass: card.className,
        hit: el ? (el.className || el.tagName).toString().slice(0, 60) : 'null',
        hitIsCard: el === card || card.contains(el),
        cardRect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
      };
    });
  });
  console.log(`\n=== ${label} 天赋卡命中测试 ===`);
  r.forEach(x => console.log(JSON.stringify(x)));
  return r;
}

async function measureDialog(page, label) {
  // 空格推进至对话框可见
  for (let i = 0; i < 14; i++) {
    if (await page.locator('#ui-dialog.visible').count()) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) };
    };
    return {
      innerW: window.innerWidth, innerH: window.innerHeight,
      dialog: r('#ui-dialog'), auto: r('#ui-dialog-auto'), cont: r('#ui-dialog-continue'),
      name: r('#ui-dialog-name'),
      autoVisible: !!document.querySelector('#ui-dialog-auto')?.offsetParent,
      autoText: document.querySelector('#ui-dialog-auto')?.textContent?.trim(),
    };
  });
  console.log(`\n=== ${label} 对话框实测 (${data.innerW}x${data.innerH}) ===`);
  console.log('dialog:', JSON.stringify(data.dialog));
  console.log('auto:', JSON.stringify(data.auto), 'visible=', data.autoVisible, 'text=', data.autoText, data.auto && data.auto.right > data.innerW ? '!!AUTO越界' : '');
  console.log('continue:', JSON.stringify(data.cont));
  return data;
}

(async () => {
  const browser = await chromium.launch();

  // 竖屏 390x844：天赋卡命中
  const ctxP = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pageP = await ctxP.newPage();
  const gotTalentP = await toTalent(pageP);
  console.log('竖屏进入天赋 overlay:', gotTalentP);
  if (gotTalentP) {
    await pageP.waitForTimeout(1500); // 等入场动画稳定
    await hitTestTalent(pageP, 'PORTRAIT 390x844');
    await pageP.screenshot({ path: 'shots/r82-diag2-talent-portrait.png' });
  }
  await ctxP.close();

  // 横屏 812x375：对话框 AUTO
  const ctxL = await browser.newContext({ viewport: { width: 812, height: 375 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pageL = await ctxL.newPage();
  const gotTalentL = await toTalent(pageL);
  if (gotTalentL) {
    // evaluate 直派 click 绕过遮挡选 2 卡并确认
    await pageL.evaluate(() => {
      const cards = document.querySelectorAll('.ui-talent-card');
      cards[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      cards[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await pageL.waitForTimeout(300);
    await pageL.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /出发|确认/.test(b.textContent));
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
  await measureDialog(pageL, 'LANDSCAPE 812x375');
  await pageL.screenshot({ path: 'shots/r82-diag2-dialog-landscape.png' });
  await ctxL.close();

  // 桌面 1440x900 对照
  const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageD = await ctxD.newPage();
  const gotTalentD = await toTalent(pageD);
  console.log('桌面进入天赋 overlay:', gotTalentD);
  if (gotTalentD) {
    await pageD.waitForTimeout(1500);
    await hitTestTalent(pageD, 'DESKTOP 1440x900');
  }
  await ctxD.close();

  await browser.close();
  console.log('\n诊断2完成');
})().catch(e => { console.error('DIAG2 FAIL:', e.message); process.exit(1); });
