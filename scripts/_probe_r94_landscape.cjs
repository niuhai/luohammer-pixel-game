// R94 VERIFY：横屏（812×375，官方推荐形态）回归——R76 修复在 R91/R93 DOM 大改后仍有效
// 断言：rotate-hint 隐藏 / 天赋 overlay 适配 / choices 与右上属性面板零重叠 / 不溢出视口底
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 812, height: 375 } });
  const page = await context.newPage();
  const result = {};
  try {
    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });

    // 横屏不应显示竖屏引导
    result.rotateHintHidden = await page.evaluate(() => {
      const h = document.getElementById('rotate-hint');
      return !h || h.classList.contains('hidden') || getComputedStyle(h).display === 'none';
    });

    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });

    // 推进到天赋 overlay（IntroScene 星图之后，R89 经验：轮询不固定 sleep）
    let talentOk = false;
    for (let i = 0; i < 40; i++) {
      talentOk = await page.evaluate(() => {
        const el = document.querySelector('.ui-talent-overlay');
        return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
      });
      if (talentOk) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }
    result.talent = talentOk;

    if (talentOk) {
      // 天赋 overlay 横屏适配：卡片不溢出视口
      result.talentFit = await page.evaluate(() => {
        const overlay = document.querySelector('.ui-talent-overlay');
        const cards = document.getElementById('ui-talent-cards');
        if (!cards) return { err: 'no cards' };
        const r = cards.getBoundingClientRect();
        return {
          cardsW: Math.round(r.width), cardsH: Math.round(r.height),
          bottom: Math.round(r.bottom), vh: window.innerHeight,
          fits: r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
          cardCount: document.querySelectorAll('.ui-talent-card').length,
        };
      });
      // 5选2 → 确认
      await page.evaluate(() => {
        const c = document.querySelectorAll('.ui-talent-card');
        if (c[0]) c[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const c = document.querySelectorAll('.ui-talent-card');
        if (c[1]) c[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const b = document.querySelector('#ui-talent-confirm');
        if (b && !b.disabled) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(1200);
    }

    // 推进到第一个选项面板
    let choicesOk = false;
    for (let i = 0; i < 30; i++) {
      choicesOk = await page.evaluate(() => {
        const c = document.getElementById('ui-choices');
        return !!(c && c.classList.contains('visible') && c.offsetHeight > 0);
      });
      if (choicesOk) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(800);
    }
    result.choices = choicesOk;

    if (choicesOk) {
      // R76 核心断言：choices 面板与右上属性面板不重叠
      result.overlap = await page.evaluate(() => {
        const choices = document.getElementById('ui-choices');
        const stats = document.getElementById('ui-stats');
        if (!choices || !stats) return { err: 'missing el' };
        const c = choices.getBoundingClientRect();
        const s = stats.getBoundingClientRect();
        const overlapX = Math.max(0, Math.min(c.right, s.right) - Math.max(c.left, s.left));
        const overlapY = Math.max(0, Math.min(c.bottom, s.bottom) - Math.max(c.top, s.top));
        return {
          choicesRect: { l: Math.round(c.left), r: Math.round(c.right), t: Math.round(c.top), b: Math.round(c.bottom) },
          statsRect: { l: Math.round(s.left), r: Math.round(s.right), t: Math.round(s.top), b: Math.round(s.bottom) },
          overlapPx: Math.round(overlapX * overlapY),
        };
      });
      result.viewportFit = await page.evaluate(() => {
        const c = document.getElementById('ui-choices').getBoundingClientRect();
        return { choicesBottom: Math.round(c.bottom), vh: window.innerHeight, fits: c.bottom <= window.innerHeight + 1 };
      });
    }
  } catch (e) {
    result.err = String(e).slice(0, 300);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
