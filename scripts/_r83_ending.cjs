// R83 补查：结局全链路（走马灯 → 结局屏 → AI复盘 → 分享卡）
const { chromium } = require('playwright');
const BASE = 'http://localhost:4176/luohammer-pixel-game/';
const SHOT = (n) => `shots/r83-${n}.png`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });

  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    const state = {
      currentNode: 'ending_comeback',
      pride: 12, wealth: 28, reputation: 30, trust: 6, pressure: 35, failures: 2,
      flags: ['killer_600m_seen'], triggeredEvents: [], talents: ['smooth_talker'],
      history: [
        { node: 'act0_start', choice: '退学闯荡', attrs: { pride: 2 } },
        { node: 'act3_live', choice: '首播带货', attrs: { wealth: 5 } },
      ],
      _version: 2,
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_auto_meta', JSON.stringify({ timestamp: Date.now() }));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const rotateBtn = page.locator('#rotate-hint-dismiss');
  if (await rotateBtn.isVisible().catch(() => false)) await rotateBtn.click().catch(() => {});

  await page.locator('.ui-boot-btn:has-text("继续游戏")').first().click();
  const t0 = Date.now();

  // 走马灯推进：循环点击/空格直到结局按钮出现
  let flashShots = 0;
  let endingReady = false;
  for (let i = 0; i < 30; i++) {
    const endingBtns = await page.locator('.ui-ending-btn').count();
    if (endingBtns > 0) { endingReady = true; break; }
    if (i === 2 || i === 6) { await page.screenshot({ path: SHOT(`e-flashback-${i}`) }); flashShots++; }
    await page.keyboard.press('Space');
    await page.mouse.click(195, 400).catch(() => {});
    await page.waitForTimeout(500);
  }
  console.log('走马灯→结局耗时 ms:', Date.now() - t0, ' endingReady:', endingReady);
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOT('e-01-ending') });

  // 结局 DOM 结构探测
  const dom = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].filter(el => /ending|share|review/i.test(el.id)).map(el => el.id);
    const clss = [...document.querySelectorAll('[class]')].map(el => el.className).filter(c => typeof c === 'string' && /ending|share|review/i.test(c)).slice(0, 20);
    const btns = [...document.querySelectorAll('button')].map(b => b.textContent.trim().slice(0, 16)).filter(t => t);
    return { ids, clss, btns };
  });
  console.log('DOM ids:', JSON.stringify(dom.ids));
  console.log('DOM clss:', JSON.stringify(dom.clss));
  console.log('DOM btns:', JSON.stringify(dom.btns));

  // AI 复盘
  const aiBtn = page.locator('button:has-text("AI 人生复盘")').first();
  if (await aiBtn.count()) {
    const tAi = Date.now();
    await aiBtn.click();
    await page.waitForTimeout(2200);
    console.log('AI复盘打开 ms:', Date.now() - tAi);
    await page.screenshot({ path: SHOT('e-02-ai-review') });
    const aiDom = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[id],[class]')].filter(el => /ai-review|aireview/i.test((el.id || '') + ' ' + (el.className || '')));
      return els.slice(0, 8).map(el => ({ id: el.id, cls: (el.className || '').toString().slice(0, 60), text: el.textContent.trim().slice(0, 40) }));
    });
    console.log('AI DOM:', JSON.stringify(aiDom));
    const closeAi = page.locator('button:has-text("关闭"), .ui-ai-review-close, [class*="ai-review"] button').last();
    if (await closeAi.count()) await closeAi.click().catch(() => {});
    await page.waitForTimeout(400);
  } else {
    console.log('!! 未找到 AI 复盘按钮');
  }

  // 更多 → 分享卡
  const moreBtn = page.locator('button:has-text("更多")').first();
  if (await moreBtn.count()) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOT('e-03-more') });
    const shareItem = page.locator('text=分享卡').first();
    if (await shareItem.count()) {
      await shareItem.click();
      await page.waitForTimeout(1400);
      await page.screenshot({ path: SHOT('e-04-share') });
      const shareInfo = await page.evaluate(() => {
        const mask = document.querySelector('#share-card-mask');
        const cvs = mask ? mask.querySelector('canvas') : null;
        const btns = mask ? [...mask.querySelectorAll('button')].map(b => b.textContent.trim().slice(0, 12)) : [];
        return { mask: !!mask, canvas: !!cvs, size: cvs ? `${cvs.width}x${cvs.height}` : null, btns };
      });
      console.log('分享卡:', JSON.stringify(shareInfo));
    } else console.log('!! 更多菜单无分享卡项');
  } else console.log('!! 未找到更多按钮');

  console.log('\nERRORS:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
