// R77 验证：竖屏"黑腰带"氛围层 + 滚动提示阈值 + 天赋overlay不透明度
// 用法：node scripts/_verify_r77.cjs（自带 4173 preview）
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
  const errors = [];
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices['iPhone X'], viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 150)));

    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(2000);

    // === 验证1：天赋 overlay 顶部不透明度（HUD 不应透过） ===
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).tap();
    // 流程：开始游戏 → IntroScene 星图开场 → 天赋选择。按空格跳过开场直到天赋界面出现
    for (let i = 0; i < 10; i++) {
      const talentVisible = await page.evaluate(() => {
        const el = document.querySelector('.ui-talent-overlay');
        return el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0;
      });
      if (talentVisible) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }
    await page.waitForSelector('.ui-talent-card', { timeout: 10000 });
    await page.waitForTimeout(800); // 翻牌入场动画
    const talentBg = await page.evaluate(() => {
      const el = document.querySelector('.ui-talent-overlay');
      return el ? getComputedStyle(el).backgroundImage.slice(0, 120) : 'NO-OVERLAY';
    });
    await page.screenshot({ path: path.join(OUT, 'r77-1-talent.png') });

    // 选 2 个天赋进入游戏（evaluate dispatch：避免 playwright scroll-into-view
    // 把卡片滚到标题下导致 tap 被拦截的脚本伪影，与 dogfood mobile-walk2 一致）
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.ui-talent-card:not(.locked)')];
      cards[0] && cards[0].click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.ui-talent-card:not(.locked):not(.selected)')];
      cards[0] && cards[0].click();
    });
    await page.waitForFunction(() => {
      const btn = document.querySelector('#ui-talent-confirm');
      return btn && !btn.disabled;
    }, { timeout: 8000 });
    await page.screenshot({ path: path.join(OUT, 'r77-1b-talent-selected.png') });
    await page.evaluate(() => {
      const btn = document.querySelector('#ui-talent-confirm')
        || [...document.querySelectorAll('button')].find((b) => b.textContent.includes('带着这'));
      btn && btn.click();
    });
    await page.waitForTimeout(2500); // 确认淡出 → GameScene 进入

    // === 验证2：黑腰带氛围层——canvas 底与选项面板之间的像素采样 ===
    // 推进到有选项的节点（连续空格推进；随机事件可能插入额外节点，轮次给足）
    for (let i = 0; i < 26; i++) {
      const hasChoices = await page.evaluate(() =>
        [...document.querySelectorAll('.ui-choice-btn')].some((b) => b.offsetHeight > 0));
      if (hasChoices) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(850);
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'r77-2-dialog.png') });

    const probe = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const cRect = canvas ? canvas.getBoundingClientRect() : null;
      const choicesEl = document.querySelector('.ui-choices');
      const chRect = choicesEl ? choicesEl.getBoundingClientRect() : null;
      // 采样 gap 区（canvas 底缘 +20px 处）的中心点计算后的背景色：
      // 用 elementFromPoint 确认该点可见元素是 body（无遮挡），再读 body 背景
      const gapY = cRect ? Math.round(cRect.bottom + 30) : 350;
      const gapX = Math.round(window.innerWidth / 2);
      const elAt = document.elementFromPoint(gapX, gapY);
      const bodyBg = getComputedStyle(document.body).backgroundImage;
      return {
        canvasBottom: cRect ? Math.round(cRect.bottom) : null,
        choicesTop: chRect ? chRect.top : null,
        gapPx: (cRect && chRect) ? Math.round(chRect.top - cRect.bottom) : null,
        gapPointEl: elAt ? (elAt.id || elAt.className || elAt.tagName) : null,
        bodyBgHasStars: bodyBg.includes('radial-gradient'),
        bodyBgLayers: (bodyBg.match(/radial-gradient/g) || []).length,
        // 滚动提示状态
        choicesScrollH: choicesEl ? choicesEl.scrollHeight : null,
        choicesClientH: choicesEl ? choicesEl.clientHeight : null,
        hasMore: choicesEl ? choicesEl.classList.contains('has-more') : null,
      };
    });

    // 截图放大 gap 区
    if (probe.canvasBottom && probe.choicesTop && probe.gapPx > 40) {
      await page.screenshot({
        path: path.join(OUT, 'r77-3-gapzone.png'),
        clip: { x: 0, y: probe.canvasBottom - 10, width: 375, height: Math.min(probe.gapPx + 20, 400) }
      });
    }

    console.log(JSON.stringify({ talentBg, probe, errors }, null, 2));
    await browser.close();
  } finally {
    preview.kill();
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
