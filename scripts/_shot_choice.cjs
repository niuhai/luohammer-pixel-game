// 截产品图：剧情选择界面（选项按钮可见）→ demo-footage/screenshots/choice-desktop.png
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:4173/luohammer-pixel-game/';
const OUT = path.resolve('demo-footage/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const state = {
  pride: 5, wealth: 3, reputation: 4, failures: 2, pressure: 4, trust: 5,
  pressureMax: 10, failurePenalty: 1, successBonus: 1,
  talentSpecials: [], currentStageId: 'youth', currentNode: 'act0_dad',
  flags: [], triggeredEvents: [], history: [], achievements: [],
  gameStartTime: Date.now() - 120000
};

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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.evaluate((s) => {
      localStorage.clear();
      localStorage.setItem('luohammer_save', JSON.stringify(s));
      localStorage.setItem('luohammer_save_backup', JSON.stringify(s));
    }, state);
    await page.reload();
    const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
    await btn.waitFor({ state: 'visible', timeout: 20000 });
    await btn.click();
    await page.locator('#ui-dialog.visible').waitFor({ timeout: 20000 });
    // 推进到选项出现（最多 30 轮）
    for (let i = 0; i < 30; i++) {
      if (await page.locator('#ui-choices .ui-choice-btn').first().isVisible().catch(() => false)) break;
      await page.locator('#ui-dialog').click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const choice = page.locator('#ui-choices .ui-choice-btn').first();
    if (!(await choice.isVisible().catch(() => false))) throw new Error('choices never appeared');
    await page.waitForTimeout(600); // 入场动画稳定
    await page.screenshot({ path: path.join(OUT, 'choice-desktop.png') });
    console.log('captured choice-desktop.png');
    await browser.close();
  } finally {
    preview.kill();
  }
})();
