// 演示视频自动录制：按复赛帖分镜脚本录 5 段（无声画面初稿）
// 生产模式（vite preview :4173），1280x720
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4173/luohammer-pixel-game/';
const OUT = path.resolve('demo-footage');
fs.mkdirSync(OUT, { recursive: true });

const SAVE = (node, over = {}) => {
  const state = {
    pride: 6, wealth: 3, reputation: 6, failures: 2, pressure: 5, trust: 5,
    pressureMax: 10, failurePenalty: 1, successBonus: 1,
    talentSpecials: [], currentStageId: 'youth', currentNode: node,
    flags: [], triggeredEvents: [], history: [], achievements: [],
    gameStartTime: Date.now() - 180000, ...over
  };
  return `localStorage.clear();
    localStorage.setItem('luohammer_save', JSON.stringify(${JSON.stringify(state)}));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(${JSON.stringify(state)}));`;
};

async function recordSegment(name, fn) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT, size: { width: 1280, height: 720 } }
  });
  const page = await ctx.newPage();
  try {
    await fn(page);
  } catch (e) {
    console.log(`[${name}] WARN:`, e.message.split('\n')[0]);
  }
  await ctx.close(); // 关闭时写视频
  await browser.close();
  // 重命名最新视频
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.webm')).map(f => ({ f, t: fs.statSync(path.join(OUT, f)).mtimeMs }));
  files.sort((a, b) => b.t - a.t);
  if (files[0]) fs.renameSync(path.join(OUT, files[0].f), path.join(OUT, `${name}.webm`));
  console.log(`[${name}] recorded`);
}

const continueGame = async (page) => {
  const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  await btn.click();
};

(async () => {
  // ===== 段1：标题页（0:00-0:15） =====
  await recordSegment('seg1-title', async (page) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.mouse.move(640, 400);
    await page.waitForTimeout(5000); // 打字机金句
    // 展开"怎么玩"再收起（展示指引）
    const guide = page.locator('#ui-boot-guide-toggle');
    if (await guide.isVisible().catch(() => false)) {
      await guide.click(); await page.waitForTimeout(1800);
      await guide.click(); await page.waitForTimeout(600);
    }
    await page.waitForTimeout(3000);
  });

  // ===== 段2：天赋抽取（0:30-0:45） =====
  await recordSegment('seg2-talent', async (page) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
    const intro = page.locator('#ui-intro-overlay');
    await page.waitForTimeout(2500);
    if (await intro.isVisible().catch(() => false)) await intro.click({ force: true });
    await page.locator('#ui-talent-overlay').waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(1500);
    // hover 传说卡看一眼，再选两张
    const cards = page.locator('#ui-talent-cards .ui-talent-card');
    await cards.nth(0).hover(); await page.waitForTimeout(1200);
    await cards.nth(0).click(); await page.waitForTimeout(500);
    await cards.nth(1).hover(); await page.waitForTimeout(900);
    await cards.nth(1).click(); await page.waitForTimeout(700);
    await page.locator('#ui-talent-confirm').click();
    await page.waitForTimeout(2500);
  });

  // ===== 段3：核心玩法（0:45-1:30） =====
  await recordSegment('seg3-gameplay', async (page) => {
    await page.goto(BASE);
    await page.evaluate(SAVE('act0_dad', { pride: 4, wealth: 3, reputation: 3 }));
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await continueGame(page);
    await page.locator('#ui-dialog.visible').waitFor({ timeout: 20000 });
    // 选项出现后做 2 次选择
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 16; i++) {
        if (await page.locator('#ui-choices .ui-choice-btn').first().isVisible().catch(() => false)) break;
        await page.locator('#ui-dialog').click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(1500);
      const c = page.locator('#ui-choices .ui-choice-btn').first();
      if (await c.isVisible().catch(() => false)) {
        await c.hover(); await page.waitForTimeout(800);
        await c.click();
        await page.waitForTimeout(2500);
        // 处理历史真相/结算等覆盖层
        const skip = page.locator('#ui-history-note-skip');
        if (await skip.isVisible().catch(() => false)) { await page.waitForTimeout(1500); await skip.click().catch(() => {}); }
        const settle = page.locator('#ui-settlement-continue');
        if (await settle.isVisible().catch(() => false)) { await settle.click().catch(() => {}); }
        await page.waitForTimeout(1500);
      }
    }
  });

  // ===== 段4：杀手时刻 6 亿（1:30-2:00） =====
  await recordSegment('seg4-killer', async (page) => {
    await page.goto(BASE);
    await page.evaluate(SAVE('act6_night', { pride: 6, wealth: 1, reputation: 6, failures: 3, pressure: 7, trust: 4, currentStageId: 'act6' }));
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await continueGame(page);
    await page.waitForTimeout(11000); // 砸数字 → AI 点评（scrim 背板）全程
  });

  // ===== 段5：结局 + AI 复盘（2:00-2:30） =====
  await recordSegment('seg5-ending', async (page) => {
    await page.goto(BASE);
    await page.evaluate(SAVE('ending_scholar', { pride: 7, wealth: 5, reputation: 6, failures: 2, pressure: 3, trust: 6 }));
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    await continueGame(page);
    await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30000 });
    await page.waitForTimeout(4000); // 结局全景
    const aiBtn = page.locator('button', { hasText: 'AI 人生复盘' });
    if (await aiBtn.isVisible().catch(() => false)) {
      await aiBtn.click();
      await page.waitForTimeout(9000); // 打字机复盘
    }
  });

  console.log('ALL SEGMENTS DONE');
})();
