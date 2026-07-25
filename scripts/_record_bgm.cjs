// 录制游戏真实 BGM（menu 循环）：headless Chromium + Web Audio 分接 MediaRecorder
// 原理：patch AudioNode.connect，凡连到 ctx.destination 的源节点都登记；录制时统一分接到 MediaStreamDestination
// 用法：node scripts/_record_bgm.cjs [秒数]  → 产出 demo-footage/bgm-menu.webm
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4173/luohammer-pixel-game/';
const OUT = path.resolve('demo-footage');
const RECORD_SECONDS = Number(process.argv[2] || 40);

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
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..')
  });
  try {
    await waitPort(BASE);
    const browser = await chromium.launch({
      args: ['--autoplay-policy=no-user-gesture-required']
    });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => {
      window.__srcNodes = new Set();
      const orig = AudioNode.prototype.connect;
      window.__origConnect = orig;
      AudioNode.prototype.connect = function (target, ...rest) {
        try {
          const c = target && target.context;
          if (c && target === c.destination) {
            window.__srcNodes.add(this);
            if (window.__recDest) orig.call(this, window.__recDest);
          }
        } catch {}
        return orig.call(this, target, ...rest);
      };
    });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    // 关键：只触发 pointerdown 解锁音频（unlockAndPlay 会 startBGM('menu')），
    // 不能点「开始游戏」——那会 fadeOutBGM 并切场景销毁 AudioSystem，录到的是 silence。
    // 点击左下角空白区域，避开按钮与静音开关。
    await page.mouse.click(20, 700);
    await page.waitForFunction(() => (window.__srcNodes || []).size > 0, null, { timeout: 8000 });
    await page.waitForTimeout(3500); // BGM 淡入稳定

    const data = await page.evaluate(async (secs) => {
      // 关键：游戏 AudioSystem 使用模块级共享 AudioContext（与 Phaser 自带 ctx 不同），
      // 跨 AudioContext connect 会抛错——必须从游戏实例上取 _masterGain 并在其自身 ctx 上建 dest。
      let audio = null;
      try {
        const game = window.game || Object.values(window).find((v) => v && v.isBooted && v.scene);
        const active = game.scene.getScenes(true);
        const sc = active.find((s) => s && s.audio) || game.scene.scenes.find((s) => s && s.audio);
        audio = sc && sc.audio;
      } catch (e) { return { err: 'game lookup failed: ' + e.message }; }
      if (!audio || !audio._masterGain) return { err: 'no active AudioSystem / masterGain' };
      if (!audio._bgmPlaying) return { err: 'BGM not playing (bgmPlaying=false)' };
      const ctx = audio.ctx;
      const dest = ctx.createMediaStreamDestination();
      audio._masterGain.connect(dest);
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => { rec.onstop = r; });
      rec.start(250);
      await new Promise((r) => setTimeout(r, secs * 1000));
      rec.stop();
      await done;
      const buf = await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { b64: btoa(bin), bgmType: audio._bgmType, sampleRate: ctx.sampleRate };
    }, RECORD_SECONDS);

    if (data.err) throw new Error(data.err);
    fs.writeFileSync(path.join(OUT, 'bgm-menu.webm'), Buffer.from(data.b64, 'base64'));
    console.log(`[bgm] recorded ${RECORD_SECONDS}s of '${data.bgmType}', ctx ${data.sampleRate}Hz → demo-footage/bgm-menu.webm`);
    await browser.close();
  } finally {
    preview.kill();
  }
})();
