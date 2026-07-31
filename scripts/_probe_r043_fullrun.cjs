// R043 全自动真实通关（无注入，生产构建，390×844）——产品完成度终极实证
// 从标题到结局真实走完全程：序章→天赋→六阶段→结局，全程记录阶段/结算/随机事件/零报错
// 用法：node scripts/_probe_r043_fullrun.cjs（自带 4189 preview，需先 npm run build）
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4189/luohammer-pixel-game/';
const OUT = path.resolve('test-screenshots');
const MAX_ITER = 1600;

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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4189', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const errors = [];
  const checks = [];
  const check = (name, pass, detail) => {
    checks.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  const stats = { choices: 0, settlements: 0, randomEvents: 0, consequences: 0, historyNotes: 0, checkAnims: 0, stageShots: 0 };

  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 150)); });

    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });

    // 到天赋 overlay → 等翻牌揭晓 → 5选2 → 确认
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
    check('F1 天赋 overlay 可达', talentOk);
    if (talentOk) {
      await page.waitForFunction(() => {
        const cards = document.querySelectorAll('.ui-talent-card');
        return cards.length === 5 && [...cards].every((c) => c.classList.contains('is-revealed'));
      }, { timeout: 15000 }).catch(() => {});
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
    }

    // 主循环：消解阻塞层 → 有选项点首个可用 → 否则空格推进；结局 overlay 出现即停
    // 阻塞层消解返回层名，结局返回 'ENDING'
    const step = () => page.evaluate(() => {
      const click = (el) => { if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; } return false; };
      if (document.querySelector('#ui-ending-overlay.visible')) return 'ENDING';
      const cons = document.querySelector('#ui-consequence-overlay.visible');
      if (cons) {
        // continue 按钮在 decision 阶段是 hidden 的——合成点击对隐藏按钮照样触发监听器（空转），
        // 必须先确认可见，否则永远点不到真正的崩溃恢复选项（R043 假循环根因）
        const cont = cons.querySelector('.ui-consequence-continue');
        if (cont && !cont.hidden && cont.offsetHeight > 0) { click(cont); return 'consequence'; }
        click(cons.querySelector('.ui-consequence-choice:not(:disabled)'));
        return 'consequence';
      }
      const st = document.querySelector('.ui-settlement-overlay.visible');
      if (st) { click(st.querySelector('#ui-settlement-continue')) || click(st.querySelector('button')); return 'settlement'; }
      const re = document.querySelector('#ui-random-event-overlay.visible');
      if (re) { click(re.querySelector('.ui-random-event-choice-btn:not(:disabled)')); return 'random-event'; }
      const hn = document.querySelector('#ui-history-note-overlay.visible');
      if (hn) { click([...hn.querySelectorAll('button')].find(b => /关闭|继续|✕/.test(b.textContent)) || hn.querySelector('button')); return 'history-note'; }
      const ca = document.querySelector('.check-animation-overlay.visible');
      if (ca) { click(ca.querySelector('.check-animation-continue')) || click(ca.querySelector('button')); return 'check-anim'; }
      const choices = document.getElementById('ui-choices');
      if (choices && choices.classList.contains('visible') && choices.offsetHeight > 0) {
        // 六阶段全覆盖策略：按钮顺序与 ChoiceSystem.choices 一一对应，
        // 优先点 next 不直达结局的可用选项，全部直达结局时才进结局（避免贪首选项在 act4 工匠传奇提前收官）
        const gs = window.game?.scene?.getScene?.('GameScene');
        const data = gs?.choices?.choices || [];
        const btns = [...choices.querySelectorAll('button')];
        const enabled = btns.map((b, i) => ({ b, i })).filter(x => !x.b.disabled && x.b.offsetHeight > 0);
        const nonEnding = enabled.find(x => !String(data[x.i]?.next || '').startsWith('ending'));
        const pick = nonEnding || enabled[0];
        if (pick) { click(pick.b); return 'choice'; }
        return 'choice-wait';
      }
      return 'advance';
    });

    let endingReached = false;
    const t0 = Date.now();
    for (let i = 0; i < MAX_ITER; i++) {
      const action = await step();
      if (action === 'ENDING') { endingReached = true; break; }
      if (action === 'choice') stats.choices++;
      else if (action === 'settlement') {
        stats.settlements++;
        stats.stageShots++;
        await page.screenshot({ path: path.join(OUT, `r043-settlement-${stats.settlements}.png`) });
      }
      else if (action === 'random-event') stats.randomEvents++;
      else if (action === 'consequence') stats.consequences++;
      else if (action === 'history-note') stats.historyNotes++;
      else if (action === 'check-anim') stats.checkAnims++;
      else if (action === 'advance') await page.keyboard.press('Space');
      if (i > 0 && i % 150 === 0) console.log(`progress: iter=${i} stats=${JSON.stringify(stats)}`);
      await page.waitForTimeout(action === 'advance' ? 320 : 550);
    }
    const elapsed = Math.round((Date.now() - t0) / 1000);
    console.log('run-stats:', JSON.stringify({ ...stats, elapsedSec: elapsed }));

    check('F2 真实通关到达结局', endingReached, `choices=${stats.choices} settlements=${stats.settlements} randomEvents=${stats.randomEvents} consequences=${stats.consequences} 耗时${elapsed}s`);
    check('F3 决策密度（≥12 次真实选择）', stats.choices >= 12, `choices=${stats.choices}`);
    check('F4 阶段结算出现（≥3 次）', stats.settlements >= 3, `settlements=${stats.settlements}`);

    if (endingReached) {
      await page.waitForTimeout(2600);
      const ending = await page.evaluate(() => {
        const t = document.getElementById('ui-ending-title');
        const q = document.getElementById('ui-ending-quote');
        return { title: t ? t.textContent.trim() : '', quote: q ? q.textContent.trim().slice(0, 40) : '' };
      });
      check('F5 结局内容非空', ending.title.length > 0, JSON.stringify(ending));
      await page.screenshot({ path: path.join(OUT, 'r043-ending.png') });
    }

    check('F6 全程零 pageerror/console.error', errors.length === 0, errors.slice(0, 3).join(' | ').slice(0, 300));

    await browser.close();
    const failed = checks.filter(c => !c.pass);
    console.log(failed.length === 0 ? `\nALL ${checks.length} PASS` : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(2); });
