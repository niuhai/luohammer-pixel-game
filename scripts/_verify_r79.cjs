// R79 收敛判定走查：随机事件卡 + AI复盘面板点击穿透（R47/R29 后无近期浏览器实证的两条路径）
// 用法：node scripts/_verify_r79.cjs（自带 4179 preview，生产构建）
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4179/luohammer-pixel-game/';
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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4179', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const errors = [];
  const results = { event: {}, ai: {}, errors };
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices['iPhone X'], viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    // ============ Part 1: 随机事件卡（真实流程 + 强制随机数触发） ============
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).tap();

    // 跳过 IntroScene 星图开场 → 天赋选择
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
    await page.waitForTimeout(800);
    // 选 2 张天赋（evaluate dispatch，避免 scroll-into-view 伪影）
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
    await page.evaluate(() => {
      const btn = document.querySelector('#ui-talent-confirm')
        || [...document.querySelectorAll('button')].find((b) => b.textContent.includes('带着这'));
      btn && btn.click();
    });
    // 等 GameScene 就绪且随机事件系统已挂载
    await page.waitForFunction(() => {
      const s = window.game && window.game.scene.getScene('GameScene');
      return s && s.randomEventSystem;
    }, { timeout: 15000 });
    await page.waitForTimeout(1500);

    // 强制触发：节流派 0 + Math.random 固定 0.01（必中小于任何 stage chance）
    await page.evaluate(() => {
      const s = window.game.scene.getScene('GameScene');
      s.randomEventSystem._minNodesBetweenEvents = 0;
      window.__origRandom = Math.random;
      Math.random = () => 0.01;
    });

    // 空格/选项交替推进直到随机事件 overlay 出现
    // 注意：tryTrigger 只在 _proceedAfterChoice（点选项）后调用，纯空格推进不触发
    let eventShown = false;
    for (let i = 0; i < 24; i++) {
      eventShown = await page.evaluate(() => {
        const el = document.getElementById('ui-random-event-overlay');
        return !!(el && el.classList.contains('visible') && el.offsetHeight > 0);
      });
      if (eventShown) break;
      const clicked = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.ui-choice-btn')].find((b) => b.offsetHeight > 0);
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!clicked) await page.keyboard.press('Space');
      await page.waitForTimeout(900);
    }
    results.event.shown = eventShown;
    if (!eventShown) throw new Error('随机事件未触发（24 轮推进）');
    await page.waitForTimeout(600); // 入场动画

    // 断言：标题/描述/选项渲染 + 热区尺寸
    results.event.render = await page.evaluate(() => {
      const title = document.getElementById('ui-random-event-title');
      const body = document.getElementById('ui-random-event-body');
      const btns = [...document.querySelectorAll('#ui-random-event-choices button')];
      const rects = btns.map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
      return {
        title: title ? title.textContent.trim().slice(0, 30) : null,
        bodyLen: body ? body.textContent.trim().length : 0,
        btnCount: btns.length,
        btnRects: rects,
        minBtnH: rects.length ? Math.min(...rects.map((r) => r.h)) : 0
      };
    });
    await page.screenshot({ path: path.join(OUT, 'r79-1-event-card.png') });

    // 点击第一个选项 → 反馈 → 自动关闭
    await page.evaluate(() => {
      const btn = document.querySelector('#ui-random-event-choices button');
      btn && btn.click();
    });
    await page.waitForTimeout(900); // 反馈条目 stagger 入场中段
    results.event.feedbackVisible = await page.evaluate(() => {
      const el = document.getElementById('ui-random-event-feedback');
      return !!(el && el.classList.contains('visible'));
    });
    await page.screenshot({ path: path.join(OUT, 'r79-2-event-feedback.png') });

    // 等反馈结束 + 关闭动画（1.8s+stagger+缓冲 → 给 4s）
    await page.waitForTimeout(4000);
    results.event.closedState = await page.evaluate(() => {
      const el = document.getElementById('ui-random-event-overlay');
      const r = el.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const at = document.elementFromPoint(cx, cy);
      return {
        visibleClass: el.classList.contains('visible'),
        peNone: getComputedStyle(el).pointerEvents === 'none',
        centerEl: at === el ? 'OVERLAY-BLOCKING' : (at ? (at.id || at.className || at.tagName) : 'null')
      };
    });
    // 恢复 Math.random
    await page.evaluate(() => { if (window.__origRandom) Math.random = window.__origRandom; });
    await page.screenshot({ path: path.join(OUT, 'r79-3-event-closed.png') });

    // ============ Part 2: AI 复盘面板（注入结局存档 → 开/关 → 点击穿透） ============
    await page.evaluate(() => {
      localStorage.clear();
      const state = {
        pride: 6, wealth: 5, reputation: 5, failures: 0, pressure: 2, trust: 5,
        pressureMax: 10, failurePenalty: 1, successBonus: 1,
        talentSpecials: [], currentStageId: 'youth', currentNode: 'ending_scholar',
        flags: [], triggeredEvents: [],
        history: [
          { choiceLabel: '坚持背诵《理想》课文' },
          { choiceLabel: '拒绝抄作业，自己写到深夜' },
          { choiceLabel: '在班会上说出想当作家' }
        ],
        achievements: [],
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
    await page.waitForTimeout(2500); // 结局入场 + 雷达动画
    await page.screenshot({ path: path.join(OUT, 'r79-4-ending.png') });

    // 打开 AI 复盘
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('AI 人生复盘'));
      btn && btn.click();
    });
    await page.waitForSelector('.ai-review-overlay.visible', { timeout: 8000 });
    // 等生成完成（source 标签有文本 = generate() 已返回；离线走本地引擎应秒回）
    await page.waitForFunction(() => {
      const el = document.querySelector('.ai-review-source');
      return el && el.textContent.trim().length > 0;
    }, { timeout: 12000 });
    await page.waitForTimeout(2500); // 打字机写一段
    results.ai.openState = await page.evaluate(() => {
      const body = document.querySelector('.ai-review-body');
      const src = document.querySelector('.ai-review-source');
      return {
        source: src ? src.textContent.trim() : null,
        typedLen: body ? body.textContent.trim().length : 0
      };
    });
    await page.screenshot({ path: path.join(OUT, 'r79-5-ai-review.png') });

    // 关闭 → 断言 DOM 移除 + 结局层点击穿透（点"更多 ▾"菜单能展开）
    await page.evaluate(() => {
      const btn = document.querySelector('.ai-review-close');
      btn && btn.click();
    });
    await page.waitForTimeout(600); // 350ms 移除 + 余量
    results.ai.afterClose = await page.evaluate(() => {
      const leftover = document.querySelector('.ai-review-overlay');
      const moreBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('更多'));
      return { overlayLeftover: !!leftover, moreBtnFound: !!moreBtn };
    });
    // 点击穿透实测：点"更多 ▾"应展开菜单
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('更多'));
      btn && btn.click();
    });
    await page.waitForTimeout(400);
    results.ai.clickThrough = await page.evaluate(() => {
      const menu = document.querySelector('.ui-ending-more-menu');
      const visible = menu && getComputedStyle(menu).display !== 'none';
      return { moreMenuOpened: !!visible };
    });
    await page.screenshot({ path: path.join(OUT, 'r79-6-after-ai-close.png') });

    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  } finally {
    preview.kill();
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
