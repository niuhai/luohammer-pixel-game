// 移动端实机探针：375x812（iPhone X 系）视口，触摸模拟，截图关键画面并检测布局溢出/console错误
// 用法：node scripts/_mobile_check.cjs  → 截图到 test-screenshots/mobile-*.png
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4173/luohammer-pixel-game/';
const OUT = path.resolve('test-screenshots');

const waitPort = (url, timeout = 30000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = async () => {
    try { const r = await fetch(url); if (r.ok) return resolve(); } catch {}
    if (Date.now() - t0 > timeout) return reject(new Error('preview port timeout'));
    setTimeout(tick, 500);
  };
  tick();
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const consoleErrors = [];
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      ...devices['iPhone X'],
      viewport: { width: 375, height: 812 },
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(2500); // 金句打字机 + 按钮入场
    await page.screenshot({ path: path.join(OUT, 'mobile-1-boot.png') });

    // 布局溢出检测（横向滚动 = 移动端硬伤）
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      hasHScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      // fixed 元素是否考虑 safe-area
      fixedWithoutSafeArea: [...document.querySelectorAll('*')].filter((el) => {
        const s = getComputedStyle(el);
        return s.position === 'fixed' && s.bottom === '0px' && !el.className.includes('safe-area')
          && el.offsetHeight > 0 && el.id !== 'rotate-hint';
      }).map((el) => el.id || el.className).slice(0, 10),
    }));

    // 进入游戏：开始游戏 → intro → 跳过 → 第一段对话
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).tap();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'mobile-2-intro.png') });

    // 跳过开场（若有跳过按钮）
    const skipBtn = page.locator('text=/跳过/').first();
    if (await skipBtn.count()) { await skipBtn.tap().catch(() => {}); await page.waitForTimeout(800); }

    // 推进到第一段正式对话（连点几次对话框区域）
    for (let i = 0; i < 6; i++) {
      await page.mouse.click(187, 600).catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.screenshot({ path: path.join(OUT, 'mobile-3-dialog.png') });

    // 选择项出现后再截一张
    const choiceVisible = await page.locator('[class*="choice"] button, .ui-choice-btn').first().isVisible().catch(() => false);
    if (choiceVisible) await page.screenshot({ path: path.join(OUT, 'mobile-4-choice.png') });

    console.log(JSON.stringify({ overflow, choiceVisible, consoleErrors: consoleErrors.slice(0, 8) }, null, 2));
    await browser.close();
  } finally {
    preview.kill();
  }
})();
