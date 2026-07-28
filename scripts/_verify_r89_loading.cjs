// R89 本地验证：vite preview + CDP 慢网（300KB/s）下
// (1) #ui-game-loading 在 GameScene preload 期间出现 (2) 进度推进 (3) 最终天赋 overlay 可达
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
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

    // 推空格直到 IntroScene 结束（GameScene 开始 preload）
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(900); }

    // 采样加载层可见性与进度
    for (let i = 0; i < 40; i++) {
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
        result.progressSamples.push(s.text);
      }
      if (s.talent) {
        result.talentOverlay = true;
        result.loadingHiddenAfter = !s.loading;
        break;
      }
      await page.waitForTimeout(500);
    }
  } catch (e) {
    result.err = String(e).slice(0, 200);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.loadingShown && result.talentOverlay && result.loadingHiddenAfter && logs.length === 0 ? 0 : 1);
})();
