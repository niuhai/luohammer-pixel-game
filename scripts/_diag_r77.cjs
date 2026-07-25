// R77 诊断探针：F1b 选择后流程卡点 + F2 AUTO 内部状态
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4173/luohammer-pixel-game/';

const seed = (node, stage) => ({
  pride: 5, wealth: 3, reputation: 5, failures: 2, pressure: 0, trust: 4,
  pressureMax: 10, failurePenalty: 1, successBonus: 1,
  talentSpecials: [], currentStageId: stage, currentNode: node,
  flags: [], triggeredEvents: [], history: [], achievements: [],
  gameStartTime: Date.now() - 120000
});

async function openFresh(browser, node, stage) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((s) => {
    const j = JSON.stringify(s);
    localStorage.setItem('luohammer_save', j);
    localStorage.setItem('luohammer_save_backup', j);
    localStorage.setItem('luohammer_intro_seen', '1');
    localStorage.setItem('luohammer_kbd_hint_shown', '1');
  }, seed(node, stage));
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const btn = page.locator('button.ui-boot-btn-primary', { hasText: '继续游戏' });
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  return { ctx, page, continueBtn: btn };
}

const probeState = (page) => page.evaluate(() => {
  const sc = window.game && window.game.scene.getScene('GameScene');
  const vis = (id) => { const el = document.getElementById(id); return !!(el && (el.classList.contains('visible') || (el.style.display && el.style.display !== 'none'))); };
  const overlays = [];
  document.querySelectorAll('body > div, #ui-root > div').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05 && el.offsetHeight > 40) {
      overlays.push((el.id || el.className || el.tagName).toString().slice(0, 60));
    }
  });
  return {
    node: sc && sc.state ? sc.state.currentNode : null,
    dialogVisible: vis('ui-dialog'),
    choicesVisible: vis('ui-choices'),
    historyBtn: !!document.querySelector('.ui-history-note-btn, [class*="history"]'),
    autoPlay: sc && sc.dialog ? sc.dialog._autoPlay : null,
    isTyping: sc && sc.dialog ? sc.dialog.isTyping : null,
    segIdx: sc && sc.dialog ? sc.dialog._segmentIndex : null,
    segLen: sc && sc.dialog && sc.dialog._segments ? sc.dialog._segments.length : null,
    hasOnComplete: !!(sc && sc.dialog && sc.dialog.onComplete),
    speaking: sc && sc.audio ? sc.audio.isSpeaking() : null,
    ssSpeaking: window.speechSynthesis ? window.speechSynthesis.speaking : null,
    ssPending: window.speechSynthesis ? window.speechSynthesis.pending : null,
    seenNodes: JSON.parse(localStorage.getItem('luohammer_seen_nodes') || '{}'),
    overlays
  };
});

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ---- F1b 诊断：选择点击后 6 秒内流程状态采样 ----
  {
    const { ctx, page, continueBtn } = await openFresh(browser, 'act1_first', 'act1');
    await continueBtn.click();
    await page.waitForSelector('#ui-dialog.visible', { timeout: 15000 });
    // 推进到选项
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      const cv = await page.evaluate(() => {
        const c = document.getElementById('ui-choices');
        return !!(c && c.classList.contains('visible') && c.querySelectorAll('button').length > 0);
      });
      if (cv) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
    }
    const choices = await page.evaluate(() =>
      [...document.querySelectorAll('#ui-choices button')].map(b => ({ text: b.textContent.slice(0, 24), locked: b.classList.contains('locked') }))
    );
    console.log('CHOICES:', JSON.stringify(choices));
    await page.locator('.ui-choice-btn:not(.locked)').first().click();
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(1000);
      const s = await probeState(page);
      console.log(`T+${i + 1}s:`, JSON.stringify(s));
    }
    await ctx.close();
  }

  // ---- F2 诊断：AUTO 开启后内部状态采样 ----
  {
    const { ctx, page, continueBtn } = await openFresh(browser, 'act1_first', 'act1');
    await continueBtn.click();
    await page.waitForSelector('#ui-dialog.visible', { timeout: 15000 });
    await page.locator('#ui-dialog-auto').click();
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1500);
      const s = await probeState(page);
      console.log(`AUTO T+${(i + 1) * 1.5}s:`, JSON.stringify(s));
      if (s.choicesVisible) break;
    }
    await ctx.close();
  }

  await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
