// R85：线上版本 smoke——评委真实第一触点（375×812 竖屏）
// 路径：打开线上 → 标题屏可见 → 开始游戏 → IntroScene 空格推进 → 天赋 overlay 可达
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const consoleErrs = [];
  page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 120)); });

  const result = { bootVisible: false, talentOverlay: false, lcpMs: null, consoleErrs };
  try {
    await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 45000 });
    result.bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 20000 });
    result.lcpMs = await page.evaluate(() => new Promise((resolve) => {
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) resolve(Math.round(entries[entries.length - 1].startTime));
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(null), 6000);
      } catch (e) { resolve(null); }
    }));

    if (result.bootVisible) {
      await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
      for (let i = 0; i < 14; i++) {
        result.talentOverlay = await page.evaluate(() => {
          const el = document.querySelector('.ui-talent-overlay');
          return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
        });
        if (result.talentOverlay) break;
        await page.keyboard.press('Space');
        await page.waitForTimeout(800);
      }
    }
  } catch (e) {
    result.err = String(e).slice(0, 200);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.bootVisible && result.talentOverlay && consoleErrs.length === 0 ? 0 : 1);
})();
