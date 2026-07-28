// R94 DEBUG5：抓取在线加载时模块脚本请求的真实请求头（验证 Vary: Origin 理论）
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const scriptReqs = [];
  page.on('request', (r) => {
    if (r.url().includes('/assets/') && r.url().endsWith('.js')) {
      scriptReqs.push({
        url: r.url().slice(-45),
        resourceType: r.resourceType(),
        headers: r.headers(),
      });
    }
  });
  try {
    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(2500);
    console.log(JSON.stringify(scriptReqs, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ err: String(e).slice(0, 300), scriptReqs }, null, 2));
  }
  await browser.close();
})();
