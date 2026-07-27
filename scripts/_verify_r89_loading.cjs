// R89 本地验证：vite preview + CDP 慢网（300KB/s）下
// (1) #ui-game-loading 在 GameScene preload 期间出现 (2) 进度推进 (3) 最终天赋 overlay 可达
// 注：必须 serviceWorkers:'block'——SW 拦截的子资源请求会绕过 CDP 限速（Chromium 已知缺口），
//     不阻断则 preload 全部秒回（SW 预缓存/未限速内网 fetch），永远采不到加载层。
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  // 禁用缓存：确保 preload link 的缓存不喂给 Phaser XHR，强制真实慢速下载路径
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400, downloadThroughput: 300 * 1024, uploadThroughput: 100 * 1024
  });

  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 200)));

  const result = { loadingShown: false, progressSamples: [], talentOverlay: false, loadingHiddenAfter: null, logs };
  try {
    await page.goto('http://localhost:4173/luohammer-pixel-game/', { waitUntil: 'load', timeout: 90000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 60000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 15000 });

    // 密集采样（200ms）贯穿全程：IntroScene 何时结束不确定，固定时序必错位（R77 教训）
    const t0 = Date.now();
    let sawLoading = false; let hideAfterLoading = false;
    for (let i = 0; i < 250; i++) {
      const s = await page.evaluate(() => {
        const el = document.getElementById('ui-game-loading');
        const talent = document.querySelector('.ui-talent-overlay');
        return {
          loading: !!(el && el.classList.contains('visible')),
          text: el ? el.querySelector('.ui-game-loading-text')?.textContent : null,
          talent: !!(talent && talent.offsetHeight > 0),
        };
      });
      if (s.loading) {
        result.loadingShown = true;
        sawLoading = true;
        if (result.progressSamples.length < 12 || Date.now() - t0 < 20000) {
          result.progressSamples.push(((Date.now() - t0) / 1000).toFixed(1) + 's:' + s.text);
        }
      } else if (sawLoading) {
        hideAfterLoading = true; // loading 曾经可见、现在不可见 = 完成后隐藏
      }
      if (s.talent) {
        result.talentOverlay = true;
        result.loadingHiddenAfter = !s.loading && (sawLoading ? hideAfterLoading : true);
        break;
      }
      // 未到达天赋层前持续敲空格推进 IntroScene
      if (i % 5 === 4) await page.keyboard.press('Space');
      await page.waitForTimeout(200);
    }
  } catch (e) {
    result.err = String(e).slice(0, 200);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.loadingShown && result.talentOverlay && result.loadingHiddenAfter && logs.length === 0 ? 0 : 1);
})();
