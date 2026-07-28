// R92 实机探针：结局 stagger 入场编排时间轴 + 分享文案话题标签
// 背景：R92 SCAN 子代理误报"结局 DOM 一次性全砸"（只读 JS 未查 CSS），
// 实际 index.html 已有完整 stagger（title 0s → desc 0.18 → radar 0.3 → quote 0.36 → summary 0.7 → buttons 0.9）。
// 本探针实机验证：动画进行中采样各元素 opacity，确认错峰生效（非同时全显）。
// 用法：node scripts/_probe_r92_ending.cjs（自带 4186 preview，需先 npm run build）
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4186/luohammer-pixel-game/';
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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4186', '--strictPort'], {
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
    const ctx = await browser.newContext({ ...devices['iPhone X'], viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    // 注入结局存档（含 history 触发闪回）
    await page.goto(BASE);
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
    await page.reload();
    const contBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await contBtn.waitFor({ state: 'visible', timeout: 15000 });
    await contBtn.tap();

    // ============ P1: stagger 时间轴——overlay visible 瞬间开始高频采样 ============
    await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
    // visible 刚加上时立即采样（闪回 finish 后 _renderEndingDOM 同步执行，动画从这一帧开始）
    const samples = [];
    for (let i = 0; i < 8; i++) {
      const s = await page.evaluate(() => {
        const op = (sel) => {
          const el = document.querySelector(sel);
          return el ? parseFloat(getComputedStyle(el).opacity) : null;
        };
        return {
          t: Math.round(performance.now()),
          title: op('#ui-ending-title'),
          quote: op('#ui-ending-quote'),
          summary: op('#ui-ending-summary'),
          buttons: op('#ui-ending-buttons')
        };
      });
      samples.push(s);
      await page.waitForTimeout(120);
    }
    console.log('stagger samples:', JSON.stringify(samples));
    // 错峰判定：存在某个采样点 title 已明显可见(op>0.5) 而 buttons 尚未完全可见(op<0.9)
    // （buttons delay 0.9s + 0.8s duration，title delay 0 + 1.2s duration——前 500ms 内必可采到差异）
    const staggered = samples.some(s =>
      s.title !== null && s.buttons !== null && s.title > 0.5 && s.buttons < 0.9
    );
    check('P1 结局元素错峰入场（非同时全显）', staggered,
      staggered ? '采样到 title 可见而 buttons 未齐的窗口' : '未采到错峰窗口，元素可能同时出现');

    // 等动画全部完成
    await page.waitForTimeout(2500);
    const finalOp = await page.evaluate(() => {
      const op = (sel) => {
        const el = document.querySelector(sel);
        return el ? parseFloat(getComputedStyle(el).opacity) : null;
      };
      return { title: op('#ui-ending-title'), quote: op('#ui-ending-quote'), summary: op('#ui-ending-summary'), buttons: op('#ui-ending-buttons') };
    });
    check('P2 动画完成后全元素 opacity=1', ['title', 'quote', 'summary', 'buttons'].every(k => finalOp[k] === 1),
      JSON.stringify(finalOp));
    await page.screenshot({ path: path.join(OUT, 'r92-ending-stagger.png') });

    // ============ P3: 分享文案含话题标签（拦截 clipboard） ============
    await page.evaluate(() => {
      window.__copiedText = null;
      navigator.clipboard.writeText = (t) => { window.__copiedText = t; return Promise.resolve(); };
    });
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('复制分享文案'));
      btn && btn.click();
    });
    await page.waitForTimeout(600);
    const copied = await page.evaluate(() => window.__copiedText);
    check('P3 分享文案复制成功', !!copied, copied ? `len=${copied.length}` : 'clipboard 未捕获');
    check('P4 分享文案含话题标签', !!(copied && copied.includes('#罗的十字路口') && copied.includes('#人生模拟器')),
      copied ? copied.split('\n').slice(-1)[0] : 'N/A');
    check('P5 分享文案含游戏名与结局', !!(copied && copied.includes('罗的十字路口 · 人生模拟') && copied.includes('我的结局')),
      '');

    // ============ 收尾 ============
    check('P6 零 pageerror', errors.length === 0, errors.join(' | ').slice(0, 300));

    await browser.close();
    const failed = checks.filter(c => !c.pass);
    console.log(failed.length === 0 ? '\nALL PASS' : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    // Windows: 杀进程树
    try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch(e => { console.error('FATAL', e); process.exit(2); });
