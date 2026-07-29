import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.setTimeout(180_000);

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R025');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const PHASE = fs.existsSync(BEFORE_REPORT) ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);
const BASE_URL = 'http://localhost:5173/';

const VIEWPORTS = [
  { label: 'desktop-1440', width: 1440, height: 900, capture: true },
  { label: 'desktop-1366', width: 1366, height: 768 },
  { label: 'desktop-1920', width: 1920, height: 1080 },
  { label: 'mobile-390', width: 390, height: 844, capture: true },
  { label: 'mobile-375', width: 375, height: 812 },
  { label: 'mobile-360', width: 360, height: 800 }
];

async function createProbe(page) {
  await page.waitForFunction(() => Boolean(window.__luohammerToastDebug?.ToastSystem), null, {
    timeout: 20_000
  });
  await page.evaluate(() => {
    window.__notificationProbe?.destroy?.();
    document.querySelector('.toast-container')?.remove();
    const { ToastSystem } = window.__luohammerToastDebug;
    window.__notificationProbe = new ToastSystem();
  });
}

async function readToastState(page) {
  return page.evaluate(() => {
    const container = document.querySelector('.toast-container');
    const items = [...document.querySelectorAll('.toast-item')];
    const box = container?.getBoundingClientRect();
    return {
      count: items.length,
      types: items.map(item => item.dataset.toastType),
      roles: items.map(item => item.getAttribute('role')),
      lifecycle: items.map(item => item.dataset.toastLifecycle || ''),
      buttonCount: items.reduce(
        (count, item) => count + item.querySelectorAll('button').length,
        0
      ),
      queueSize: Number(container?.dataset.toastQueueSize || 0),
      activeType: container?.dataset.toastActiveType || '',
      box: box ? {
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom)
      } : null,
      viewport: { width: innerWidth, height: innerHeight }
    };
  });
}

async function collectPriorityJourney(browser, viewport) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: viewport.width, height: viewport.height },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await page.goto('/');
  await createProbe(page);
  await page.evaluate(() => {
    window.__notificationProbe.info('键盘操作提示', 1800);
    window.__notificationProbe.success('存档成功', 1800);
    window.__notificationProbe.error('存档失败，请重试', 1800);
  });
  await page.waitForTimeout(450);
  const state = await readToastState(page);
  if (viewport.capture) {
    await page.screenshot({
      path: path.join(OUT, `${viewport.label}-priority-queue.png`)
    });
  }
  await context.close();
  return state;
}

async function collectLifecycleJourney(browser) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await page.goto('/');

  await createProbe(page);
  await page.evaluate(() => {
    window.__notificationProbe.info('悬停后应留在屏幕上', 450);
  });
  const hoverItem = page.locator('.toast-item');
  await expect(hoverItem).toBeVisible();
  await hoverItem.dispatchEvent('mouseenter');
  await page.waitForTimeout(1100);
  const hoverHeld = await hoverItem.isVisible();
  if (hoverHeld) await hoverItem.dispatchEvent('mouseleave');
  await page.waitForTimeout(850);
  const hoverReleased = await hoverItem.isHidden();

  await createProbe(page);
  await page.evaluate(() => {
    const origin = document.createElement('button');
    origin.id = 'notification-focus-origin';
    origin.textContent = '原操作';
    document.body.appendChild(origin);
    origin.focus();
    window.__notificationProbe.warning('可使用关闭按钮或 Escape', 450);
  });
  await page.waitForTimeout(120);
  const focusNotStolen = await page.evaluate(
    () => document.activeElement?.id === 'notification-focus-origin'
  );
  const closeButton = page.locator('.toast-close');
  const hasCloseButton = await closeButton.isVisible().catch(() => false);
  if (hasCloseButton) {
    await closeButton.focus();
    await page.waitForTimeout(1250);
  }
  const focusHeld = hasCloseButton && await page.locator('.toast-item').isVisible();
  if (hasCloseButton) await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  const escapeDismissed = await page.locator('.toast-item').isHidden();

  await context.close();
  return {
    hoverHeld,
    hoverReleased,
    focusNotStolen,
    hasCloseButton,
    focusHeld,
    escapeDismissed
  };
}

test('跨场景通知应按优先级单列呈现并具备可暂停的可访问生命周期', async ({
  browser
}) => {
  fs.mkdirSync(OUT, { recursive: true });
  const matrixEntries = [];
  for (const viewport of VIEWPORTS) {
    matrixEntries.push([
      viewport.label,
      await collectPriorityJourney(browser, viewport)
    ]);
  }
  const matrix = Object.fromEntries(matrixEntries);
  const lifecycle = await collectLifecycleJourney(browser);
  const result = {
    schemaVersion: 1,
    round: 'R025',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktop: matrix['desktop-1440'],
    mobile: matrix['mobile-390'],
    matrix,
    lifecycle
  };
  result.passed = PHASE === 'before' || (
    Object.values(matrix).every(state =>
      state.count === 1 &&
      state.types[0] === 'error' &&
      state.roles[0] === 'alert' &&
      state.buttonCount === 1 &&
      state.queueSize === 2 &&
      state.activeType === 'error' &&
      state.box.left >= 0 &&
      state.box.right <= state.viewport.width &&
      state.box.top >= 0 &&
      state.box.bottom <= state.viewport.height
    ) &&
    lifecycle.hoverHeld &&
    lifecycle.hoverReleased &&
    lifecycle.focusNotStolen &&
    lifecycle.hasCloseButton &&
    lifecycle.focusHeld &&
    lifecycle.escapeDismissed
  );
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  );

  expect(result.passed).toBeTruthy();
});
