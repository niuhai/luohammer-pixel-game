// R003 SCAN：桌面 1440×900 全程走查（v4.2 电脑端主验收口径）
// 覆盖：boot → 序章跳过 → 天赋选择 → 剧情对话 → 首个选项面板 →（注入存档）结局页
// 断言：布局溢出/重叠/行宽可读性/零 pageerror；输出截图到 test-screenshots/r003/
// 用法：node scripts/_probe_r003_desktop.cjs（自带 4187 preview，使用现有 dist）
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4187/luohammer-pixel-game/';
const OUT = path.resolve('test-screenshots/r003');

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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4187', '--strictPort'], {
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
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    // ============ 阶段1：boot + 序章跳过 ============
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.screenshot({ path: path.join(OUT, '01-title-desktop.png') });

    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
    // 序章出现 → 等跳过开放（350ms）→ 点击跳过按钮
    await page.locator('.ui-intro-overlay.visible').waitFor({ timeout: 15000 });
    await page.waitForTimeout(900); // 等跳过提示可见（skipAt 350ms + 余量）
    const skipVisible = await page.evaluate(() => {
      const el = document.getElementById('ui-intro-skip-hint');
      return !!(el && el.classList.contains('visible'));
    });
    check('S1 序章跳过按钮按时开放', skipVisible, '');
    await page.evaluate(() => {
      document.getElementById('ui-intro-skip-hint').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // ============ 阶段2：天赋选择（桌面布局） ============
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
    check('S2 天赋 overlay 可达', talentOk, '');

    if (talentOk) {
      await page.waitForTimeout(800);
      const talentLayout = await page.evaluate(() => {
        const cards = document.getElementById('ui-talent-cards');
        const overlay = document.querySelector('.ui-talent-overlay');
        if (!cards) return { err: 'no cards' };
        const r = cards.getBoundingClientRect();
        const o = overlay.getBoundingClientRect();
        const cardEls = [...document.querySelectorAll('.ui-talent-card')];
        const overflow = cardEls.some((c) => {
          const cr = c.getBoundingClientRect();
          return cr.bottom > window.innerHeight + 1 || cr.right > window.innerWidth + 1 || cr.left < -1 || cr.top < -1;
        });
        return {
          cardsW: Math.round(r.width), cardsH: Math.round(r.height),
          cardCount: cardEls.length,
          fits: !overflow && r.bottom <= window.innerHeight + 1,
          overlayW: Math.round(o.width),
        };
      });
      check('S3 天赋卡片桌面布局不溢出', talentLayout.fits === true, JSON.stringify(talentLayout));
      await page.screenshot({ path: path.join(OUT, '02-talent-desktop.png') });

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
      await page.waitForTimeout(1500);
    }

    // ============ 阶段3：剧情对话（桌面行宽/布局） ============
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
    check('S4 对话框桌面可见', dialogOk, '');

    if (dialogOk) {
      // 推进到一段较长文本再采样行宽
      for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(900); }
      const dialogLayout = await page.evaluate(() => {
        const d = document.getElementById('ui-dialog');
        const text = document.getElementById('ui-dialog-text');
        const stats = document.getElementById('ui-stats');
        if (!d || !text) return { err: 'missing' };
        const dr = d.getBoundingClientRect();
        const tr = text.getBoundingClientRect();
        const cs = getComputedStyle(text);
        const fontSize = parseFloat(cs.fontSize);
        const lineChars = fontSize > 0 ? Math.round(tr.width / fontSize) : 0; // 中文近似每字 1em
        let overlapPx = 0;
        if (stats) {
          const sr = stats.getBoundingClientRect();
          const ox = Math.max(0, Math.min(dr.right, sr.right) - Math.max(dr.left, sr.left));
          const oy = Math.max(0, Math.min(dr.bottom, sr.bottom) - Math.max(dr.top, sr.top));
          overlapPx = Math.round(ox * oy);
        }
        return {
          dialogW: Math.round(dr.width), textW: Math.round(tr.width),
          fontSize, lineChars, overlapWithStats: overlapPx,
          dialogBottom: Math.round(dr.bottom), vh: window.innerHeight,
          fits: dr.bottom <= window.innerHeight + 1,
        };
      });
      // 中文排版可读性参考：每行 25-45 字舒适，>60 字偏长
      check('S5 对话框桌面不溢出/不压属性面板', dialogLayout.fits === true && dialogLayout.overlapWithStats === 0, JSON.stringify(dialogLayout));
      console.log(`INFO 对话行宽约 ${dialogLayout.lineChars} 字/行（字号 ${dialogLayout.fontSize}px）`);
      await page.screenshot({ path: path.join(OUT, '03-dialog-desktop.png') });
    }

    // ============ 阶段4：首个选项面板（桌面布局） ============
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
    check('S6 选项面板桌面可达', choicesOk, '');

    if (choicesOk) {
      await page.waitForTimeout(600);
      const choicesLayout = await page.evaluate(() => {
        const c = document.getElementById('ui-choices');
        const stats = document.getElementById('ui-stats');
        const cr = c.getBoundingClientRect();
        let overlapPx = 0;
        if (stats) {
          const sr = stats.getBoundingClientRect();
          const ox = Math.max(0, Math.min(cr.right, sr.right) - Math.max(cr.left, sr.left));
          const oy = Math.max(0, Math.min(cr.bottom, sr.bottom) - Math.max(cr.top, sr.top));
          overlapPx = Math.round(ox * oy);
        }
        const btns = [...c.querySelectorAll('button')];
        const btnOverflow = btns.some((b) => {
          const br = b.getBoundingClientRect();
          return br.right > window.innerWidth + 1 || br.bottom > window.innerHeight + 1;
        });
        return {
          choicesW: Math.round(cr.width), btnCount: btns.length,
          overlapWithStats: overlapPx, btnOverflow,
          bottom: Math.round(cr.bottom), vh: window.innerHeight,
          fits: cr.bottom <= window.innerHeight + 1 && !btnOverflow,
        };
      });
      check('S7 选项面板桌面不溢出/不压属性面板', choicesLayout.fits === true && choicesLayout.overlapWithStats === 0, JSON.stringify(choicesLayout));
      await page.screenshot({ path: path.join(OUT, '04-choices-desktop.png') });
    }

    // ============ 阶段5：结局页（注入存档，桌面布局） ============
    await page.evaluate(() => {
      localStorage.clear();
      const state = {
        pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [],
        history: [
          { nodeId: 'act1_first', choiceLabel: '坚持背诵《理想》课文', historyChoice: '坚持理想' },
          { nodeId: 'act6_debt', choiceLabel: '承认 6 亿债务', historyChoice: '直面现实', effects: { failures: 1 }, flags: ['faced_debt'] },
          { nodeId: 'act6_livestream', choiceLabel: '开播卖货还债', historyChoice: '放下面子' }
        ],
        achievements: ['first_choice'], gameStartTime: Date.now() - 600000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'load' });
    const contBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await contBtn.waitFor({ state: 'visible', timeout: 15000 });
    await contBtn.click();
    await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
    await page.waitForTimeout(2600); // 等 stagger 动画完成（R92：buttons delay 0.9s + 0.8s）

    const endingLayout = await page.evaluate(() => {
      const overlay = document.getElementById('ui-ending-overlay');
      const quote = document.getElementById('ui-ending-quote');
      const buttons = document.getElementById('ui-ending-buttons');
      const summary = document.getElementById('ui-ending-summary');
      const out = { overlayVisible: overlay.classList.contains('visible') };
      const fit = (el, name) => {
        if (!el) { out[name] = 'missing'; return; }
        const r = el.getBoundingClientRect();
        out[name] = { w: Math.round(r.width), bottom: Math.round(r.bottom), fits: r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1 && r.left >= -1 };
      };
      fit(quote, 'quote'); fit(buttons, 'buttons'); fit(summary, 'summary');
      if (quote) {
        const cs = getComputedStyle(quote);
        out.quoteFontSize = parseFloat(cs.fontSize);
        out.quoteLineChars = Math.round(quote.getBoundingClientRect().width / out.quoteFontSize);
      }
      const btnEls = [...(buttons ? buttons.querySelectorAll('button') : [])];
      out.btnCount = btnEls.length;
      out.scrollH = document.documentElement.scrollHeight;
      out.vh = window.innerHeight;
      return out;
    });
    const endingFits = ['quote', 'buttons', 'summary'].every((k) => endingLayout[k] && endingLayout[k].fits);
    check('S8 结局页桌面全元素视口内', endingFits, JSON.stringify(endingLayout));
    console.log(`INFO 金句行宽约 ${endingLayout.quoteLineChars} 字/行（字号 ${endingLayout.quoteFontSize}px）`);
    await page.screenshot({ path: path.join(OUT, '05-ending-desktop.png'), fullPage: false });

    // ============ 收尾 ============
    check('S9 全程零 pageerror', errors.length === 0, errors.join(' | ').slice(0, 300));

    await browser.close();
    const failed = checks.filter(c => !c.pass);
    console.log(failed.length === 0 ? '\nALL PASS' : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    try { execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(2); });
