// R83 定向验证：走马灯跳过时机缺陷（A级疑似软锁）
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
  ],
  _version: 2,
};

async function endingVisible(page) {
  return page.evaluate(() => {
    const ov = document.getElementById('ui-ending-overlay');
    const title = document.getElementById('ui-ending-title');
    const btns = document.querySelectorAll('#ui-ending-buttons .ui-ending-btn, .ui-ending-btn').length;
    const vis = ov && getComputedStyle(ov).display !== 'none' && ov.classList.contains('visible');
    return { overlayVisible: vis, titleText: title ? title.textContent.trim().slice(0, 20) : null, btnCount: btns,
      fbVisible: document.getElementById('ui-ending-flashback')?.classList.contains('visible') };
  });
}

async function run(browser, mode) {
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

  if (mode === 'skip-early') {
    // 继续游戏后 300ms 内立即按空格（模拟评委看到"点击/空格跳过"立即跳过）
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
  } else if (mode === 'skip-late') {
    await page.waitForTimeout(1500); // 第一项已出现后跳过
    await page.keyboard.press('Space');
  }
  // 等待结局出现（自然流程 totalDuration ≈ 800+2*700+1200 = 3400ms）
  await page.waitForTimeout(6000);
  const r = await endingVisible(page);
  await page.screenshot({ path: SHOT(`e-flash-${mode}`) });
  console.log(`[${mode}]`, JSON.stringify(r), 'errors:', errors.length ? errors : 'none');
  await ctx.close();
  return r;
}

(async () => {
  const browser = await chromium.launch();
  await run(browser, 'no-touch');
  await run(browser, 'skip-late');
  await run(browser, 'skip-early');
  await browser.close();
})().catch(e => { console.error('FAIL:', e); process.exit(1); });
