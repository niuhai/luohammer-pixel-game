/* eslint-env node */

const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = process.argv.find(arg => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const round = getArg('round', 'R006');
const phase = getArg('phase', 'before');
if (!/^R\d+$/.test(round) || !/^[a-z0-9-]+$/i.test(phase)) {
  throw new Error('Unsafe round or phase argument.');
}

const OUT = path.join(ROOT, '.iteration', 'ui', 'evidence', round, phase);
const PORT = 4192;
const BASE = `http://127.0.0.1:${PORT}/luohammer-pixel-game/`;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-compact', width: 375, height: 812 }
];

const waitForServer = async (timeoutMs = 30_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error('Vite preview startup timed out.');
};

async function enterEnding(page) {
  await page.goto(BASE, { waitUntil: 'load', timeout: 30_000 });
  await page.evaluate(() => {
    localStorage.clear();
    const state = {
      pride: 7,
      wealth: 6,
      reputation: 5,
      failures: 2,
      pressure: 4,
      trust: 6,
      pressureMax: 10,
      failurePenalty: 1,
      successBonus: 1,
      talentSpecials: [],
      currentStageId: 'youth',
      currentNode: 'ending_scholar',
      flags: [],
      triggeredEvents: [],
      history: [],
      achievements: [],
      gameStartTime: Date.now() - 60_000
    };
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'load' });
  await page.locator('#rotate-hint-dismiss').click({ force: true }).catch(() => {});
  await page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }).click();
  await page.locator('#ui-ending-overlay.visible').waitFor({ timeout: 30_000 });
  await page.locator('#ui-ending-title').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(() => {
    const title = document.getElementById('ui-ending-title');
    return Boolean(title?.textContent?.trim());
  });
  await page.waitForTimeout(3_100);
}

async function captureViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.name !== 'desktop',
    isMobile: viewport.name !== 'desktop',
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await enterEnding(page);
  await page.screenshot({
    path: path.join(OUT, `${viewport.name}-ending.png`),
    fullPage: false
  });

  const result = await page.evaluate(() => {
    const byId = id => document.getElementById(id);
    const select = selector => document.querySelector(selector);
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        left: Math.round(value.left),
        top: Math.round(value.top),
        right: Math.round(value.right),
        bottom: Math.round(value.bottom),
        width: Math.round(value.width),
        height: Math.round(value.height)
      };
    };
    const style = element => element ? getComputedStyle(element) : null;
    const content = select('.ui-ending-content');
    const title = byId('ui-ending-title');
    const quote = byId('ui-ending-quote');
    const analysis = select('.ui-ending-analysis');
    const buttons = byId('ui-ending-buttons');
    const actionButtons = [...buttons.querySelectorAll(':scope > .ui-ending-btn')];
    const active = document.activeElement;
    const viewport = { width: innerWidth, height: innerHeight };
    const actionsRect = rect(buttons);
    const titleRect = rect(title);

    return {
      viewport,
      overlayRole: byId('ui-ending-overlay').getAttribute('role'),
      overlayLabelledBy: byId('ui-ending-overlay').getAttribute('aria-labelledby'),
      contentTabIndex: content.getAttribute('tabindex'),
      activeElement: active?.className || active?.id || active?.tagName || '',
      focusInsideEnding: byId('ui-ending-overlay').contains(active),
      content: {
        rect: rect(content),
        scrollHeight: content.scrollHeight,
        clientHeight: content.clientHeight,
        scrollTop: content.scrollTop,
        overflows: content.scrollHeight > content.clientHeight + 1
      },
      hero: rect(select('.ui-ending-hero')),
      title: {
        rect: titleRect,
        text: title.textContent.trim(),
        fontSize: Number.parseFloat(style(title).fontSize),
        estimatedLines: titleRect
          ? Math.max(1, Math.round(titleRect.height / Number.parseFloat(style(title).lineHeight)))
          : 0
      },
      description: rect(byId('ui-ending-desc')),
      quote: {
        rect: rect(quote),
        text: quote.textContent.trim(),
        fontSize: Number.parseFloat(style(quote).fontSize)
      },
      quoteLabel: select('.ui-ending-quote-label')?.textContent.trim() || '',
      sectionHeading: {
        rect: rect(select('.ui-ending-section-heading')),
        text: select('.ui-ending-section-heading')?.textContent.trim() || ''
      },
      analysis: rect(analysis),
      stats: rect(byId('ui-ending-stats')),
      copy: rect(select('.ui-ending-copy')),
      achievements: rect(byId('ui-ending-achievements')),
      actionContext: {
        rect: rect(select('.ui-ending-action-context')),
        text: select('.ui-ending-action-context')?.textContent.trim() || ''
      },
      actions: {
        rect: actionsRect,
        visibleInViewport: Boolean(
          actionsRect &&
          actionsRect.top >= 0 &&
          actionsRect.bottom <= viewport.height
        ),
        labels: actionButtons.map(button => button.textContent.trim()),
        classes: actionButtons.map(button => button.className),
        primaryLabel: buttons.querySelector('.ui-ending-btn-primary')?.textContent.trim() || '',
        moreExpanded: buttons.querySelector('.ui-ending-btn-more')?.getAttribute('aria-expanded'),
        minHeights: actionButtons.map(button => Math.round(rect(button).height))
      },
      visualOrder: [
        ['title', rect(title)?.top],
        ['quote', rect(quote)?.top],
        ['analysis', rect(analysis)?.top],
        ['achievements', rect(byId('ui-ending-achievements'))?.top],
        ['actions', actionsRect?.top]
      ]
    };
  });

  result.errors = errors;
  result.guardrails = {
    noRuntimeErrors: errors.length === 0,
    titleFitsHorizontally: result.title.rect.left >= 0 &&
      result.title.rect.right <= viewport.width,
    quoteFollowsIdentity: result.quote.rect.top >= result.title.rect.bottom,
    actionsRemainVisible: result.actions.visibleInViewport,
    actionTargetsAtLeast44px: result.actions.minHeights.every(height => height >= 44)
  };
  result.passed = Object.values(result.guardrails).every(Boolean);
  await context.close();
  return result;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const viteCli = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const preview = spawn(process.execPath, [
    viteCli,
    'preview',
    '--host', '127.0.0.1',
    '--port', String(PORT),
    '--strictPort'
  ], {
    cwd: ROOT,
    stdio: 'ignore',
    windowsHide: true
  });

  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch();
    const results = [];
    for (const viewport of viewports) {
      results.push(await captureViewport(browser, viewport));
    }
    const report = {
      schemaVersion: 1,
      round,
      phase,
      generatedAt: new Date().toISOString(),
      passed: results.every(result => result.passed),
      results
    };
    fs.writeFileSync(
      path.join(OUT, 'report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    preview.kill();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
