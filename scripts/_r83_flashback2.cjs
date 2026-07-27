// R83 定向验证2：等走马灯 visible 后立刻跳过（落在 <800ms 窗口内）
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4174/luohammer-pixel-game/';
const SHOT = (n) => `shots/r83-${n}.png`;

const SAVE = {
  currentNode: 'ending_comeback',
  pride: 12, wealth: 28, reputation: 30, trust: 6, pressure: 35, failures: 2,
  flags: [], triggeredEvents: [], talents: [],
  history: [
    { nodeId: 'act0_rebel', choiceLabel: '我不念了。这破书念不下去，我自己教育自己。', historyChoice: '我不念了…' },
    { nodeId: 'act3_live_first', choiceLabel: '首播就压上全部身家。', historyChoice: '首播就压上…' },
  ],
  _version: 2,
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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

  // 等走马灯出现，立刻点击跳过（模拟评委见"点击/空格跳过"提示即点）
  await page.locator('#ui-ending-flashback.visible').waitFor({ state: 'attached', timeout: 8000 });
  await page.screenshot({ path: SHOT('e-flash2-before-skip') });
  await page.mouse.click(195, 500); // 落在走马灯 overlay 上
  const tSkip = Date.now();

  // 观察 8s：结局是否出现
  await page.waitForTimeout(8000);
  const r = await page.evaluate(() => {
    const ov = document.getElementById('ui-ending-overlay');
    const fb = document.getElementById('ui-ending-flashback');
    const fbc = document.getElementById('ui-ending-flashback-choices');
    return {
      overlayVisible: ov ? ov.classList.contains('visible') : null,
      fbVisible: fb ? fb.classList.contains('visible') : null,
      fbChildren: fbc ? fbc.children.length : null,
      btns: document.querySelectorAll('.ui-ending-btn').length,
      bodyHint: document.getElementById('ui-ending-flashback-hint')?.textContent || null,
    };
  });
  console.log('跳过时刻起 8s 后状态:', JSON.stringify(r), ' errors:', errors.length ? errors : 'none');
  await page.screenshot({ path: SHOT('e-flash2-stuck') });

  // 尝试再用空格/点击自救
  await page.keyboard.press('Space');
  await page.mouse.click(195, 500);
  await page.waitForTimeout(2500);
  const r2 = await page.evaluate(() => ({
    overlayVisible: document.getElementById('ui-ending-overlay')?.classList.contains('visible'),
    btns: document.querySelectorAll('.ui-ending-btn').length,
  }));
  console.log('自救后再检查:', JSON.stringify(r2));
  await page.screenshot({ path: SHOT('e-flash2-after-rescue') });
  await browser.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
