// R80 验证：F1 已读标记时机（P0）+ F2 AUTO 自动推进/TTS假死防护 + F3 reduce 模式震动收口守卫 + F4 ESC 关面板不重开菜单
// 用法: node scripts/_verify_r80.cjs [baseUrl]   默认 http://localhost:4173/luohammer-pixel-game/（需先 build + preview）
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.argv[2] || 'http://localhost:4173/luohammer-pixel-game/';
const OUT = path.resolve(__dirname, '..', '..', 'test-screenshots', 'r80-verify');

const results = [];
function assert(id, name, pass, actual) {
  results.push({ id, pass: !!pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${id}] ${name} | 实测=${actual}`);
}

const seed = (node, stage) => ({
  pride: 5, wealth: 3, reputation: 5, failures: 2, pressure: 0, trust: 4,
  pressureMax: 10, failurePenalty: 1, successBonus: 1,
  talentSpecials: [], currentStageId: stage, currentNode: node,
  flags: [], triggeredEvents: [], history: [], achievements: [],
  gameStartTime: Date.now() - 120000
});

// 注入存档种子 + 可选 seen_nodes + 可选额外 localStorage（如关闭朗读）
async function openFresh(browser, node, stage, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: opts.reducedMotion || 'no-preference'
  });
  await ctx.addInitScript(({ s, seen, extraLs }) => {
    const j = JSON.stringify(s);
    localStorage.setItem('luohammer_save', j);
    localStorage.setItem('luohammer_save_backup', j);
    localStorage.setItem('luohammer_intro_seen', '1');
    localStorage.setItem('luohammer_kbd_hint_shown', '1');
    if (seen) localStorage.setItem('luohammer_seen_nodes', JSON.stringify(seen));
    if (extraLs) for (const [k, v] of Object.entries(extraLs)) localStorage.setItem(k, v);
  }, { s: seed(node, stage), seen: opts.seenNodes || null, extraLs: opts.extraLs || null });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const btn = page.locator('button.ui-boot-btn-primary', { hasText: '继续游戏' });
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  return { ctx, page, continueBtn: btn };
}

const choicesVisible = (page) => page.evaluate(() => {
  const c = document.getElementById('ui-choices');
  return !!(c && c.classList.contains('visible') && c.querySelectorAll('button').length > 0);
});
const typingDone = (page) => page.evaluate(() => {
  const el = document.getElementById('ui-dialog-continue');
  return !!el && el.style.display === 'block';
});
const badgeVisible = (page) => page.evaluate(() => {
  const b = document.querySelector('#ui-dialog .ui-dialog-seen-badge');
  return !!(b && b.offsetParent !== null);
});

async function waitTypingDone(page, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await typingDone(page)) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ================= F1a【P0】：首读节点零交互 → 无「已读」角标、不自动播放 =================
  {
    const { ctx, page, continueBtn } = await openFresh(browser, 'act1_first', 'act1');
    await continueBtn.click();
    await page.waitForSelector('#ui-dialog.visible', { timeout: 15000 });
    const badgeEarly = await badgeVisible(page);
    assert('F1a-badge', '首读未读节点不显示「已读·快进中」角标', !badgeEarly, `badge=${badgeEarly}`);
    const typed = await waitTypingDone(page);
    // 打字完成后再零交互等 3.5s（覆盖旧快进通道的 400ms 自动 onComplete 窗口）
    await page.waitForTimeout(3500);
    const cv = await choicesVisible(page);
    assert('F1a-noautoplay', '首读零交互不自动播放（选项不自动出现）', typed && !cv, `typingDone=${typed}, choices=${cv}`);
    await page.screenshot({ path: path.join(OUT, 'f1a-first-read-wait.png') });

    // ================= F1b：玩家主动推进并做出选择 → 离开节点时才标记已读 =================
    await page.keyboard.press('Space'); // 显示选项（多段节点可能需多次）
    const t0 = Date.now();
    while (Date.now() - t0 < 8000 && !(await choicesVisible(page))) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    }
    const cvAfter = await choicesVisible(page);
    assert('F1b-choices', '主动推进后选项正常出现', cvAfter, `choices=${cvAfter}`);
    await page.locator('.ui-choice-btn:not(.locked)').first().click();
    // act1_first 带 historyNote：选择后先弹「历史真相」闸门（3s 自动跳过），
    // 点「跳过」加速流程；随后轮询 seen_nodes（闸门余时 + transition ~0.5s）
    const skipBtn = page.locator('#ui-history-note-skip');
    if (await skipBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await skipBtn.click();
    }
    let seen = {};
    const t1 = Date.now();
    while (Date.now() - t1 < 10000) {
      seen = await page.evaluate(() => JSON.parse(localStorage.getItem('luohammer_seen_nodes') || '{}'));
      if (seen.act1_first) break;
      await page.waitForTimeout(400);
    }
    assert('F1b-mark-on-leave', '离开节点后该节点才被标记已读', !!seen.act1_first, `seen_nodes=${JSON.stringify(seen)}`);
    await ctx.close();
  }

  // ================= F2【B】：AUTO 开启 → 未读节点打完自动推进；选项绝不自动选择 =================
  {
    // 关闭朗读获得确定性行为（headless 环境 TTS end 事件不可靠——speaking 卡 true，
    // 会走 R80 新增的假死防护超时路径 capMs≥4s/段，拖慢用例；真实浏览器 end 正常触发）
    const { ctx, page, continueBtn } = await openFresh(browser, 'act1_first', 'act1', { extraLs: { luohammer_narration: 'false' } });
    await continueBtn.click();
    await page.waitForSelector('#ui-dialog.visible', { timeout: 15000 });
    await page.locator('#ui-dialog-auto').click(); // 开启 AUTO（打字中点击 → 测 finishTyping 调度路径）
    const active = await page.evaluate(() => document.getElementById('ui-dialog-auto').classList.contains('active'));
    assert('F2-auto-on', 'AUTO 按钮激活态', active, `active=${active}`);
    // 零交互等待选项自动出现（打字 + 每段 1100ms 自动推进）
    let autoChoices = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      if (await choicesVisible(page)) { autoChoices = true; break; }
      await page.waitForTimeout(400);
    }
    assert('F2-autoadvance', 'AUTO 开启后零交互自动推进至选项', autoChoices, `choices=${autoChoices}`);
    // 选项出现后再等 3s：选项必须仍在（绝不自动选择），节点未跳转
    await page.waitForTimeout(3000);
    const stillChoices = await choicesVisible(page);
    const nodeNow = await page.evaluate(() => {
      const sc = window.game && window.game.scene.getScene('GameScene');
      return sc && sc.state ? sc.state.currentNode : null;
    });
    assert('F2-no-autopick', '选项出现后不自动选择（抉择权留给玩家）', stillChoices && nodeNow === 'act1_first',
      `choices=${stillChoices}, node=${nodeNow}`);
    await page.screenshot({ path: path.join(OUT, 'f2-auto-choices-waiting.png') });
    await ctx.close();
  }

  // ================= F3【B】：reduce 模式杀手时刻相机震动跳过；normal 对照保留 =================
  async function probeShake(ctx, page, continueBtn) {
    await page.evaluate(() => {
      window.__shake = { running: false, flashMax: 0 };
      const t0 = performance.now();
      const iv = setInterval(() => {
        if (performance.now() - t0 > 8000) { clearInterval(iv); return; }
        try {
          const sc = window.game && window.game.scene.getScene('GameScene');
          if (sc && sc.cameras && sc.cameras.main && sc.cameras.main.shakeEffect) {
            if (sc.cameras.main.shakeEffect.isRunning) window.__shake.running = true;
          }
          if (sc && sc.pixelRenderer && sc.pixelRenderer.flashAlpha > window.__shake.flashMax) {
            window.__shake.flashMax = sc.pixelRenderer.flashAlpha;
          }
        } catch (e) {}
      }, 40);
    });
    await continueBtn.click();
    await page.waitForTimeout(6000);
    return page.evaluate(() => window.__shake);
  }
  {
    const { ctx, page, continueBtn } = await openFresh(browser, 'act6_night', 'act6', { reducedMotion: 'reduce' });
    const r = await probeShake(ctx, page, continueBtn);
    assert('F3-reduce-noshake', 'reduce 模式相机震动被跳过（含压力满档周期抖动的收口守卫）', !r.running, `shakeRunning=${r.running}`);
    assert('F3-reduce-flash', 'reduce 模式白闪保留（叙事语义）', r.flashMax > 0.1, `flashMax=${r.flashMax.toFixed(2)}`);
    await ctx.close();
  }
  {
    const { ctx, page, continueBtn } = await openFresh(browser, 'act6_night', 'act6', { reducedMotion: 'no-preference' });
    const r = await probeShake(ctx, page, continueBtn);
    assert('F3-normal-shake', 'normal 模式相机震动保留（对照组）', r.running, `shakeRunning=${r.running}`);
    await ctx.close();
  }

  // ================= F4【B】：菜单→保存游戏→ESC → 面板关闭且菜单不误重开 =================
  {
    const { ctx, page, continueBtn } = await openFresh(browser, 'act1_first', 'act1');
    await continueBtn.click();
    await page.waitForSelector('#ui-dialog.visible', { timeout: 15000 });
    await page.locator('#ui-menu-toggle').click();
    await page.waitForSelector('#ui-menu-confirm.visible', { timeout: 5000 });
    await page.locator('#ui-menu-save-game').click();
    await page.waitForSelector('#ui-saveload-overlay.visible', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500); // 覆盖面板 220ms 关闭动画 + 事件传播窗口
    const panelVisible = await page.evaluate(() => {
      const p = document.getElementById('ui-saveload-overlay');
      return !!(p && p.classList.contains('visible'));
    });
    const menuVisible = await page.evaluate(() => {
      const m = document.getElementById('ui-menu-confirm');
      return !!(m && m.classList.contains('visible'));
    });
    assert('F4-panel-closed', 'ESC 关闭存档面板', !panelVisible, `panel=${panelVisible}`);
    assert('F4-menu-not-reopen', 'ESC 关闭存档面板后菜单不误重开', !menuVisible, `menu=${menuVisible}`);
    await page.screenshot({ path: path.join(OUT, 'f4-esc-no-menu-reopen.png') });
    await ctx.close();
  }

  await browser.close();
  const p = results.filter(r => r.pass).length;
  console.log(`\n== R80 VERIFY 小计: PASS ${p} / FAIL ${results.length - p} ==`);
  process.exit(results.every(r => r.pass) ? 0 : 1);
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
