// R84 收敛判定走查：阶段结算屏（每局6次评委必见）+ 结局页剩余2按钮（复制分享文案/再来一次）+ 结算溢出检测
// 用法：node scripts/_verify_r84.cjs（自带 4184 preview，需先 npm run build）
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4184/luohammer-pixel-game/';
const OUT = path.resolve('test-screenshots');
const VIEW_W = 375;

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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4184', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const errors = [];
  const results = { settlement: {}, copy: {}, retry: {}, errors };
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      ...devices['iPhone X'], viewport: { width: VIEW_W, height: 812 },
      permissions: ['clipboard-read', 'clipboard-write']
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    // ============ Part 1: 阶段结算屏（真实 GameScene + 直调渲染路径） ============
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).tap();
    // 跳过 IntroScene → 天赋选择
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
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.ui-talent-card:not(.locked)')];
      cards[0] && cards[0].click();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.ui-talent-card:not(.locked):not(.selected)')];
      cards[0] && cards[0].click();
    });
    await page.waitForFunction(() => {
      const btn = document.querySelector('#ui-talent-confirm');
      return btn && !btn.disabled;
    }, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#ui-talent-confirm').click(); });
    await page.waitForFunction(() => {
      const s = window.game && window.game.scene.getScene('GameScene');
      return s && s.randomEventSystem;
    }, { timeout: 15000 });
    await page.waitForTimeout(1200);

    // 先消化真实 youth 阶段结算（游戏开局 stage entry 自动触发）：等待出现→点继续→等移除
    // 否则真实/注入两个 overlay 叠加，断言取到错误对象（首版脚本 attrRows=2/textVisible=false 污染教训）
    try {
      await page.waitForSelector('.ui-settlement-overlay.visible', { timeout: 4000 });
      await page.evaluate(() => {
        const btn = document.getElementById('ui-settlement-continue');
        btn && btn.click();
      });
      await page.waitForFunction(() => !document.querySelector('.ui-settlement-overlay'), { timeout: 6000 });
      await page.waitForTimeout(600);
    } catch (e) { /* 无真实结算则直接进入注入测试 */ }
    results.settlement.realSettlementDigested = await page.evaluate(() => !document.querySelector('.ui-settlement-overlay'));

    // 直调阶段结算渲染路径（含 1 条属性变化 check + 1 个成就 check）
    await page.evaluate(() => {
      const s = window.game.scene.getScene('GameScene');
      window.__settlementDone = false;
      window.__prideBefore = s.state.pride;
      s._showStageSettlement({
        id: 'teacher', name: '名师之路', period: '2001-2006',
        settlement: {
          text: '你在新东方的课堂上火了，学生偷偷录下你的段子传遍全网。',
          checks: [
            { attr: 'pride', min: 0, max: 99, result: '理想主义之火未灭', effects: { pride: 1 } },
            { attr: 'reputation', min: 0, max: 99, result: '名声渐起', effects: { achievement: 'r84_test_ach', icon: '★' } }
          ]
        }
      }, () => { window.__settlementDone = true; });
    });
    await page.waitForSelector('.ui-settlement-overlay.visible', { timeout: 5000 });
    await page.waitForTimeout(800); // 卡片入场 + 属性条动画中段
    results.settlement.render = await page.evaluate((vw) => {
      const card = document.querySelector('.ui-settlement-card');
      const r = card.getBoundingClientRect();
      const countdown = document.getElementById('ui-settlement-countdown');
      const btn = document.getElementById('ui-settlement-continue');
      const btnR = btn.getBoundingClientRect();
      return {
        cardLeft: Math.round(r.left), cardRight: Math.round(r.right),
        overflowLeft: r.left < -1, overflowRight: r.right > vw + 1,
        countdownText: countdown ? countdown.textContent.trim() : null,
        continueBtnSize: { w: Math.round(btnR.width), h: Math.round(btnR.height) },
        attrRows: document.querySelectorAll('.ui-settlement-attr').length,
        textVisible: document.querySelector('.ui-settlement-text').textContent.includes('新东方')
      };
    }, VIEW_W);
    await page.screenshot({ path: path.join(OUT, 'r84-1-settlement.png') });
    // 点"继续" → 效果应用 + 关闭 + onComplete 回调
    await page.evaluate(() => { document.getElementById('ui-settlement-continue').click(); });
    await page.waitForTimeout(900); // closing 动画 350ms + DOM 移除 400ms
    results.settlement.afterClose = await page.evaluate(() => {
      const s = window.game.scene.getScene('GameScene');
      return {
        overlayGone: !document.querySelector('.ui-settlement-overlay'),
        prideApplied: s.state.pride === window.__prideBefore + 1,
        achievementRecorded: s.state.achievements.includes('r84_test_ach'),
        onCompleteFired: window.__settlementDone === true
      };
    });
    await page.screenshot({ path: path.join(OUT, 'r84-2-after-settlement.png') });

    // ============ Part 2: 结局页剩余 2 按钮（复制分享文案 / 再来一次） ============
    await page.evaluate(() => {
      localStorage.clear();
      const state = {
        pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [],
        history: [{ nodeId: 'act1_first', choiceLabel: '坚持背诵《理想》课文' }],
        achievements: ['first_choice'],
        gameStartTime: Date.now() - 60000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    });
    await page.reload();
    const contBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await contBtn.waitFor({ state: 'visible', timeout: 15000 });
    await contBtn.tap();
    await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
    await page.waitForTimeout(3500);

    // 打开"更多 ▾"→ 复制分享文案 → toast + 剪贴板内容断言
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('更多'));
      btn && btn.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const item = [...document.querySelectorAll('.ui-ending-more-menu button')].find((b) => b.textContent.includes('复制分享文案'));
      item && item.click();
    });
    await page.waitForTimeout(1200);
    results.copy = await page.evaluate(async () => {
      // ToastSystem 结构：.toast-item > .toast-icon + .toast-text（严格等式会漏 icon 前缀，首版误判教训）
      const toastEl = [...document.querySelectorAll('.toast-item .toast-text')].find((d) => d.textContent.trim() === '分享文案已复制');
      let clip = null;
      try { clip = (await navigator.clipboard.readText()).slice(0, 60); } catch (e) { clip = 'READ_FAIL:' + String(e).slice(0, 60); }
      return { toastShown: !!toastEl, clipHead: clip };
    });
    await page.screenshot({ path: path.join(OUT, 'r84-3-copy-toast.png') });

    // 再来一次 → 存档清空 → BootScene → 开始游戏可达天赋 overlay（重开闭环）
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '再来一次');
      btn && btn.click();
    });
    await page.waitForTimeout(2000);
    results.retry.bootReached = await page.evaluate(() => {
      const overlay = document.getElementById('ui-boot-overlay');
      const save = localStorage.getItem('luohammer_save');
      return {
        bootVisible: !!(overlay && overlay.offsetHeight > 0),
        saveCleared: !save,
        startBtnExists: !!([...document.querySelectorAll('#ui-boot-buttons button')].find((b) => b.textContent.includes('开始游戏')))
      };
    });
    await page.screenshot({ path: path.join(OUT, 'r84-4-retry-boot.png') });
    // 从 BootScene 再开一局 → 天赋 overlay 出现（重开链路完整）
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).tap();
    let talentOk = false;
    for (let i = 0; i < 10; i++) {
      talentOk = await page.evaluate(() => {
        const el = document.querySelector('.ui-talent-overlay');
        return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
      });
      if (talentOk) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }
    results.retry.replayToTalent = talentOk;
    await page.screenshot({ path: path.join(OUT, 'r84-5-replay-talent.png') });

    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  } finally {
    preview.kill();
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
