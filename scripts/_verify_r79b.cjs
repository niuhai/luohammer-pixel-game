// R79b verify: F1 seen-timing / F2 AUTO advance / F3 reduced-motion / F4 ESC bubble
// usage: node scripts/_verify_r79b.cjs (spawns 4182 preview, run npm run build first)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const BASE = 'http://localhost:4182/luohammer-pixel-game/';
let fails = 0;
const check = (name, cond, detail) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  ' + detail : ''));
  if (!cond) fails++;
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

async function newGameToDialog(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click();
  for (let i = 0; i < 10; i++) {
    const talentVisible = await page.evaluate(() => {
      const el = document.querySelector('.ui-talent-overlay');
      return el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0;
    });
    if (talentVisible) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(650);
  }
  await page.waitForSelector('.ui-talent-card', { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.ui-talent-card:not(.locked)')];
    c[0] && c[0].click();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.ui-talent-card:not(.locked):not(.selected)')];
    c[0] && c[0].click();
  });
  await page.waitForFunction(() => {
    const b = document.querySelector('#ui-talent-confirm');
    return b && !b.disabled;
  }, { timeout: 8000 });
  await page.evaluate(() => {
    const b = document.querySelector('#ui-talent-confirm')
      || [...document.querySelectorAll('button')].find((x) => x.textContent.includes('带着这'));
    b && b.click();
  });
  await page.waitForFunction(() => {
    const s = window.game && window.game.scene.getScene('GameScene');
    return s && s.dialog && document.querySelector('#ui-dialog');
  }, { timeout: 20000 });
  await page.waitForTimeout(1200);
}

const sceneEval = (fn) => `(() => { const s = window.game.scene.getScene('GameScene'); return (${fn})(s); })()`;

(async () => {
  const preview = spawn('npx', ['vite', 'preview', '--port', '4182', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();

    // ===== F1: first-read NOT seen / mark on leave / re-enter fast-forwards =====
    {
      const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(F1):', String(e).slice(0, 120)));
      await newGameToDialog(page);

      const f1a = await page.evaluate(sceneEval(`(s) => ({
        seen: s.dialog._isSeenNode,
        badge: !!document.querySelector('.ui-dialog-seen-badge'),
        auto: s.dialog._autoPlay,
        node: s.state.currentNode
      })`));
      check('F1a first-read _isSeenNode=false', f1a.seen === false, JSON.stringify(f1a));
      check('F1b first-read no seen-badge', f1a.badge === false);

      if (f1a.auto) {
        await page.locator('#ui-dialog-auto').click();
        await page.waitForTimeout(200);
      }
      await page.waitForFunction(sceneEval(`(s) => !s.dialog.isTyping`), { timeout: 30000 });
      const snap2 = await page.evaluate(sceneEval(`(s) => ({ seg: s.dialog._segmentIndex, cb: !!s.dialog.onComplete })`));
      await page.waitForTimeout(2500);
      const snap3 = await page.evaluate(sceneEval(`(s) => ({
        seg: s.dialog._segmentIndex, cb: !!s.dialog.onComplete,
        choices: !!document.querySelector('.ui-choices.visible')
      })`));
      const advanced = snap3.seg !== snap2.seg || (snap2.cb && !snap3.cb && snap3.choices);
      check('F1c first-read no auto-advance in 2.5s idle', !advanced, JSON.stringify({ snap2, snap3 }));

      const node0 = await page.evaluate(sceneEval(`(s) => s.state.currentNode`));
      for (let i = 0; i < 12; i++) {
        const hasChoices = await page.evaluate(() =>
          [...document.querySelectorAll('.ui-choice-btn')].some((b) => b.offsetHeight > 0 && !b.disabled));
        if (hasChoices) break;
        await page.keyboard.press('Space');
        await page.waitForTimeout(700);
      }
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('.ui-choice-btn')].find((x) => x.offsetHeight > 0 && !x.disabled);
        b && b.click();
      });
      await page.waitForFunction(sceneEval(`(s) => s.state.currentNode !== '${node0}'`), { timeout: 12000 });
      await page.evaluate(sceneEval(`(s) => s.loadNode('${node0}')`));
      await page.waitForTimeout(1000);
      const f1d = await page.evaluate(sceneEval(`(s) => ({
        seen: s.dialog._isSeenNode,
        badge: !!document.querySelector('.ui-dialog-seen-badge')
      })`));
      check('F1d re-enter seen node fast-forwards (seen=true + badge)', f1d.seen === true && f1d.badge === true, JSON.stringify(f1d));
      await page.close();
    }

    // ===== F2: AUTO auto-advances after typing / never auto-picks choices =====
    {
      const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(F2):', String(e).slice(0, 120)));
      await newGameToDialog(page);
      await page.evaluate(sceneEval(`(s) => { s.dialog.audio = s.dialog.audio || {}; s.dialog.audio.isSpeaking = () => false; s.dialog.audio.onceSpeechEnd = () => {}; }`));
      const wasAuto = await page.evaluate(sceneEval(`(s) => s.dialog._autoPlay`));
      if (!wasAuto) await page.locator('#ui-dialog-auto').click();
      await page.waitForTimeout(200);
      check('F2a AUTO enabled', await page.evaluate(sceneEval(`(s) => s.dialog._autoPlay`)) === true);

      await page.waitForFunction(sceneEval(`(s) => !s.dialog.isTyping`), { timeout: 30000 });
      const seg0 = await page.evaluate(sceneEval(`(s) => s.dialog._segmentIndex`));
      let autoAdvanced = false;
      const t0 = Date.now();
      while (Date.now() - t0 < 6000) {
        const st = await page.evaluate(sceneEval(`(s) => ({
          seg: s.dialog._segmentIndex,
          choices: !!document.querySelector('.ui-choices.visible')
        })`));
        if (st.seg > seg0 || st.choices) { autoAdvanced = true; break; }
        await page.waitForTimeout(250);
      }
      check('F2b AUTO advances after typing (zero interaction)', autoAdvanced);

      for (let i = 0; i < 14; i++) {
        const hasChoices = await page.evaluate(() => !!document.querySelector('.ui-choices.visible'));
        if (hasChoices) break;
        await page.waitForTimeout(500);
      }
      const nodeBefore = await page.evaluate(sceneEval(`(s) => s.state.currentNode`));
      await page.waitForTimeout(2500);
      const f2d = await page.evaluate(sceneEval(`(s) => ({
        node: s.state.currentNode,
        choices: !!document.querySelector('.ui-choices.visible')
      })`));
      check('F2c choices never auto-picked in 2.5s', f2d.choices === true && f2d.node === nodeBefore, JSON.stringify(f2d));
      await page.close();
    }

    // ===== F3: reduced-motion skips camera shake (keeps flash) =====
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(F3):', String(e).slice(0, 120)));
      await page.goto(BASE);
      await page.evaluate(() => {
        localStorage.clear();
        const state = {
          pride: 5, wealth: 3, reputation: 5, failures: 2, pressure: 5, trust: 4,
          pressureMax: 10, failurePenalty: 1, successBonus: 1,
          talentSpecials: [], currentStageId: 'act6', currentNode: 'act6_night',
          flags: [], triggeredEvents: [], history: [], achievements: [],
          gameStartTime: Date.now() - 120000
        };
        localStorage.setItem('luohammer_save', JSON.stringify(state));
        localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
      });
      await page.reload();
      const btn = page.locator('#ui-boot-buttons button', { hasText: '继续游戏' });
      await btn.waitFor({ state: 'visible', timeout: 20000 });
      await btn.click();
      await page.waitForFunction(sceneEval(`(s) => !!(s && s.transition && s.pixelRenderer)`), { timeout: 20000 });
      await page.waitForTimeout(1500);

      await page.evaluate(sceneEval(`(s) => {
        window.__shakeN = 0; window.__flashN = 0;
        const os = s.transition.shake.bind(s.transition);
        s.transition.shake = (...a) => { window.__shakeN++; return os(...a); };
        const of = s.pixelRenderer.flashScreen.bind(s.pixelRenderer);
        s.pixelRenderer.flashScreen = (...a) => { window.__flashN++; return of(...a); };
        s._lastKillerNode = null;
        s.loadNode('act6_crash');
        return true;
      }`));
      await page.waitForTimeout(1600);
      const f3a = await page.evaluate(() => ({ shake: window.__shakeN, flash: window.__flashN }));
      check('F3a reduced-motion skips shake', f3a.shake === 0, JSON.stringify(f3a));
      check('F3b reduced-motion keeps flash', f3a.flash > 0);

      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(sceneEval(`(s) => { s._lastKillerNode = null; s.loadNode('act6_night'); return true; }`));
      await page.waitForTimeout(1600);
      const f3c = await page.evaluate(() => ({ shake: window.__shakeN }));
      check('F3c no-preference restores shake (control)', f3c.shake > 0, JSON.stringify(f3c));
      await ctx.close();
    }

    // ===== F4: save panel ESC does not bubble to reopen menu =====
    {
      const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(F4):', String(e).slice(0, 120)));
      await newGameToDialog(page);
      await page.locator('#ui-menu-toggle').click();
      await page.waitForSelector('#ui-menu-confirm.visible', { timeout: 5000 });
      await page.locator('#ui-menu-save-game').click();
      await page.waitForSelector('#ui-saveload-overlay.visible', { timeout: 5000 });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const f4 = await page.evaluate(() => ({
        panel: !!document.querySelector('#ui-saveload-overlay.visible'),
        menu: !!document.querySelector('#ui-menu-confirm.visible')
      }));
      check('F4a ESC closes save panel', f4.panel === false, JSON.stringify(f4));
      check('F4b ESC does not reopen menu', f4.menu === false);
      await page.close();
    }

    await browser.close();
  } finally {
    preview.kill();
  }
  console.log(fails === 0 ? '\nALL PASS' : '\n' + fails + ' FAILED');
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
