import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R017');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const hasPassingBaseline = fs.existsSync(BEFORE_REPORT) &&
  JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8')).passed === true;
const PHASE = hasPassingBaseline ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

async function openVoicePanel(page) {
  await page.evaluate(async () => {
    const boot = document.getElementById('ui-boot-overlay');
    if (boot) {
      boot.classList.remove('visible');
      boot.style.display = 'none';
    }
    const skip = document.getElementById('ui-intro-skip-hint');
    if (skip) skip.style.display = 'none';

    const { GameScene } = await import(
      '/luohammer-pixel-game/src/scenes/GameScene.js'
    );
    let trigger = document.getElementById('ui-quick-voice-probe-trigger');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.id = 'ui-quick-voice-probe-trigger';
      trigger.type = 'button';
      trigger.textContent = '打开朗读设置';
      trigger.style.cssText = [
        'position: fixed',
        'inset: 0 auto auto 0',
        'width: 44px',
        'height: 44px',
        'opacity: 0',
        'pointer-events: none'
      ].join(';');
      document.body.appendChild(trigger);
    }
    trigger.focus();

    const audio = {
      narrationMode: 'highlights',
      presetKey: 'luo_style',
      voiceName: '',
      previewCalls: [],
      getVoicePresetKey() {
        return this.presetKey;
      },
      getNarrationMode() {
        return this.narrationMode;
      },
      getVoiceList() {
        return [
          { name: 'Microsoft Yunyang', lang: 'zh-CN' },
          { name: 'Microsoft Xiaoxiao', lang: 'zh-CN' }
        ];
      },
      getVoiceName() {
        return this.voiceName;
      },
      setVoiceName(name) {
        this.voiceName = name;
      },
      setNarrationMode(mode) {
        this.narrationMode = mode;
      },
      setVoicePreset(key) {
        this.presetKey = key;
        return true;
      },
      previewVoicePreset(key) {
        this.previewCalls.push(key || this.presetKey);
      },
      speak() {},
      stopSpeaking() {}
    };
    const scene = {
      audio,
      dialog: {
        _plainText: '这是当前正在阅读的一段剧情。',
        fullText: '这是当前正在阅读的一段剧情。',
        _currentMood: 'reflective'
      },
      voiceToggleEl: trigger,
      _quickVoicePanelEl: null,
      _quickVoicePanelOnKey: null,
      _voicePreviousFocus: null,
      _updateNarrationToggleState() {},
      _syncPauseMenuSettings() {},
      _updateVoiceToggleLabel() {}
    };
    scene._showQuickVoicePanel = () =>
      GameScene.prototype._showQuickVoicePanel.call(scene);
    scene._closeQuickVoicePanel = (restoreFocus = true) =>
      GameScene.prototype._closeQuickVoicePanel.call(scene, restoreFocus);
    window.__quickVoiceProbe = scene;
    scene._showQuickVoicePanel();
  });
  await expect(page.locator('#ui-quick-voice-panel')).toBeVisible();
  await page.waitForTimeout(320);
}

async function closeVoicePanel(page) {
  await page.evaluate(() => window.__quickVoiceProbe?._closeQuickVoicePanel());
}

async function readPanelState(page) {
  return page.locator('#ui-quick-voice-panel').evaluate(panel => {
    const card = panel.firstElementChild;
    const buttons = [...panel.querySelectorAll('button')];
    const modeButtons = [...panel.querySelectorAll('.ui-quick-voice-mode')];
    const resolvedModes = modeButtons.length > 0 ? modeButtons : buttons.slice(0, 4);
    const modeGrid = panel.querySelector('.ui-quick-voice-mode-grid') ||
      resolvedModes[0]?.parentElement;
    const close = buttons.find(button => button.textContent.trim().startsWith('✕'));
    const actionButtons = buttons.filter(button =>
      /试听|应用|当前|重播|关闭/.test(button.textContent)
    );
    const actionHeights = actionButtons.map(button =>
      Math.round(button.getBoundingClientRect().height)
    );
    const cardBox = card.getBoundingClientRect();
    const gridColumns = getComputedStyle(modeGrid).gridTemplateColumns
      .split(' ')
      .filter(Boolean);
    const focused = document.activeElement;
    return {
      role: panel.getAttribute('role') || '',
      labelledBy: panel.getAttribute('aria-labelledby') || '',
      panelClass: panel.className,
      panelInlineStyle: panel.getAttribute('style') || '',
      cardClass: card.className,
      modeColumnCount: gridColumns.length,
      modeButtonCount: resolvedModes.length,
      currentModePressed: resolvedModes
        .map(button => button.getAttribute('aria-pressed'))
        .filter(value => value === 'true').length,
      minModeHeight: Math.min(...resolvedModes.map(button =>
        Math.round(button.getBoundingClientRect().height)
      )),
      minActionHeight: Math.min(...actionHeights),
      currentDeviceText: panel.querySelector('.ui-quick-voice-current-device')
        ?.textContent.replace(/\s+/g, ' ').trim() || '',
      closeText: close?.textContent.replace(/\s+/g, ' ').trim() || '',
      initialFocusText: focused?.textContent?.replace(/\s+/g, ' ').trim() || '',
      initialFocusInPanel: panel.contains(focused),
      cardBox: {
        left: Math.round(cardBox.left),
        top: Math.round(cardBox.top),
        right: Math.round(cardBox.right),
        bottom: Math.round(cardBox.bottom),
        width: Math.round(cardBox.width),
        height: Math.round(cardBox.height)
      },
      viewport: {
        width: innerWidth,
        height: innerHeight
      }
    };
  });
}

test('朗读设置应具备响应式布局、44px 操作和完整焦点闭环', async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('/');

  await page.setViewportSize({ width: 1440, height: 900 });
  await openVoicePanel(page);
  const desktop = await readPanelState(page);
  await page.screenshot({ path: path.join(OUT, 'desktop-voice-panel.png') });
  await closeVoicePanel(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await openVoicePanel(page);
  const mobile = await readPanelState(page);
  await page.screenshot({ path: path.join(OUT, 'mobile-voice-panel.png') });

  const closeButton = page.locator('#ui-quick-voice-panel button', {
    hasText: /^✕ 关闭$/
  });
  await closeButton.focus();
  await page.keyboard.press('Tab');
  const tabCycle = await page.evaluate(() => {
    const panel = document.getElementById('ui-quick-voice-panel');
    return {
      focusStayedInPanel: panel.contains(document.activeElement),
      focusedText: document.activeElement?.textContent
        ?.replace(/\s+/g, ' ').trim() || ''
    };
  });

  await page.keyboard.press('Escape');
  await expect(page.locator('#ui-quick-voice-panel')).toHaveCount(0);
  const closeFlow = await page.evaluate(() => ({
    triggerFocused: document.activeElement ===
      document.getElementById('ui-quick-voice-probe-trigger'),
    triggerExpanded: document.getElementById('ui-quick-voice-probe-trigger')
      ?.getAttribute('aria-expanded'),
    backgroundInert: document.getElementById('ui-overlay')?.inert || false
  }));

  const report = {
    schemaVersion: 1,
    round: 'R017',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktop,
    mobile,
    tabCycle,
    closeFlow
  };
  report.passed = desktop.role === 'dialog' &&
    mobile.cardBox.left >= 0 &&
    mobile.cardBox.right <= mobile.viewport.width &&
    mobile.cardBox.top >= 0 &&
    mobile.cardBox.bottom <= mobile.viewport.height &&
    desktop.currentDeviceText.includes('当前设备语音') &&
    mobile.currentDeviceText.includes('当前设备语音') &&
    closeFlow.triggerExpanded === 'false' &&
    !closeFlow.backgroundInert;
  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  expect(report.passed).toBeTruthy();
  if (PHASE === 'after') {
    const before = JSON.parse(fs.readFileSync(BEFORE_REPORT, 'utf8'));
    expect(before.mobile.modeColumnCount).toBe(4);
    expect(before.mobile.minModeHeight).toBeLessThan(44);
    expect(before.mobile.minActionHeight).toBeLessThan(44);
    expect(before.tabCycle.focusStayedInPanel).toBeFalsy();
    expect(before.closeFlow.triggerFocused).toBeFalsy();

    expect(desktop.labelledBy).toBe('ui-quick-voice-title');
    expect(desktop.panelClass).toContain('ui-quick-voice-panel');
    expect(desktop.panelInlineStyle).toBe('');
    expect(desktop.currentModePressed).toBe(1);
    expect(desktop.modeColumnCount).toBe(4);
    expect(mobile.modeColumnCount).toBe(2);
    expect(mobile.minModeHeight).toBeGreaterThanOrEqual(44);
    expect(mobile.minActionHeight).toBeGreaterThanOrEqual(44);
    expect(mobile.initialFocusText).toContain('金句');
    expect(tabCycle.focusStayedInPanel).toBeTruthy();
    expect(tabCycle.focusedText).toMatch(/试听当前语音|关闭/);
    expect(closeFlow.triggerFocused).toBeTruthy();
  }
});

test('应用朗读节奏后应立即试听并关闭浮层', async ({ page }) => {
  await page.goto('/');
  await openVoicePanel(page);

  const applyButton = page.locator('.ui-quick-voice-action.apply:not(:disabled)').first();
  await expect(applyButton).toBeVisible();
  await applyButton.click();

  await expect(page.locator('#ui-quick-voice-panel')).toHaveCount(0);
  const previewCalls = await page.evaluate(() =>
    window.__quickVoiceProbe?.audio?.previewCalls || []
  );
  expect(previewCalls.length).toBeGreaterThan(0);
});
