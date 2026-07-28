// R003 VERIFY-L3a：序章读屏镜像（R93 模式）+ 手机端对话框全宽护栏
// 断言：(1) text-layer aria-hidden；(2) #ui-intro-sr 在点题句演出完成后写入整句且与可视字符一致；
//       (3) 375×812 竖屏对话框保持全宽（桌面行宽约束不命中手机）；(4) 零 pageerror
// 用法：node scripts/_probe_r003_a11y.cjs（自带 4188 preview，需先 npm run build）
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');

const BASE = 'http://localhost:4188/luohammer-pixel-game/';

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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4188', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const errors = [];
  const checks = [];
  const check = (name, pass, detail) => {
    checks.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
    await page.locator('.ui-intro-overlay.visible').waitFor({ timeout: 15000 });

    // A1 可视文本层对读屏隐藏
    const layerHidden = await page.evaluate(() => {
      const layer = document.querySelector('.ui-intro-text-layer');
      return layer && layer.getAttribute('aria-hidden') === 'true';
    });
    check('A1 序章可视文本层 aria-hidden', layerHidden === true, '');

    // A2 镜像 live 区存在且属性正确
    const srAttrs = await page.evaluate(() => {
      const sr = document.getElementById('ui-intro-sr');
      return sr ? { live: sr.getAttribute('aria-live'), role: sr.getAttribute('role') } : null;
    });
    check('A2 读屏镜像 live 区存在且 polite', !!srAttrs && srAttrs.live === 'polite' && srAttrs.role === 'log', JSON.stringify(srAttrs));

    // A3 点题句（第3行）演出完成后镜像写入整句（时间线 ~5.4s + 打字 760ms + 延迟 800ms，轮询 ≤12s）
    let mirrorFinal = '';
    for (let i = 0; i < 40; i++) {
      mirrorFinal = await page.evaluate(() => {
        const sr = document.getElementById('ui-intro-sr');
        const line3 = document.getElementById('ui-intro-line3');
        const visual = line3 ? [...line3.querySelectorAll('.ui-intro-char')].map((c) => c.textContent).join('') : '';
        return { sr: sr ? sr.textContent : '', visual, visible: line3 ? line3.classList.contains('visible') : false };
      }).then((r) => r);
      if (mirrorFinal.visible && mirrorFinal.sr && mirrorFinal.sr === mirrorFinal.visual && mirrorFinal.visual.length > 3) break;
      await page.waitForTimeout(300);
    }
    check('A3 点题句镜像与可视文本一致', mirrorFinal.visible === true && mirrorFinal.sr === mirrorFinal.visual && mirrorFinal.visual.length > 3,
      `sr="${mirrorFinal.sr}" visual="${mirrorFinal.visual}"`);

    // A4 跳过序章 → 天赋 5选2 → 对话框：竖屏保持全宽（护栏）
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const el = document.getElementById('ui-intro-skip-hint');
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
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
    check('A4 跳过后天赋 overlay 可达', talentOk, '');

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
      await page.waitForTimeout(1500);
    }

    let dialogOk = false;
    for (let i = 0; i < 12; i++) {
      dialogOk = await page.evaluate(() => {
        const d = document.getElementById('ui-dialog');
        return !!(d && d.classList.contains('visible') && d.offsetHeight > 0);
      });
      if (dialogOk) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }
    check('A5 竖屏对话框可见', dialogOk, '');

    if (dialogOk) {
      const dw = await page.evaluate(() => {
        const r = document.getElementById('ui-dialog').getBoundingClientRect();
        return { w: Math.round(r.width), vw: window.innerWidth, left: Math.round(r.left) };
      });
      check('A6 竖屏对话框保持全宽（桌面约束不命中）', Math.abs(dw.w - dw.vw) <= 2 && dw.left <= 1, JSON.stringify(dw));
    }

    check('A7 全程零 pageerror', errors.length === 0, errors.join(' | ').slice(0, 300));

    await browser.close();
    const failed = checks.filter(c => !c.pass);
    console.log(failed.length === 0 ? '\nALL PASS' : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    try { execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(2); });
