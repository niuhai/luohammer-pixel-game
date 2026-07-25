// 音频探针：验证录制管道 + 诊断 BGM 状态
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const BASE = 'http://localhost:4173/luohammer-pixel-game/';
const waitPort = (url, timeout = 30000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = async () => {
    try { const r = await fetch(url); if (r.ok) return resolve(); } catch {}
    if (Date.now() - t0 > timeout) return reject(new Error('timeout'));
    setTimeout(tick, 500);
  };
  tick();
});

(async () => {
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', shell: true, cwd: path.resolve(__dirname, '..') });
  try {
    await waitPort(BASE);
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      window.__srcNodes = new Set();
      window.__oscCount = 0;
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
      const origOsc = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function (...a) {
        window.__oscCount++;
        return origOsc.apply(this, a);
      };
    });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#ui-boot-overlay').waitFor({ state: 'visible', timeout: 20000 });
    // 与录制脚本一致：只 pointerdown 解锁，不切场景
    await page.mouse.click(20, 700);
    await page.waitForTimeout(3500);

    const diag = await page.evaluate(async () => {
      const nodes = [...(window.__srcNodes || [])];
      if (!nodes.length) return { err: 'no nodes' };
      const ctx = nodes[0].context;
      const dest = ctx.createMediaStreamDestination();
      window.__recDest = dest;
      for (const n of nodes) { try { window.__origConnect.call(n, dest); } catch {} }

      // 对照组：1kHz 振荡器 0.5 增益 3 秒
      const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => { rec.onstop = r; });
      rec.start(250);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.frequency.value = 1000;
      osc.connect(g); g.connect(dest); // 直接连 dest，绕过 patch 歧义
      osc.start();
      await new Promise((r) => setTimeout(r, 3000));
      osc.stop();
      rec.stop();
      await done;
      const total = chunks.reduce((s, c) => s + c.size, 0);

      // BGM 诊断：给每个源节点挂 Analyser 测 2.5s RMS 电平
      const nodeInfo = [];
      for (const n of nodes) {
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        try { window.__origConnect.call(n, an); } catch {}
        const buf = new Float32Array(an.fftSize);
        let peak = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 2500) {
          await new Promise((r) => setTimeout(r, 100));
          an.getFloatTimeDomainData(buf);
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
        }
        try { n.disconnect(an); } catch {}
        nodeInfo.push({
          type: n.constructor.name,
          gain: n.gain ? Number(n.gain.value.toFixed(3)) : null,
          rmsPeak: Number(peak.toFixed(4)),
        });
      }
      // 深挖 audio 实例状态：遍历 Phaser scenes 找 audio 属性
      let audioState = null;
      try {
        const game = window.game || (window.Phaser && Object.values(window).find((v) => v && v.isBooted && v.scene));
        if (game && game.scene) {
          const active = game.scene.getScenes(true);
          const sc = active.find((s) => s && s.audio) || game.scene.scenes.find((s) => s && s.audio);
          if (sc) {
            audioState = {
              scene: sc.scene.key,
              enabled: sc.audio.enabled,
              bgmPlaying: sc.audio._bgmPlaying,
              bgmType: sc.audio._bgmType,
              bgmGainVal: sc.audio._bgmGain ? Number(sc.audio._bgmGain.gain.value.toFixed(4)) : null,
              masterVol: sc.audio.masterVolume,
              bgmVol: sc.audio.bgmVolume,
              destroyed: sc.audio._destroyed,
            };
          }
        }
      } catch (e) { audioState = { err: e.message }; }

      return {
        oscChunkBytes: total,
        ctxState: ctx.state,
        nodeCount: nodes.length,
        nodeInfo,
        oscCount: window.__oscCount,
        audioState,
      };
    });
    console.log(JSON.stringify(diag, null, 2));
    await browser.close();
  } finally {
    preview.kill();
  }
})();
