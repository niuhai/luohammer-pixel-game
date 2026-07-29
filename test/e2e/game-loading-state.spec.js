import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R022');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const PHASE = fs.existsSync(BEFORE_REPORT) ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);
const BASE_URL = 'http://localhost:5173/';

async function ariaSnapshot(locator) {
  try {
    return await locator.ariaSnapshot();
  } catch (error) {
    return '';
  }
}

async function readLoadingState(page) {
  const loader = page.locator('#ui-game-loading');
  const snapshot = await ariaSnapshot(loader);
  const dom = await loader.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const progress = element.querySelector('[role="progressbar"]');
    const fill = element.querySelector('.ui-game-loading-fill');
    return {
      hidden: element.hidden,
      ariaHidden: element.getAttribute('aria-hidden'),
      role: element.getAttribute('role'),
      live: element.getAttribute('aria-live'),
      stage: element.dataset.loadingStage || '',
      progressMode: element.dataset.progressMode || '',
      classVisible: element.classList.contains('visible'),
      opacity: Number.parseFloat(getComputedStyle(element).opacity),
      text: element.textContent.replace(/\s+/g, ' ').trim(),
      fillWidth: Number.parseFloat(fill?.style.width || '0'),
      progress: progress
        ? {
            role: progress.getAttribute('role'),
            now: progress.getAttribute('aria-valuenow'),
            valueText: progress.getAttribute('aria-valuetext')
          }
        : null,
      box: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
  return {
    ...dom,
    ariaSnapshot: snapshot,
    treeExposed: /正在(?:进入|展开)人生|正在载入舞台|第一段故事|第一幕/.test(snapshot)
  };
}

async function collectLoadingJourney(browser, viewport, label, options = {}) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const delays = {
    'scene-classroom-v2.webp': 1500,
    'luo-standing-v4-nobg.webp': 2300,
    'luo-young-v4-nobg.webp': 3100
  };
  await page.route(/\/assets\/characters\/[^/?]+\.webp$/, async route => {
    const file = new URL(route.request().url()).pathname.split('/').pop();
    const delay = delays[file];
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    await route.continue();
  });

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
  const bootOverlay = page.locator('#ui-boot-overlay');
  await expect(bootOverlay).toBeVisible({ timeout: 15_000 });
  // 本用例验证 GameScene 加载层，不消费会被引擎接管替换的轻量首屏壳按钮。
  // 六视口并发冷启动时，显式等到 BootScene 接管，避免点击落在旧节点上的竞态。
  await expect(bootOverlay).toHaveAttribute('data-boot-phase', 'engine', { timeout: 30_000 });
  const startButton = page.locator('#ui-boot-buttons .ui-boot-btn-primary');
  await expect(startButton).toBeEnabled();
  const title = await readLoadingState(page);
  if (options.captureEvidence) {
    await page.screenshot({ path: path.join(OUT, `${label}-title.png`) });
  }

  await startButton.click();
  await expect(page.locator('#ui-intro-overlay')).toBeVisible({ timeout: 10_000 });
  const skip = page.locator('#ui-intro-skip-hint');
  await expect(skip).toHaveClass(/visible/, { timeout: 10_000 });
  await skip.click({ force: true });

  const loader = page.locator('#ui-game-loading');
  await expect(loader).toHaveClass(/visible/, { timeout: 20_000 });
  await page.waitForFunction(() => {
    const fill = document.querySelector('.ui-game-loading-fill');
    const width = Number.parseFloat(fill?.style.width || '0');
    return width > 0 && width < 100;
  }, null, { timeout: 20_000 });
  const active = await readLoadingState(page);
  if (options.captureEvidence) {
    await page.screenshot({ path: path.join(OUT, `${label}-loading.png`) });
  }

  await expect(page.locator('#ui-talent-overlay')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(320);
  const complete = await readLoadingState(page);
  if (options.captureEvidence) {
    await page.screenshot({ path: path.join(OUT, `${label}-complete.png`) });
  }

  await context.close();
  return { title, active, complete };
}

test('游戏资源加载层只在真实加载期暴露准确状态', async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const viewports = [
    { label: 'desktop-1440', width: 1440, height: 900, captureEvidence: true },
    { label: 'desktop-1366', width: 1366, height: 768 },
    { label: 'desktop-1920', width: 1920, height: 1080 },
    { label: 'mobile-390', width: 390, height: 844, captureEvidence: true },
    { label: 'mobile-375', width: 375, height: 812 },
    { label: 'mobile-360', width: 360, height: 800 }
  ];
  const entries = await Promise.all(viewports.map(async viewport => {
    const journey = await collectLoadingJourney(
      browser,
      { width: viewport.width, height: viewport.height },
      viewport.label,
      { captureEvidence: viewport.captureEvidence }
    );
    return [viewport.label, journey];
  }));
  const matrix = Object.fromEntries(entries);
  const desktop = matrix['desktop-1440'];
  const mobile = matrix['mobile-390'];

  const result = {
    schemaVersion: 1,
    round: 'R022',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktop,
    mobile,
    matrix
  };
  result.passed = PHASE === 'before' || (
    Object.values(matrix).every(journey =>
      journey.title.hidden &&
      journey.title.ariaHidden === 'true' &&
      !journey.title.treeExposed &&
      !journey.active.hidden &&
      journey.active.ariaHidden === 'false' &&
      journey.active.classVisible &&
      journey.active.treeExposed &&
      journey.active.stage === 'assets' &&
      journey.active.progress?.role === 'progressbar' &&
      Number(journey.active.progress.now) > 0 &&
      Number(journey.active.progress.now) < 100 &&
      journey.active.box.left >= 0 &&
      journey.active.box.right <= journey.active.viewport.width &&
      journey.active.box.top >= 0 &&
      journey.active.box.bottom <= journey.active.viewport.height &&
      journey.complete.hidden &&
      journey.complete.ariaHidden === 'true' &&
      !journey.complete.treeExposed
    )
  );
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  );

  expect(result.passed).toBeTruthy();
});
