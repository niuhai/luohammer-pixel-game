import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve('.');
const CURRENT_ROUND_PATH = path.join(ROOT, '.iteration', 'ui', 'current.json');
const currentRound = fs.existsSync(CURRENT_ROUND_PATH)
  ? JSON.parse(fs.readFileSync(CURRENT_ROUND_PATH, 'utf8'))
  : null;
const ROUND = process.env.UI_PERF_ROUND ||
  (currentRound?.status === 'active' ? currentRound.round : 'R008');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', ROUND);
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);
const IDLE_OBSERVATION_MS = 5_000;

function installFirstInteractiveProbe(page) {
  return page.addInitScript(() => {
    window.__firstLoadProbe = {
      bootVisibleAt: null,
      bootInteractiveAt: null,
      loadingHiddenAt: null
    };
    const inspect = () => {
      const probe = window.__firstLoadProbe;
      const boot = document.getElementById('ui-boot-overlay');
      const primary = document.querySelector('#ui-boot-buttons .ui-boot-btn-primary');
      const loading = document.getElementById('app-loading');
      if (probe.bootVisibleAt === null && boot?.classList.contains('visible')) {
        probe.bootVisibleAt = performance.now();
      }
      if (
        probe.bootInteractiveAt === null &&
        boot?.classList.contains('visible') &&
        primary &&
        !primary.disabled
      ) {
        probe.bootInteractiveAt = performance.now();
      }
      if (
        probe.loadingHiddenAt === null &&
        (!loading || loading.classList.contains('hidden'))
      ) {
        probe.loadingHiddenAt = performance.now();
      }
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document, {
      attributes: true,
      childList: true,
      subtree: true
    });
    inspect();
    document.addEventListener('DOMContentLoaded', inspect);
  });
}

async function collectColdLoad(browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const recordUnexpectedError = message => {
    const text = String(message);
    const isExpectedBlockedServiceWorkerError =
      text.includes('[PWA] Service Worker registration failed:') &&
      text.includes("Cannot read properties of undefined (reading 'update')");
    if (!isExpectedBlockedServiceWorkerError) errors.push(text);
  };
  page.on('pageerror', recordUnexpectedError);
  page.on('console', message => {
    if (message.type() === 'error') recordUnexpectedError(message.text());
  });
  await installFirstInteractiveProbe(page);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 120,
    downloadThroughput: 250 * 1024,
    uploadThroughput: 125 * 1024,
    connectionType: 'cellular3g'
  });

  await page.goto('', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const primary = page.locator('#ui-boot-buttons .ui-boot-btn-primary');
  await expect(primary).toBeVisible({ timeout: 60_000 });
  await expect(primary).toBeEnabled();
  await page.waitForTimeout(IDLE_OBSERVATION_MS);
  await page.screenshot({ path: path.join(OUT, 'cold-load.png') });

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource')
      .map(entry => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        startTime: Math.round(entry.startTime),
        responseEnd: Math.round(entry.responseEnd),
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize || 0,
        encodedBodySize: entry.encodedBodySize || 0
      }))
      .sort((a, b) => a.startTime - b.startTime);
    return {
      probe: window.__firstLoadProbe,
      navigation: {
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
        loadEvent: Math.round(navigation.loadEventEnd),
        responseEnd: Math.round(navigation.responseEnd)
      },
      resources,
      bootPhase: document.getElementById('ui-boot-overlay')?.dataset.bootPhase || '',
      shell: window.__luohammerBootShell ? {
        visibleAt: Math.round(window.__luohammerBootShell.visibleAt || 0),
        interactiveAt: Math.round(window.__luohammerBootShell.interactiveAt || 0),
        engineRequestedAt: Math.round(
          window.__luohammerBootShell.engineRequestedAt || 0
        ),
        engineReadyAt: Math.round(window.__luohammerBootShell.engineReadyAt || 0),
        requestReason: window.__luohammerBootShell.requestReason || ''
      } : null,
      activeElement: document.activeElement?.textContent?.trim() || ''
    };
  });

  const bootInteractiveMs = Math.round(metrics.probe.bootInteractiveAt);
  const settledCutoff = bootInteractiveMs + IDLE_OBSERVATION_MS + 250;
  const observedResources = metrics.resources.filter(entry => entry.startTime <= settledCutoff);
  const firstScreenResources = observedResources.filter(entry =>
    entry.startTime <= bootInteractiveMs
  );
  const idleResources = observedResources.filter(entry =>
    entry.startTime > bootInteractiveMs
  );
  const deferredPattern = /GameScene-|EndingScene-|events-random-|scene-classroom-v2|luo-standing-v4|luo-young-v4/;
  const entryScript = observedResources.find(entry =>
    /\/assets\/index-[^/]+\.js$/.test(new URL(entry.name).pathname)
  );
  const phaserScript = observedResources.find(entry =>
    /\/assets\/phaser-[^/]+\.js$/.test(new URL(entry.name).pathname)
  );
  const titleImage = observedResources.find(entry =>
    /\/assets\/characters\/scene-stage-v2(?:-\d+)?\.webp$/.test(new URL(entry.name).pathname)
  );
  const normalizeBytes = entry => entry
    ? Math.max(entry.transferSize || 0, entry.encodedBodySize || 0)
    : 0;

  const result = {
    phase: PHASE,
    networkProfile: {
      latencyMs: 120,
      downloadBytesPerSecond: 250 * 1024,
      uploadBytesPerSecond: 125 * 1024
    },
    bootVisibleMs: Math.round(metrics.probe.bootVisibleAt),
    bootInteractiveMs,
    loadingHiddenMs: Math.round(metrics.probe.loadingHiddenAt),
    navigation: metrics.navigation,
    activeElement: metrics.activeElement,
    entryScriptBytes: normalizeBytes(entryScript),
    phaserScriptBytes: normalizeBytes(phaserScript),
    titleImageBytes: normalizeBytes(titleImage),
    titleImagePath: titleImage ? new URL(titleImage.name).pathname : '',
    phaserRequestStartMs: phaserScript?.startTime || 0,
    phaserResponseEndMs: phaserScript?.responseEnd || 0,
    bootInteractiveBeforePhaserRequest: Boolean(
      phaserScript && bootInteractiveMs < phaserScript.startTime
    ),
    bootInteractiveBeforePhaserComplete: Boolean(
      phaserScript && bootInteractiveMs < phaserScript.responseEnd
    ),
    bootPhase: metrics.bootPhase,
    shell: metrics.shell,
    requestsBeforeInteractive: firstScreenResources.length,
    requestsDuringTitleIdle: idleResources.length,
    bytesBeforeInteractive: firstScreenResources.reduce(
      (sum, entry) => sum + normalizeBytes(entry),
      0
    ),
    deferredRequestsDuringTitleIdle: idleResources
      .filter(entry => deferredPattern.test(entry.name))
      .map(entry => ({
        name: new URL(entry.name).pathname,
        startTime: entry.startTime,
        transferSize: normalizeBytes(entry)
      })),
    waterfall: observedResources.map(entry => ({
      ...entry,
      name: new URL(entry.name).pathname
    })),
    errors
  };
  result.passed =
    result.bootInteractiveMs > 0 &&
    result.loadingHiddenMs > 0 &&
    result.entryScriptBytes > 0 &&
    result.phaserScriptBytes > 0 &&
    result.titleImageBytes > 0 &&
    errors.length === 0;

  await context.close();
  return result;
}

async function collectOfflineGuardrail(browser) {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto('', { waitUntil: 'load', timeout: 60_000 });
  await expect(page.locator('#ui-boot-buttons .ui-boot-btn-primary')).toBeVisible({
    timeout: 60_000
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
  });
  await page.reload({ waitUntil: 'load', timeout: 60_000 });
  await expect(page.locator('#ui-boot-buttons .ui-boot-btn-primary')).toBeVisible({
    timeout: 60_000
  });

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  const primary = page.locator('#ui-boot-buttons .ui-boot-btn-primary');
  await expect(primary).toBeVisible({ timeout: 60_000 });
  await expect(primary).toBeEnabled();
  const primaryVisible = await primary.isVisible();
  const primaryEnabled = await primary.isEnabled();
  await page.screenshot({ path: path.join(OUT, 'offline-boot.png') });
  let introVisible = false;
  if (ROUND === 'R021' && PHASE === 'after') {
    await primary.click();
    const intro = page.locator('#ui-intro-overlay.visible');
    await expect(intro).toBeVisible({ timeout: 60_000 });
    introVisible = await intro.isVisible();
    await page.screenshot({ path: path.join(OUT, 'offline-intro.png') });
  }
  const result = {
    controlled: await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    primaryVisible,
    primaryEnabled,
    introVisible
  };
  result.passed = result.controlled && result.primaryVisible &&
    result.primaryEnabled &&
    (ROUND !== 'R021' || PHASE !== 'after' || result.introVisible);
  await context.close();
  return result;
}

async function collectDelayedEngineShell(browser, viewport, label) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport
  });
  const page = await context.newPage();
  await installFirstInteractiveProbe(page);
  await page.route(/\/assets\/phaser-[^/]+\.js$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.continue();
  });

  const navigation = page.goto('', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000
  });
  const primary = page.locator('#ui-boot-buttons .ui-boot-btn-primary');
  await expect(primary).toBeVisible({ timeout: 15_000 });
  await expect(primary).toBeEnabled();
  await page.waitForTimeout(80);

  const shell = await page.evaluate(() => {
    const overlay = document.getElementById('ui-boot-overlay');
    const button = overlay.querySelector('.ui-boot-btn-primary');
    const rect = button.getBoundingClientRect();
    return {
      phase: overlay.dataset.bootPhase || '',
      canvasCount: document.querySelectorAll('canvas').length,
      buttonText: button.textContent.trim(),
      buttonFocused: document.activeElement === button,
      buttonBox: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      viewport: { width: innerWidth, height: innerHeight },
      interactiveAt: Math.round(
        window.__luohammerBootShell?.interactiveAt || 0
      ),
      engineRequestedAt: Math.round(
        window.__luohammerBootShell?.engineRequestedAt || 0
      )
    };
  });

  // 大视口全页截图可能超过引擎延迟窗口；先点击并锁定即时反馈，
  // 避免截图耗时让 BootScene 替换壳按钮后再误点完整菜单。
  // 使用真实坐标点击，避免 locator.click() 把壳层的持续微动动画判定为“不稳定”
  // 并等待到引擎接管后才触发；浏览器用户的指针点击不会有这层自动等待。
  await page.mouse.click(
    shell.buttonBox.left + shell.buttonBox.width / 2,
    shell.buttonBox.top + shell.buttonBox.height / 2
  );
  const feedback = await page.evaluate(() => {
    const button = document.querySelector('.ui-boot-shell-primary');
    const state = window.__luohammerBootShell;
    return {
      busy: button?.getAttribute('aria-busy') || '',
      disabled: Boolean(button?.disabled),
      text: button?.textContent.trim() || '',
      intent: state?.intent?.action || '',
      feedbackDelayMs: state?.intent
        ? Math.max(0, Math.round(performance.now() - state.intent.requestedAt))
        : null
    };
  });
  await page.screenshot({ path: path.join(OUT, `${label}-shell.png`) });

  await navigation;
  const intro = page.locator('#ui-intro-overlay.visible');
  await expect(intro).toBeVisible({ timeout: 60_000 });
  const handoff = await page.evaluate(() => ({
    introVisible: document.getElementById('ui-intro-overlay')
      ?.classList.contains('visible') || false,
    engineReadyAt: Math.round(window.__luohammerBootShell?.engineReadyAt || 0),
    intentConsumed: window.__luohammerBootShell?.intent === null,
    canvasCount: document.querySelectorAll('canvas').length
  }));
  await page.screenshot({ path: path.join(OUT, `${label}-handoff.png`) });

  const result = { shell, feedback, handoff };
  result.passed = shell.phase === 'shell' &&
    shell.canvasCount === 0 &&
    shell.buttonFocused &&
    shell.buttonBox.left >= 0 &&
    shell.buttonBox.right <= shell.viewport.width &&
    shell.buttonBox.top >= 0 &&
    shell.buttonBox.bottom <= shell.viewport.height &&
    shell.buttonBox.height >= 44 &&
    feedback.busy === 'true' &&
    feedback.disabled &&
    feedback.intent === 'start' &&
    feedback.feedbackDelayMs <= 100 &&
    handoff.introVisible &&
    handoff.intentConsumed &&
    handoff.canvasCount === 1;
  await context.close();
  return result;
}

test('生产首屏冷启动、请求瀑布与离线回访', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const coldLoad = await collectColdLoad(browser);
  const offline = await collectOfflineGuardrail(browser);
  const shellViewports = ROUND === 'R021' && PHASE === 'after'
    ? {
        desktop1440: await collectDelayedEngineShell(
          browser, { width: 1440, height: 900 }, 'desktop-1440'
        ),
        desktop1366: await collectDelayedEngineShell(
          browser, { width: 1366, height: 768 }, 'desktop-1366'
        ),
        desktop1920: await collectDelayedEngineShell(
          browser, { width: 1920, height: 1080 }, 'desktop-1920'
        ),
        mobile390: await collectDelayedEngineShell(
          browser, { width: 390, height: 844 }, 'mobile-390'
        ),
        mobile375: await collectDelayedEngineShell(
          browser, { width: 375, height: 812 }, 'mobile-375'
        ),
        mobile360: await collectDelayedEngineShell(
          browser, { width: 360, height: 800 }, 'mobile-360'
        )
      }
    : {};
  const report = {
    schemaVersion: 1,
    round: ROUND,
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    passed: coldLoad.passed && offline.passed &&
      Object.values(shellViewports).every(result => result.passed),
    coldLoad,
    offline,
    shellViewports
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(coldLoad.passed).toBeTruthy();
  expect(offline.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    if (ROUND === 'R008') {
      expect(coldLoad.entryScriptBytes).toBeLessThan(before.coldLoad.entryScriptBytes);
    }
    if (ROUND === 'R009') {
      expect(coldLoad.titleImageBytes).toBeLessThan(before.coldLoad.titleImageBytes);
    }
    if (ROUND === 'R021') {
      expect(coldLoad.bootInteractiveMs).toBeLessThan(
        before.coldLoad.bootInteractiveMs * 0.5
      );
      expect(coldLoad.bytesBeforeInteractive).toBeLessThan(
        before.coldLoad.bytesBeforeInteractive
      );
      expect(coldLoad.bootInteractiveBeforePhaserRequest).toBeTruthy();
      expect(coldLoad.bootPhase).toBe('engine');
      expect(coldLoad.shell?.interactiveAt).toBeGreaterThan(0);
      expect(coldLoad.shell?.engineReadyAt).toBeGreaterThan(
        coldLoad.shell?.interactiveAt || 0
      );
      expect(offline.introVisible).toBeTruthy();
      expect(Object.values(shellViewports).every(result => result.passed))
        .toBeTruthy();
    }
    expect(coldLoad.deferredRequestsDuringTitleIdle).toEqual([]);
  }
});
