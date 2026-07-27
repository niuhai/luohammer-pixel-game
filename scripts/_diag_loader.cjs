// 决定性探针：GameScene 停滞时 dump sys.settings.status + Loader 队列状态
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));

  await page.goto('https://niuhai.github.io/luohammer-pixel-game/', { waitUntil: 'load', timeout: 60000 });
  const bootVisible = await page.locator('#ui-boot-overlay').isVisible({ timeout: 30000 }).catch(() => false);

  if (bootVisible) {
    await page.locator('#ui-boot-buttons button', { hasText: '开始游戏' }).click({ timeout: 8000 });
    // 推 5 次空格确保 IntroScene 完成
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(1000); }
    await page.waitForTimeout(3000);
    const st = await page.evaluate(() => {
      const g = window.game;
      const gs = g.scene.keys.GameScene;
      if (!gs) return { gameScene: null };
      const load = gs.load;
      const keysOf = (c) => { try { return Array.from(c.keys ? c.keys() : Object.keys(c)).slice(0, 20); } catch (e) { return String(c).slice(0, 100); } };
      const safeSize = (c) => { try { return c && c.size !== undefined ? c.size : (c ? Object.keys(c).length : null); } catch (e) { return 'err'; } };
      return {
        status: gs.sys.settings.status, // Phaser CONST: 0 PENDING,1 INIT,2 START,3 LOADING,4 CREATING,5 RUNNING,6 PAUSED,7 SLEEPING,8 SHUTDOWN,9 DESTROYED
        isActive: gs.sys.isActive(),
        loadListSize: load ? safeSize(load.list) : null,
        loadInflight: load ? safeSize(load.inflight) : null,
        loadFailed: load ? safeSize(load.failed) : null,
        loadQueue: load ? safeSize(load.queue) : null,
        loadState: load ? load.state : null,
        loadProgress: load ? load.progress : null,
        inflightKeys: load ? keysOf(load.inflight) : [],
        listKeys: load ? keysOf(load.list) : [],
        queueKeys: load ? keysOf(load.queue) : [],
      };
    });
    logs.push('GameScene dump: ' + JSON.stringify(st, null, 2));
    // 再等 10s 复探一次，看 Loader 是否推进
    await page.waitForTimeout(10000);
    const st2 = await page.evaluate(() => {
      const g = window.game;
      const gs = g.scene.keys.GameScene;
      if (!gs) return { gameScene: null };
      const keysOf2 = (c) => { try { return Array.from(c.keys ? c.keys() : Object.keys(c)).slice(0, 20); } catch (e) { return String(c).slice(0, 100); } };
      return {
        status: gs.sys.settings.status,
        isActive: gs.sys.isActive(),
        loadState: gs.load ? gs.load.state : null,
        loadProgress: gs.load ? gs.load.progress : null,
        inflightKeys: gs.load ? keysOf2(gs.load.inflight) : [],
        talent: !!document.querySelector('.ui-talent-overlay')?.offsetHeight,
      };
    });
    logs.push('after +10s: ' + JSON.stringify(st2, null, 2));
  }
  console.log(JSON.stringify(logs, null, 2));
  await browser.close();
})();
