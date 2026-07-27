// R88 SETTLE 诊断：线上 LCP/talentOverlay 异常根因定位
// 1) 网络瀑布：TTFB/各资源耗时/大小  2) 充裕耐心复测天赋 overlay 可达性
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const reqs = [];
  page.on('requestfinished', async (r) => {
    try {
      const t = r.timing();
      const res = await r.response();
      const bodySize = res ? (await res.body().catch(() => null))?.length || 0 : 0;
      reqs.push({
        url: r.url().replace('https://niuhai.github.io/luohammer-pixel-game/', '/').slice(0, 80),
        type: r.resourceType(),
        startMs: Math.round(t.startTime),
        endMs: Math.round(t.responseEnd),
        durMs: Math.round(t.responseEnd - t.startTime),
        ttfbMs: Math.round(t.responseStart - t.startTime),
        sizeKB: Math.round(bodySize / 1024),
      });
    } catch (e) { /* ignore */ }
  });

  const t0 = Date.now();
  await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 60000 });
  const loadMs = Date.now() - t0;

  const bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 30000 }).catch(() => false);
  const bootVisibleAtMs = Date.now() - t0;

  // 充裕耐心：30 轮 × 1000ms
  let talentOverlay = false; let talentAtRound = -1;
  if (bootVisible) {
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
    for (let i = 0; i < 30; i++) {
      talentOverlay = await page.evaluate(() => {
        const el = document.querySelector('.ui-talent-overlay');
        return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
      });
      if (talentOverlay) { talentAtRound = i; break; }
      await page.keyboard.press('Space');
      await page.waitForTimeout(1000);
    }
  }

  reqs.sort((a, b) => b.durMs - a.durMs);
  console.log(JSON.stringify({
    loadMs, bootVisible, bootVisibleAtMs, talentOverlay, talentAtRound,
    totalReqs: reqs.length,
    totalSizeKB: reqs.reduce((s, r) => s + r.sizeKB, 0),
    slowest: reqs.slice(0, 10),
  }, null, 2));
  await browser.close();
})();
