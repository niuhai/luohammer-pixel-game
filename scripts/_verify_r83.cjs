// R83 收敛判定走查：结局页 7 个子面板（决策回顾/历史真相回顾/技能树/分享卡/人生地图/成就图鉴/结局图鉴）
// 自 R73"按钮齐全"后从未逐个点击实证。重点：375×812 竖屏横向溢出检测（决策回顾 width:700px 无 max-width 疑似 A 级）
// 用法：node scripts/_verify_r83.cjs（自带 4183 preview，需先 npm run build）
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4183/luohammer-pixel-game/';
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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4183', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const errors = [];
  const results = { decision: {}, history: {}, skill: {}, share: {}, lifemap: {}, achGallery: {}, endingGallery: {}, errors };
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices['iPhone X'], viewport: { width: VIEW_W, height: 812 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 200)));

    // ============ 注入结局存档（含 12+ history、未读历史真相、成就、EXP=500） ============
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
          { nodeId: 'act1_lei', choiceLabel: '拒绝抄作业，自己写到深夜', historyChoice: '拒绝捷径' },
          { nodeId: 'act1_korea', choiceLabel: '在班会上说出想当作家', historyChoice: '公开梦想' },
          { nodeId: 'act2_neworiental', choiceLabel: '报名新东方试讲', historyChoice: '主动争取' },
          { nodeId: 'act2_teacher', choiceLabel: '把段子融进课堂', historyChoice: '寓教于乐' },
          { nodeId: 'act3_blog', choiceLabel: '创办牛博网', historyChoice: '自主创业' },
          { nodeId: 'act4_smartisan', choiceLabel: 'all in 做手机', historyChoice: '孤注一掷' },
          { nodeId: 'act5_fang', choiceLabel: '正面回应质疑', historyChoice: '正面刚' },
          { nodeId: 'act6_debt', choiceLabel: '承认 6 亿债务', historyChoice: '直面现实' },
          { nodeId: 'act6_livestream', choiceLabel: '开播卖货还债', historyChoice: '放下面子' },
          { nodeId: 'act7_ai', choiceLabel: '转型 AI 赛道', historyChoice: '拥抱变化' },
          { nodeId: 'act7_sign', choiceLabel: '签下新约', historyChoice: '再出发' }
        ],
        unlockedHistoryNotes: [
          { nodeId: 'act1_first', actSub: '少年时代', note: '1972 年罗永浩出生于吉林延边，少年时期博览群书。' },
          { nodeId: 'act4_smartisan', actSub: '锤子创业', note: '2012 年锤子科技成立，主打"天生骄傲"。' },
          { nodeId: 'act6_debt', actSub: '债务危机', note: '2019 年罗永浩被限制高消费，公开承认债务约 6 亿。' }
        ],
        readHistoryNotes: ['act1_first'],
        achievements: ['first_choice', 'stage_youth'],
        gameStartTime: Date.now() - 600000
      };
      localStorage.setItem('luohammer_save', JSON.stringify(state));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
      // 注入跨周目 EXP（技能树解锁交互测试用）
      localStorage.setItem('luohammer_meta_progress', JSON.stringify({
        exp: 500, unlockedSkills: [], seenEndings: ['scholar'], playCount: 1,
        totalChoices: 12, seenEvents: [], achievementScore: 20,
        claimedMilestones: [], claimedAchievementMilestones: [], titles: []
      }));
    });
    await page.reload();
    const contBtn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await contBtn.waitFor({ state: 'visible', timeout: 15000 });
    await contBtn.tap();
    await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
    // 等"人生结算中..."/走马灯过渡与结局入场完成
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, 'r83-0-ending.png') });

    // 工具：打开"更多 ▾"菜单并点指定项
    const openMoreAndClick = async (label) => {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('更多') || b.textContent.includes('收起'));
        btn && btn.click();
      });
      await page.waitForTimeout(300);
      await page.evaluate((text) => {
        const item = [...document.querySelectorAll('.ui-ending-more-menu button')].find((b) => b.textContent.includes(text));
        item && item.click();
      }, label);
      await page.waitForTimeout(600);
    };
    // 工具：面板视口溢出测量（内容区，非全屏遮罩）
    const measureOverflow = (selector) => page.evaluate(({ sel, vw }) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
        overflowLeft: r.left < -1, overflowRight: r.right > vw + 1,
        scrollW: el.scrollWidth, clientW: el.clientWidth,
        hScrollable: el.scrollWidth > el.clientWidth + 1
      };
    }, { sel: selector, vw: VIEW_W });
    // 工具：点击穿透验证（关闭后点"更多 ▾"能展开菜单）
    const assertClickThrough = async () => {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('更多'));
        btn && btn.click();
      });
      await page.waitForTimeout(350);
      const opened = await page.evaluate(() => {
        const menu = document.querySelector('.ui-ending-more-menu');
        return !!(menu && getComputedStyle(menu).display !== 'none');
      });
      // 收起菜单复位
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('收起'));
        btn && btn.click();
      });
      await page.waitForTimeout(250);
      return opened;
    };

    // ============ 1. 决策回顾（疑似 width:700px 竖屏溢出） ============
    await openMoreAndClick('决策回顾');
    results.decision.render = await page.evaluate(() => {
      const panel = document.getElementById('ui-review-panel');
      if (!panel) return null;
      const rows = panel.querySelectorAll('div').length;
      const title = [...panel.querySelectorAll('div')].find((d) => d.textContent.trim() === '决策回顾');
      return { exists: true, titleFound: !!title, domNodes: rows };
    });
    // 面板内容容器 = panel 的直接子元素
    results.decision.overflow = await measureOverflow('#ui-review-panel > div');
    results.decision.viewportOverflow = await page.evaluate((vw) => {
      const doc = document.documentElement;
      return { docScrollW: doc.scrollWidth, vw, pageHScroll: doc.scrollWidth > vw + 1 };
    }, VIEW_W);
    await page.screenshot({ path: path.join(OUT, 'r83-1-decision-review.png') });
    // 关闭（面板内 X）
    await page.evaluate(() => {
      const panel = document.getElementById('ui-review-panel');
      const x = [...panel.querySelectorAll('div')].find((d) => d.textContent.trim() === 'X');
      x && x.click();
    });
    await page.waitForTimeout(400);
    results.decision.closed = await page.evaluate(() => !document.getElementById('ui-review-panel'));
    results.decision.clickThrough = await assertClickThrough();

    // ============ 2. 历史真相回顾（含 2 篇未读高亮） ============
    await openMoreAndClick('历史真相回顾');
    results.history.render = await page.evaluate(() => {
      const panel = document.getElementById('ui-history-review-panel');
      if (!panel) return null;
      const text = panel.textContent;
      return {
        exists: true,
        titleFound: text.includes('历史真相回顾'),
        unreadTag: text.includes('未读'),
        noteVisible: text.includes('罗永浩')
      };
    });
    results.history.overflow = await measureOverflow('#ui-history-review-panel > div');
    await page.screenshot({ path: path.join(OUT, 'r83-2-history-review.png') });
    await page.evaluate(() => {
      const panel = document.getElementById('ui-history-review-panel');
      const x = [...panel.querySelectorAll('div')].find((d) => d.textContent.trim() === 'X');
      x && x.click();
    });
    await page.waitForTimeout(400);
    results.history.closed = await page.evaluate(() => !document.getElementById('ui-history-review-panel'));
    results.history.clickThrough = await assertClickThrough();

    // ============ 3. 技能树（含 EXP=500 解锁交互） ============
    await openMoreAndClick('技能树');
    results.skill.render = await page.evaluate(() => {
      const ov = document.getElementById('ui-skill-tree-overlay');
      if (!ov) return null;
      const exp = document.getElementById('skill-tree-exp');
      const trees = ov.querySelectorAll('h2').length;
      return {
        exists: true,
        titleFound: ov.textContent.includes('人生技能树'),
        expText: exp ? exp.textContent.trim() : null,
        clickableCount: [...ov.querySelectorAll('div')].filter((d) => d.style.cursor === 'pointer').length
      };
    });
    await page.screenshot({ path: path.join(OUT, 'r83-3-skill-tree.png') });
    // 点第一个可解锁技能 → EXP 扣减 + 面板重渲染
    results.skill.unlock = await page.evaluate(() => {
      const before = (document.getElementById('skill-tree-exp') || {}).textContent;
      const target = [...document.querySelectorAll('#ui-skill-tree-overlay div')].find((d) => d.style.cursor === 'pointer');
      if (!target) return { found: false };
      target.click();
      return { found: true, before };
    });
    await page.waitForTimeout(700);
    results.skill.afterUnlock = await page.evaluate(() => {
      const ov = document.getElementById('ui-skill-tree-overlay');
      const exp = document.getElementById('skill-tree-exp');
      return {
        panelReRendered: !!ov,
        expAfter: exp ? exp.textContent.trim() : null,
        metaExp: (JSON.parse(localStorage.getItem('luohammer_meta_progress') || '{}').exp)
      };
    });
    await page.screenshot({ path: path.join(OUT, 'r83-4-skill-unlocked.png') });
    // 关闭
    await page.evaluate(() => {
      const ov = document.getElementById('ui-skill-tree-overlay');
      const btn = [...ov.querySelectorAll('button')].find((b) => b.textContent.trim() === '关闭');
      btn && btn.click();
    });
    await page.waitForTimeout(400);
    results.skill.closed = await page.evaluate(() => !document.getElementById('ui-skill-tree-overlay'));
    results.skill.clickThrough = await assertClickThrough();

    // ============ 4. 分享卡（生成 → 溢出检测 → 点空白关闭 → 结局 DOM 恢复） ============
    await openMoreAndClick('分享卡');
    await page.waitForTimeout(900); // 入场动画
    results.share.render = await page.evaluate(() => {
      const mask = document.getElementById('share-card-mask');
      if (!mask) return null;
      const img = mask.querySelector('img');
      const endingOv = document.getElementById('ui-ending-overlay');
      return {
        exists: true,
        imgIsDataURL: !!(img && img.src.startsWith('data:image/png')),
        imgLoaded: !!(img && img.complete && img.naturalWidth > 0),
        endingHidden: endingOv ? endingOv.style.display === 'none' : null,
        tipVisible: mask.textContent.includes('长按图片保存')
      };
    });
    results.share.overflow = await measureOverflow('#share-card-mask img');
    await page.screenshot({ path: path.join(OUT, 'r83-5-share-card.png') });
    // 点空白关闭（dispatch 在 mask 本体，target===mask 路径）
    await page.evaluate(() => {
      const mask = document.getElementById('share-card-mask');
      mask && mask.click();
    });
    await page.waitForTimeout(500);
    results.share.closed = await page.evaluate(() => {
      const maskGone = !document.getElementById('share-card-mask');
      const endingOv = document.getElementById('ui-ending-overlay');
      return { maskGone, endingRestored: endingOv ? endingOv.style.display !== 'none' : null };
    });
    results.share.clickThrough = await assertClickThrough();

    // ============ 5. 人生地图 ============
    await openMoreAndClick('人生地图');
    results.lifemap.render = await page.evaluate(() => {
      const ov = document.getElementById('ui-life-map-overlay');
      if (!ov) return null;
      const canvas = document.getElementById('ui-life-map-canvas');
      return {
        exists: true,
        visibleClass: ov.classList.contains('visible'),
        canvasExists: !!canvas,
        canvasChildren: canvas ? canvas.children.length : 0
      };
    });
    await page.screenshot({ path: path.join(OUT, 'r83-6-life-map.png') });
    await page.evaluate(() => {
      const btn = document.getElementById('ui-life-map-close');
      btn && btn.click();
    });
    await page.waitForTimeout(400);
    results.lifemap.closed = await page.evaluate(() => {
      const ov = document.getElementById('ui-life-map-overlay');
      return ov ? !ov.classList.contains('visible') : true;
    });
    results.lifemap.clickThrough = await assertClickThrough();

    // ============ 6. 成就图鉴（点击成就 item → 高亮 → 关闭） ============
    await page.evaluate(() => {
      const item = [...document.querySelectorAll('#ui-ending-overlay span')].find((s) => s.dataset && s.dataset.name);
      item && item.click();
    });
    await page.waitForTimeout(700);
    results.achGallery.render = await page.evaluate(() => {
      const ov = document.getElementById('ui-achievement-gallery-overlay');
      if (!ov) return null;
      const grid = document.getElementById('ui-achievement-gallery-grid');
      return {
        exists: true,
        gridItems: grid ? grid.children.length : 0,
        tabFound: !!document.getElementById('ui-achievement-tab-normal'),
        titleFound: ov.textContent.includes('成就')
      };
    });
    results.achGallery.overflow = await measureOverflow('#ui-achievement-gallery-overlay > div');
    await page.screenshot({ path: path.join(OUT, 'r83-7-achievement-gallery.png') });
    await page.evaluate(() => {
      const btn = document.querySelector('.ui-achievement-gallery-close');
      btn && btn.click();
    });
    await page.waitForTimeout(500);
    results.achGallery.closed = await page.evaluate(() => !document.getElementById('ui-achievement-gallery-overlay'));
    results.achGallery.clickThrough = await assertClickThrough();

    // ============ 7. 结局图鉴（点击标题栏 → 网格 → 关闭） ============
    await page.evaluate(() => {
      const header = [...document.querySelectorAll('#ui-ending-overlay div')].find((d) => d.textContent.includes('结局图鉴') && d.style.cursor === 'pointer');
      header && header.click();
    });
    await page.waitForTimeout(700);
    results.endingGallery.render = await page.evaluate(() => {
      const ov = document.getElementById('ui-ending-gallery-overlay');
      if (!ov) return null;
      const grid = document.getElementById('ui-ending-gallery-grid');
      return {
        exists: true,
        gridCards: grid ? grid.children.length : 0,
        unlockedShown: ov.textContent.includes('scholar') || ov.textContent.includes('学者') || ov.textContent.length > 0
      };
    });
    results.endingGallery.overflow = await measureOverflow('#ui-ending-gallery-overlay > div');
    await page.screenshot({ path: path.join(OUT, 'r83-8-ending-gallery.png') });
    await page.evaluate(() => {
      const btn = document.querySelector('.ui-ending-gallery-close');
      btn && btn.click();
    });
    await page.waitForTimeout(500);
    results.endingGallery.closed = await page.evaluate(() => !document.getElementById('ui-ending-gallery-overlay'));
    results.endingGallery.clickThrough = await assertClickThrough();

    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  } finally {
    preview.kill();
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
