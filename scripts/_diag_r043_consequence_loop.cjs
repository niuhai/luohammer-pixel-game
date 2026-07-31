// R043b 诊断：后果浮层死循环——同策略播放到卡死点，连续 consequence>12 时 dump 现场
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const BASE = 'http://localhost:4189/luohammer-pixel-game/';
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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4189', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));

    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });

    // 到天赋 → 5选2
    for (let i = 0; i < 40; i++) {
      const ok = await page.evaluate(() => {
        const el = document.querySelector('.ui-talent-overlay');
        return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
      });
      if (ok) break;
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('.ui-talent-card');
      return cards.length === 5 && [...cards].every((c) => c.classList.contains('is-revealed'));
    }, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      const c = document.querySelectorAll('.ui-talent-card');
      c[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const c = document.querySelectorAll('.ui-talent-card');
      c[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const b = document.querySelector('#ui-talent-confirm');
      if (b && !b.disabled) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(1000);

    const step = () => page.evaluate(() => {
      const click = (el) => { if (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; } return false; };
      if (document.querySelector('#ui-ending-overlay.visible')) return 'ENDING';
      const cons = document.querySelector('#ui-consequence-overlay.visible');
      if (cons) {
        click(cons.querySelector('.ui-consequence-continue')) || click(cons.querySelector('.ui-consequence-choice:not(:disabled)'));
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
        const btn = [...choices.querySelectorAll('button')].find(b => !b.disabled && b.offsetHeight > 0);
        if (btn) { click(btn); return 'choice'; }
        return 'choice-wait';
      }
      return 'advance';
    });

    let consecCons = 0;
    let lastTitles = [];
    for (let i = 0; i < 1200; i++) {
      const action = await step();
      if (action === 'ENDING') { console.log('REACHED ENDING at iter', i); break; }
      if (action === 'consequence') {
        consecCons++;
        if (consecCons === 12) {
          const dump = await page.evaluate(() => {
            const ov = document.querySelector('#ui-consequence-overlay.visible');
            const scene = window.game?.scene?.getScene?.('GameScene');
            return {
              title: ov?.querySelector('#ui-consequence-title')?.textContent || null,
              kicker: ov?.querySelector('#ui-consequence-kicker')?.textContent || null,
              stage: ov?.getAttribute('data-consequence-stage') || null,
              narrative: (ov?.querySelector('#ui-consequence-narrative')?.textContent || '').slice(0, 120),
              effectsCount: ov?.querySelectorAll('.ui-consequence-effect').length,
              hasContinue: !!ov?.querySelector('.ui-consequence-continue'),
              choiceBtns: ov ? [...ov.querySelectorAll('.ui-consequence-choice')].map(b => ({ t: b.textContent.trim().slice(0, 30), disabled: b.disabled })) : [],
              currentNode: scene?.state?.currentNode || null,
              pressure: scene?.state?.pressure, failures: scene?.state?.failures,
              pressureMax: scene?.state?.pressureMax,
              flags: Array.isArray(scene?.state?.flags) ? scene.state.flags.slice(-8) : String(scene?.state?.flags),
              triggeredTail: Array.isArray(scene?.state?.triggeredEvents) ? scene.state.triggeredEvents.slice(-6) : String(scene?.state?.triggeredEvents)
            };
          });
          console.log('STUCK-DUMP:', JSON.stringify(dump, null, 2));
          lastTitles.push(dump.title);
        }
        if (consecCons >= 40) {
          // 再抓一次确认是否同一内容循环
          const t = await page.evaluate(() => document.querySelector('#ui-consequence-overlay.visible #ui-consequence-title')?.textContent || null);
          console.log('STUCK-TITLE-NOW:', t, '| first-dump-title:', lastTitles[0]);
          break;
        }
      } else {
        if (consecCons > 0) console.log(`consequence streak ended at ${consecCons} (iter ${i})`);
        consecCons = 0;
        if (action === 'advance') await page.keyboard.press('Space');
      }
      await page.waitForTimeout(action === 'advance' ? 320 : 500);
    }
    await browser.close();
  } finally {
    try { preview.kill(); } catch {}
    try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
