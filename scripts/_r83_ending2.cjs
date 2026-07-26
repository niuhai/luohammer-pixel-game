// R83 补查：结局屏自然流程（不跳过走马灯）→ AI复盘 → 分享卡，竖屏+横屏
const { chromium } = require('playwright');
const BASE = 'http://localhost:4176/luohammer-pixel-game/';
const SHOT = (n) => `shots/r83-${n}.png`;

const SAVE = {
  currentNode: 'ending_comeback',
  pride: 12, wealth: 28, reputation: 30, trust: 6, pressure: 35, failures: 2,
  flags: [], triggeredEvents: [], talents: [],
  history: [
    { nodeId: 'act0_rebel', choiceLabel: '我不念了。这破书念不下去，我自己教育自己。', historyChoice: '我不念了…' },
    { nodeId: 'act3_live_first', choiceLabel: '首播就压上全部身家。', historyChoice: '首播就压上…' },
    { nodeId: 'act5_debt', choiceLabel: '六个亿，我一分不少地还。', historyChoice: '六个亿…' },
  ],
  _version: 2,
};

async function walk(browser, vp, tag) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate((s) => {
    localStorage.setItem('luohammer_save', JSON.stringify(s));
    localStorage.setItem('luohammer_auto_meta', JSON.stringify({ timestamp: Date.now() }));
  }, SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1100);
  const rb = page.locator('#rotate-hint-dismiss');
  if (await rb.isVisible().catch(() => false)) await rb.click().catch(() => {});
  await page.locator('.ui-boot-btn:has-text("继续游戏")').first().click();

  // 不跳过，自然等走马灯播完 → 结局按钮出现
  const t0 = Date.now();
  await page.locator('.ui-ending-btn').first().waitFor({ state: 'attached', timeout: 20000 });
  console.log(`[${tag}] 走马灯自然播完→结局按钮出现: ${Date.now() - t0}ms`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT(`${tag}-ending`) });

  const layout = await page.evaluate(() => {
    const r = (id) => { const el = document.getElementById(id); if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { y: Math.round(b.y), h: Math.round(b.height), fs: cs.fontSize, lh: cs.lineHeight, color: cs.color }; };
    const btns = [...document.querySelectorAll('.ui-ending-btn')].map(el => { const b = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 10), w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.y) }; });
    const content = document.querySelector('.ui-ending-content');
    return {
      title: r('ui-ending-title'), quote: r('ui-ending-quote'), desc: r('ui-ending-desc'),
      contentScroll: content ? { sh: content.scrollHeight, ch: content.clientHeight, overflowY: getComputedStyle(content).overflowY } : null,
      innerH: window.innerHeight, btnCount: btns.length, btns: btns.slice(0, 12),
    };
  });
  console.log(`[${tag}] ending layout:`, JSON.stringify(layout));

  // AI 复盘
  const aiBtn = page.locator('button:has-text("AI 人生复盘")').first();
  if (await aiBtn.count()) {
    const tAi = Date.now();
    await aiBtn.click();
    await page.waitForTimeout(2500);
    console.log(`[${tag}] AI复盘打开: ${Date.now() - tAi}ms`);
    await page.screenshot({ path: SHOT(`${tag}-ai-review`) });
    const aiInfo = await page.evaluate(() => {
      const ov = [...document.querySelectorAll('div')].find(el => /ai-review/i.test(el.className || '') && el.offsetHeight > 100);
      if (!ov) return { found: false };
      const b = ov.getBoundingClientRect();
      return { found: true, w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.y), textLen: ov.textContent.trim().length, scrollable: ov.scrollHeight > ov.clientHeight };
    });
    console.log(`[${tag}] AI overlay:`, JSON.stringify(aiInfo));
    // 关闭
    const closeBtn = page.locator('[class*="ai-review"] button:has-text("关闭"), [class*="ai-review"] .ui-ai-close, [class*="ai-review"] button').last();
    if (await closeBtn.count()) await closeBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  } else console.log(`[${tag}] !! 无 AI 复盘按钮`);

  // 更多 → 分享卡
  const moreBtn = page.locator('button:has-text("更多")').first();
  if (await moreBtn.count()) {
    await moreBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: SHOT(`${tag}-more`) });
    const shareItem = page.locator('text=分享卡').first();
    if (await shareItem.count()) {
      await shareItem.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: SHOT(`${tag}-share`) });
      const si = await page.evaluate(() => {
        const mask = document.getElementById('share-card-mask');
        const cvs = mask ? mask.querySelector('canvas') : null;
        const btns = mask ? [...mask.querySelectorAll('button')].map(b => b.textContent.trim().slice(0, 10)) : [];
        return { mask: !!mask, canvas: cvs ? `${cvs.width}x${cvs.height}` : null, btns };
      });
      console.log(`[${tag}] 分享卡:`, JSON.stringify(si));
    } else console.log(`[${tag}] !! 更多菜单无分享卡`);
  } else console.log(`[${tag}] !! 无更多按钮`);

  console.log(`[${tag}] ERRORS:`, errors.length ? errors : 'none');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await walk(browser, { width: 390, height: 844 }, 'e2p');
  await walk(browser, { width: 812, height: 375 }, 'e2l');
  await browser.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
