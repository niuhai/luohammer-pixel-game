// R90：线上慢网耐心探针——DOM-only（window.game 已按 R90 门控不可用）
// 目标：区分"网络慢导致时序窗口不够"与"流程真实断裂"
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const consoleErrs = [];
  page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 150)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 150)); });

  const timeline = [];
  const snap = async (label) => {
    const s = await page.evaluate(() => {
      const vis = (sel) => {
        const el = document.querySelector(sel);
        return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
      };
      return {
        boot: vis('#ui-boot-overlay'),
        talent: vis('.ui-talent-overlay'),
        dialogue: vis('#ui-dialogue'),
        loading: vis('#ui-game-loading') || vis('#app-loading'),
        choices: document.querySelectorAll('.ui-choice-btn').length,
      };
    });
    timeline.push({ t: label, ...s });
  };

  try {
    await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 60000 });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 30000 });
    await snap('boot-visible');

    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 10000 });
    await snap('after-click');

    // 耐心推进：最多 40 轮 × 1s，每 4 轮按一次空格
    let reached = false;
    for (let i = 1; i <= 40; i++) {
      await page.waitForTimeout(1000);
      if (i % 4 === 0) await page.keyboard.press('Space');
      await snap(`t${i}s`);
      if (timeline[timeline.length - 1].talent) { reached = true; break; }
    }
    console.log(JSON.stringify({ reached, consoleErrs, timeline }, null, 2));
    await browser.close();
    process.exit(reached && consoleErrs.length === 0 ? 0 : 1);
  } catch (e) {
    console.log(JSON.stringify({ err: String(e).slice(0, 300), consoleErrs, timeline }, null, 2));
    await browser.close();
    process.exit(1);
  }
})();
