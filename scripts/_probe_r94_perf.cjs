// R94 VERIFY：运行时性能探针——CPU 4x 降速模拟中端机，采样 rAF FPS / longtask / JS heap
// 阶段：boot → 天赋选择 → 剧情推进。R70 后 24 轮无性能专项，本轮补齐证据。
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const result = { phases: {} };
  try {
    // CPU 4x 降速（模拟中端移动 SoC）
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // 注入采样器（rAF 帧间隔 + longtask）
    await page.addInitScript(() => {
      window.__perf = { frames: [], longtasks: [], marks: {} };
      let last = performance.now();
      const tick = (now) => {
        const dt = now - last;
        last = now;
        if (dt > 0 && dt < 1000) window.__perf.frames.push(dt);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            window.__perf.longtasks.push({ dur: Math.round(e.duration), start: Math.round(e.startTime) });
          }
        }).observe({ entryTypes: ['longtask'] });
      } catch (e) { /* longtask 不支持则跳过 */ }
      window.__perfMark = (name) => {
        window.__perf.marks[name] = { frames: window.__perf.frames.length, longtasks: window.__perf.longtasks.length };
      };
    });

    await page.goto('http://localhost:4180/luohammer-pixel-game/', { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => window.__perfMark('boot'));

    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });

    // 推进到天赋 overlay
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
    result.phases.talentReached = talentOk;
    await page.evaluate(() => window.__perfMark('talent'));

    // 天赋选择期采样（卡片动画/hover 重负载区）——停 5s 纯采样
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.__perfMark('talentIdle'));

    // 5选2 → 确认
    if (talentOk) {
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
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.__perfMark('confirmed'));
    }

    // 剧情推进期采样（打字机+立绘渲染）——推进 8 拍
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(800); }
    await page.evaluate(() => window.__perfMark('dialog'));

    // 汇总
    const perf = await page.evaluate(() => {
      const p = window.__perf;
      const seg = (a, b) => {
        const s = p.frames.slice(p.marks[a] ? p.marks[a].frames : 0, p.marks[b] ? p.marks[b].frames : p.frames.length);
        if (!s.length) return null;
        const avg = s.reduce((x, y) => x + y, 0) / s.length;
        const sorted = [...s].sort((x, y) => x - y);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
        return { frames: s.length, avgFps: Math.round(1000 / avg), p95ms: Math.round(p95), worstMs: Math.round(Math.max(...s)) };
      };
      const heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      return {
        bootToTalent: seg('boot', 'talent'),
        talentIdle: seg('talent', 'talentIdle'),
        confirmToDialog: seg('confirmed', 'dialog'),
        longtasks: p.longtasks,
        heapMB: heap,
      };
    });
    result.perf = perf;
  } catch (e) {
    result.err = String(e).slice(0, 300);
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
