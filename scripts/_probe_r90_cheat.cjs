// R90：线上 cheat 面专项探针——window.game 在生产必须为 undefined，本地必须为对象
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const result = { online: null, local: null, consoleErrs: [] };

  // 1. 线上生产环境
  const page1 = await browser.newPage({ viewport: { width: 375, height: 812 } });
  page1.on('pageerror', (e) => result.consoleErrs.push('ONLINE PAGEERROR: ' + String(e).slice(0, 120)));
  try {
    await page1.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 45000 });
    await page1.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    result.online = await page1.evaluate(() => ({
      hostname: location.hostname,
      gameType: typeof window.game,
      bootVisible: !!document.getElementById('ui-boot-overlay'),
    }));
  } catch (e) { result.online = { err: String(e).slice(0, 200) }; }
  await page1.close();

  // 2. 本地 preview 对照（须先 npm run preview 或改用 file 协议不可行——跳过本地若无服务）
  try {
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 8000 });
    result.local = await page2.evaluate(() => ({
      hostname: location.hostname,
      gameType: typeof window.game,
    }));
    await page2.close();
  } catch (e) { result.local = { skipped: 'preview not running', detail: String(e).slice(0, 80) }; }

  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  const ok = result.online && result.online.gameType === 'undefined' && result.consoleErrs.length === 0;
  process.exit(ok ? 0 : 1);
})();
