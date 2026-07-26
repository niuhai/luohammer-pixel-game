// R82 诊断3：纯净路径（零键盘）到达天赋屏，测 scrollTop 与命中
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4174/luohammer-pixel-game/';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  // 零键盘：全程 evaluate dispatch click
  await page.evaluate(() => {
    document.querySelector('#rotate-hint-dismiss')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ui-boot-btn')].find(b => /继续游戏|新游戏|开始游戏/.test(b.textContent));
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  // 等星图开场跳过/结束 → 轮询天赋 overlay（不按键，IntroScene 有自动推进吗？没有就 evaluate 点 canvas/对话框）
  for (let i = 0; i < 30; i++) {
    const state = await page.evaluate(() => ({
      talent: !!document.querySelector('.ui-talent-overlay.visible'),
      dialog: !!document.querySelector('#ui-dialog.visible'),
      intro: !!document.querySelector('.ui-intro-overlay.visible'),
    }));
    if (state.talent) break;
    // 模拟用户点击屏幕推进（点击比键盘更接近移动端真实操作）
    await page.evaluate(() => {
      const t = document.querySelector('.ui-intro-overlay.visible') || document.querySelector('#dialog-touch-layer') || document.querySelector('#ui-dialog') || document.body;
      t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(500);
  }
  const got = await page.locator('.ui-talent-overlay.visible').count();
  console.log('到达天赋 overlay:', !!got);
  if (got) {
    await page.waitForTimeout(1800); // 等翻牌动画完全稳定
    const r = await page.evaluate(() => {
      const cont = document.querySelector('.ui-talent-cards');
      const sub = document.querySelector('.ui-talent-subtitle');
      const ov = document.querySelector('.ui-talent-overlay');
      const cards = [...document.querySelectorAll('.ui-talent-card')];
      const subB = sub.getBoundingClientRect();
      return {
        scrollTop: cont.scrollTop,
        overlayScrollTop: ov.scrollTop,
        subtitleRect: { y: Math.round(subB.y), bottom: Math.round(subB.bottom), h: Math.round(subB.height) },
        containerRect: (() => { const b = cont.getBoundingClientRect(); return { y: Math.round(b.y), bottom: Math.round(b.bottom) }; })(),
        cards: cards.map((c, i) => {
          const b = c.getBoundingClientRect();
          const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return { i, y: Math.round(b.y), cy: Math.round(b.y + b.height / 2), hit: el ? (el.className || el.tagName).toString().slice(0, 40) : 'null', ok: el === c || c.contains(el) };
        })
      };
    });
    console.log(JSON.stringify(r, null, 1));
    await page.screenshot({ path: 'shots/r82-diag3-talent-pure.png' });
  }
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
