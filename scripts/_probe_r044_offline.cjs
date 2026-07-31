// R044 PWA 离线全链路实证（生产构建，390×844）——README/复赛帖声称"离线全链路可玩"的判据验证
// 两层证据：(1) 安装后缓存键清单 vs dist/assets 全量比对 + __precache_failures__；(2) setOffline 后真实走到首个对话框
// 用法：node scripts/_probe_r044_offline.cjs（自带 4191 preview，需先 npm run build）
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4191/luohammer-pixel-game/';
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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4191', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  const checks = [];
  const check = (name, pass, detail) => {
    checks.push({ name, pass });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  };
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 150)));

    // —— 阶段 1：在线加载，等 SW 激活并读缓存清单 ——
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 20000 });
    // install 的 precache 是异步的，轮询到缓存里出现入口 chunk 为止
    await page.waitForFunction(async () => {
      const names = await caches.keys();
      if (!names.length) return false;
      const keys = await caches.open(names[0]).then((c) => c.keys());
      return keys.some((k) => /assets\/index-[^/]+\.js/.test(k.url));
    }, { timeout: 30000 });

    const dump = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0]);
      const keys = (await cache.keys()).map((k) => new URL(k.url).pathname);
      const failResp = await cache.match('./__precache_failures__');
      return { cacheName: names[0], keys, failures: failResp ? JSON.parse(await failResp.text()) : [] };
    });

    // dist/assets 全量基准（preview 服务的即是当前 dist）
    const distAssets = fs.readdirSync(path.resolve(__dirname, '../dist/assets')).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
    const cachedSet = new Set(dump.keys.map((p) => decodeURIComponent(p.split('/').pop())));
    const missing = distAssets.filter((f) => !cachedSet.has(f));
    check('O1 SW 已激活且版本正确', dump.cacheName.includes('v12'), dump.cacheName);
    check('O2 precache 覆盖 dist/assets 全部 JS/CSS', missing.length === 0,
      missing.length ? `缺失 ${missing.length}: ${missing.slice(0, 4).join(',')}` : `${distAssets.length} 项全在缓存`);
    check('O3 __precache_failures__ 为空', dump.failures.length === 0, dump.failures.slice(0, 2).join(' | '));

    // —— 阶段 2：离线重载，真实推进到首个对话框 ——
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    const bootOk = await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    check('O4 离线重载 boot overlay 可见', bootOk);
    if (bootOk) {
      await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
      let talentOk = false;
      for (let i = 0; i < 40; i++) {
        talentOk = await page.evaluate(() => {
          const el = document.querySelector('.ui-talent-overlay');
          return !!(el && getComputedStyle(el).display !== 'none' && el.offsetHeight > 0);
        });
        if (talentOk) break;
        await page.keyboard.press('Space');
        await page.waitForTimeout(700);
      }
      check('O5 离线推进到天赋 overlay（IntroScene chunk 离线可用）', talentOk);
      if (talentOk) {
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
        // 推进到 GameScene 首个对话框（最大应用 chunk 离线加载判据）
        let dialogOk = false;
        for (let i = 0; i < 40; i++) {
          dialogOk = await page.evaluate(() => {
            const d = document.getElementById('ui-dialog');
            return !!(d && d.offsetHeight > 0 && (d.textContent || '').trim().length > 10);
          });
          if (dialogOk) break;
          await page.keyboard.press('Space');
          await page.waitForTimeout(700);
        }
        check('O6 离线进入 GameScene 首个对话框（主 chunk 离线可用）', dialogOk);
      }
    }
    check('O7 全程零 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));

    await browser.close();
    const failed = checks.filter((c) => !c.pass);
    console.log(failed.length === 0 ? `\nALL ${checks.length} PASS` : `\n${failed.length} FAIL`);
    process.exit(failed.length === 0 ? 0 : 1);
  } finally {
    try { preview.kill(); } catch {}
    try { require('child_process').execSync(`taskkill /pid ${preview.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
