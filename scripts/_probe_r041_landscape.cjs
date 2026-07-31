// R041 横屏（812×375，官方推荐形态）扩展专项——v4.3 R005~R040 共35轮 DOM 改动后首次横屏深扫
// 覆盖：rotate-hint / 天赋 overlay / 对话框 / choices×属性面板 / Toast 裁切(P2-3) / 结局页
// 用法：node scripts/_probe_r041_landscape.cjs（自带 4187 preview，需先 npm run build）
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4187/luohammer-pixel-game/';
const OUT = path.resolve('test-screenshots');
const VW = 812, VH = 375;

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
  // 矩形工具：元素是否在视口内（含 1px 容差）
  const rectFit = async (page, sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.offsetHeight === 0) return { missing: true };
    const r = el.getBoundingClientRect();
    return {
      l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom),
      w: Math.round(r.width), h: Math.round(r.height),
      fits: r.top >= -1 && r.left >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
      vh: window.innerHeight, vw: window.innerWidth
    };
  }, sel);

  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 150)); });

    // ================= Part A: 正常流程横屏 =================
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });

    // A1: 横屏不应显示竖屏引导
    const hintHidden = await page.evaluate(() => {
      const h = document.getElementById('rotate-hint');
      return !h || h.classList.contains('hidden') || getComputedStyle(h).display === 'none';
    });
    check('A1 横屏 rotate-hint 隐藏', hintHidden);

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
    check('A2 天赋 overlay 可达', talentOk);

    if (talentOk) {
      const fit = await rectFit(page, '#ui-talent-cards');
      check('A3 天赋卡区横屏视口内', !fit.missing && fit.fits, JSON.stringify(fit));
      await page.screenshot({ path: path.join(OUT, 'r041-landscape-talent.png') });
      // 等待错峰翻牌全部揭晓（R038/R039：先牌背后翻牌，揭晓前卡片 disabled，点击被静默忽略）
      const revealed = await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.ui-talent-card');
        return cards.length === 5 && [...cards].every((c) => c.classList.contains('is-revealed'));
      }, { timeout: 15000 }).then(() => true).catch(() => false);
      check('A3b 天赋卡全部揭晓可选', revealed);
      // 5选2
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
      const confirmed = await page.evaluate(() => {
        const b = document.querySelector('#ui-talent-confirm');
        if (b && !b.disabled) { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
        return false;
      });
      check('A3c 天赋确认按钮可点并已点', confirmed);
      await page.waitForTimeout(1200);
    }

    // 推进到第一个选项面板，途中抓对话框适配；消解 v4.3 新增阻塞层（后果/结算/随机事件/历史真相）
    const dismissBlockers = async () => page.evaluate(() => {
      const click = (el) => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const cons = document.querySelector('#ui-consequence-overlay.visible');
      if (cons) {
        click(cons.querySelector('.ui-consequence-continue'))
          || click(cons.querySelector('.ui-consequence-choice:not(:disabled)'));
        return 'consequence';
      }
      const st = document.querySelector('.ui-settlement-overlay.visible');
      if (st) { click(st.querySelector('#ui-settlement-continue')) || click(st.querySelector('button')); return 'settlement'; }
      const re = document.querySelector('#ui-random-event-overlay.visible');
      if (re) { click(re.querySelector('.ui-random-event-choice-btn:not(:disabled)')); return 'random-event'; }
      const hn = document.querySelector('#ui-history-note-overlay.visible');
      if (hn) { click(hn.querySelector('button')); return 'history-note'; }
      return null;
    });
    let dialogFit = null, choicesOk = false;
    for (let i = 0; i < 40; i++) {
      const blocked = await dismissBlockers();
      if (blocked) { await page.waitForTimeout(700); continue; }
      if (!dialogFit) {
        const d = await page.evaluate(() => {
          const el = document.getElementById('ui-dialog');
          if (!el || el.offsetHeight === 0) return null;
          const r = el.getBoundingClientRect();
          const txt = document.getElementById('ui-dialog-text');
          return {
            l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom),
            fits: r.top >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
            textLen: txt ? txt.textContent.length : 0,
            vh: window.innerHeight
          };
        });
        if (d && d.textLen > 30) dialogFit = d; // 抓到一屏有实文本的对话框
      }
      choicesOk = await page.evaluate(() => {
        const c = document.getElementById('ui-choices');
        return !!(c && c.classList.contains('visible') && c.offsetHeight > 0);
      });
      if (choicesOk) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(800);
    }
    check('A4 对话框横屏视口内', !!dialogFit && dialogFit.fits, JSON.stringify(dialogFit));
    check('A5 选项面板可达', choicesOk);

    if (choicesOk) {
      // A6: choices 与右上属性面板零重叠（R76 回归）
      const ov = await page.evaluate(() => {
        const c = document.getElementById('ui-choices').getBoundingClientRect();
        const s = document.getElementById('ui-stats').getBoundingClientRect();
        const ox = Math.max(0, Math.min(c.right, s.right) - Math.max(c.left, s.left));
        const oy = Math.max(0, Math.min(c.bottom, s.bottom) - Math.max(c.top, s.top));
        return {
          overlapPx: Math.round(ox * oy),
          choicesB: Math.round(c.bottom), vh: window.innerHeight,
          fits: c.bottom <= window.innerHeight + 1
        };
      });
      check('A6 choices×属性面板零重叠', ov.overlapPx === 0, `overlap=${ov.overlapPx}px²`);
      check('A7 choices 视口内', ov.fits, `bottom=${ov.choicesB} vh=${ov.vh}`);
      await page.screenshot({ path: path.join(OUT, 'r041-landscape-choices.png') });

      // A8: 点击首个可用选项 → 成就 toast → 横屏不裁切（P2-3 复核）
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('#ui-choices button')].find(b => !b.disabled && b.offsetHeight > 0);
        if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      let toastFit = null;
      for (let i = 0; i < 14; i++) {
        await page.waitForTimeout(250);
        toastFit = await page.evaluate(() => {
          const items = [...document.querySelectorAll('.toast-item')].filter(t => t.offsetHeight > 0);
          if (!items.length) return null;
          // 取最靠上的 toast（顶部裁切风险最大）
          const rects = items.map(t => t.getBoundingClientRect());
          const r = rects.reduce((a, b) => (a.top < b.top ? a : b));
          return {
            t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right),
            fits: r.top >= -1 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1,
            count: items.length
          };
        });
        if (toastFit) break;
      }
      check('A8 Toast 横屏视口内不裁切(P2-3)', !!toastFit && toastFit.fits, JSON.stringify(toastFit));
      if (toastFit) await page.screenshot({ path: path.join(OUT, 'r041-landscape-toast.png') });
    }

    // ================= Part B: 结局页横屏（注入存档直达） =================
    await page.evaluate(() => {
      localStorage.clear();
      const state = {
        pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [],
        history: [
          { nodeId: 'act1_first', choiceLabel: '坚持背诵《理想》课文', historyChoice: '坚持理想' },
          { nodeId: 'act6_debt', choiceLabel: '承认 6 亿债务', historyChoice: '直面现实', effects: { failures: 1 }, flags: ['faced_debt'] }
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
    await page.waitForTimeout(2600); // 等 stagger 动画完成

    // B1: 结局卡关键元素视口内或可滚动到达
    const ending = await page.evaluate(() => {
      const overlay = document.getElementById('ui-ending-overlay');
      const card = overlay.querySelector('.ui-ending-card') || overlay;
      const r = card.getBoundingClientRect();
      const btnRect = (() => {
        const b = document.getElementById('ui-ending-buttons');
        return b ? b.getBoundingClientRect() : null;
      })();
      return {
        cardH: Math.round(r.height), vh: window.innerHeight,
        cardScrollable: card.scrollHeight > card.clientHeight + 2,
        scrollH: card.scrollHeight, clientH: card.clientHeight,
        btns: btnRect ? { t: Math.round(btnRect.top), b: Math.round(btnRect.bottom), visible: btnRect.top < window.innerHeight && btnRect.bottom > 0 } : null,
        overlayScroll: overlay.scrollHeight > overlay.clientHeight + 2
      };
    });
    // 判定：按钮直接可见，或卡片/overlay 可滚动（横屏矮屏允许滚动但必须有溢出机制）
    const btnsOk = ending.btns && (ending.btns.visible || ending.cardScrollable || ending.overlayScroll);
    check('B1 结局操作按钮横屏可达（可见或可滚动）', !!btnsOk, JSON.stringify(ending));
    await page.screenshot({ path: path.join(OUT, 'r041-landscape-ending.png'), fullPage: false });

    // B2: 滚动到底验证按钮真实可点
    if (ending.btns && !ending.btns.visible && (ending.cardScrollable || ending.overlayScroll)) {
      await page.evaluate(() => {
        const b = document.getElementById('ui-ending-buttons');
        if (b) b.scrollIntoView({ block: 'end' });
      });
      await page.waitForTimeout(400);
      const after = await rectFit(page, '#ui-ending-buttons');
      check('B2 结局按钮滚动后视口内', !after.missing && after.fits, JSON.stringify(after));
      await page.screenshot({ path: path.join(OUT, 'r041-landscape-ending-scrolled.png') });
    }

    // ================= 收尾 =================
    check('C1 零 pageerror/console.error', errors.length === 0, errors.join(' | ').slice(0, 300));

    await browser.close();
    const failed = checks.filter(c => !c.pass);
    console.log(failed.length === 0 ? `\nALL ${checks.length} PASS` : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(2); });
