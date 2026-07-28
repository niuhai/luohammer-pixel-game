// R94 DEBUG3：cache.match 为何对脚本请求失手——Vary/请求模式实证
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(5000);

    const probe = await page.evaluate(async () => {
      const cache = await caches.open('luohammer-v9-prod');
      const url = '/luohammer-pixel-game/assets/index-BWKIcCg8.js';
      const abs = location.origin + url;
      const out = {};
      out.matchRel = !!(await cache.match(url));
      out.matchAbs = !!(await cache.match(abs));
      out.matchDot = !!(await cache.match('./assets/index-BWKIcCg8.js'));
      // 缓存键原始形式
      const keys = await cache.keys();
      const jsKey = keys.find((r) => r.url.includes('index-BWKIcCg8'));
      out.keyUrl = jsKey ? jsKey.url : null;
      out.keyMode = jsKey ? jsKey.mode : null;
      if (jsKey) {
        const resp = await cache.match(jsKey);
        out.respHeaders = {};
        resp.headers.forEach((v, k) => { out.respHeaders[k] = v; });
        // 用页面脚本同款请求试匹配
        const scriptReq = new Request(abs, { mode: 'cors', credentials: 'same-origin', destination: 'script' });
        out.matchScriptLike = !!(await cache.match(scriptReq));
        // ignoreVary 测试
        out.matchIgnoreVary = !!(await cache.match(abs, { ignoreVary: true }));
      }
      return out;
    });
    console.log(JSON.stringify(probe, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ err: String(e).slice(0, 300) }));
  }
  await browser.close();
})();
