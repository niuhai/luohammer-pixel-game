const { chromium } = require('playwright');
const BASE = 'http://localhost:4176/luohammer-pixel-game/';
const SAVE = {
  currentNode: 'ending_comeback',
  pride: 12, wealth: 28, reputation: 30, trust: 6, pressure: 35, failures: 2,
  flags: [], triggeredEvents: [], talents: [],
  history: [ { nodeId: 'act0_rebel', choiceLabel: '我不念了。', historyChoice: '我不念了…' } ],
  _version: 2,
};
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  const warns = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text().slice(0, 200)); });
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
  await page.locator('.ui-ending-btn').first().waitFor({ state: 'attached', timeout: 20000 });
  await page.waitForTimeout(800);
  await page.locator('button:has-text("更多")').first().click();
  await page.waitForTimeout(400);
  await page.locator('text=分享卡').first().click();
  await page.waitForTimeout(1800);
  const r = await page.evaluate(() => {
    const mask = document.getElementById('share-card-mask');
    if (!mask) return { mask: false };
    const img = mask.querySelector('img');
    return {
      mask: true,
      img: !!img,
      srcHead: img ? img.src.slice(0, 22) : null,
      srcLen: img ? img.src.length : 0,
      imgW: img ? Math.round(img.getBoundingClientRect().width) : 0,
      imgH: img ? Math.round(img.getBoundingClientRect().height) : 0,
      naturalW: img ? img.naturalWidth : 0,
      naturalH: img ? img.naturalHeight : 0,
      tip: mask.textContent.trim().slice(0, 30),
    };
  });
  console.log('分享卡实测:', JSON.stringify(r));
  await page.screenshot({ path: 'shots/r83-share-verify.png' });
  console.log('warns:', warns.length ? warns : 'none');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
