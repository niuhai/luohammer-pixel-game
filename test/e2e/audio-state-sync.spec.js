import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const EVIDENCE_ROOT = path.join(ROOT, '.iteration', 'ui', 'evidence', 'R024');
const BEFORE_REPORT = path.join(EVIDENCE_ROOT, 'before', 'report.json');
const PHASE = fs.existsSync(BEFORE_REPORT) ? 'after' : 'before';
const OUT = path.join(EVIDENCE_ROOT, PHASE);

const SAVED_STATE = {
  pride: 6,
  wealth: 4,
  reputation: 5,
  failures: 1,
  pressure: 3,
  trust: 5,
  pressureMax: 10,
  failurePenalty: 1,
  successBonus: 1,
  talentSpecials: [],
  currentStageId: 'teacher',
  currentNode: 'act1_first',
  flags: [],
  triggeredEvents: [],
  history: [],
  achievements: [],
  gameStartTime: Date.now() - 60_000
};

async function installSavedAudioState(page) {
  await page.goto('/');
  await page.evaluate(state => {
    localStorage.clear();
    localStorage.setItem('luohammer_save', JSON.stringify(state));
    localStorage.setItem('luohammer_save_backup', JSON.stringify(state));
    localStorage.setItem('luohammer_audio', 'false');
    localStorage.setItem('luohammer_narration_mode', 'full');
    localStorage.setItem('luohammer_narration', 'true');
    localStorage.setItem('luohammer_voice_preset', 'warm_female');
    localStorage.setItem('luohammer_orientation_hint_seen', '1');
  }, SAVED_STATE);
  await page.reload();
  await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ui-boot-sound-toggle')).toBeVisible({ timeout: 15_000 });
  const voiceSettings = page.locator('#ui-boot-buttons button', {
    hasText: '朗读设置'
  });
  await expect(voiceSettings).toHaveCount(1, { timeout: 15_000 });
  if (!await voiceSettings.isVisible()) {
    await page.locator('#ui-boot-more-toggle').click();
  }
  await expect(voiceSettings).toBeVisible();
}

async function readTitleAudioState(page) {
  return page.evaluate(() => {
    const sound = document.getElementById('ui-boot-sound-toggle');
    const voice = [...document.querySelectorAll('#ui-boot-buttons button')]
      .find(button => button.textContent.includes('朗读设置'));
    const status = document.getElementById('ui-audio-status');
    const soundRect = sound?.getBoundingClientRect();
    const voiceRect = voice?.getBoundingClientRect();
    return {
      soundText: sound?.textContent.trim() || '',
      soundLabel: sound?.getAttribute('aria-label') || '',
      soundPressed: sound?.getAttribute('aria-pressed'),
      voiceText: voice?.textContent.replace(/\s+/g, ' ').trim() || '',
      voiceLabel: voice?.getAttribute('aria-label') || '',
      voiceExpanded: voice?.getAttribute('aria-expanded'),
      voiceControls: voice?.getAttribute('aria-controls') || '',
      statusExists: Boolean(status),
      statusText: status?.textContent.trim() || '',
      soundBox: soundRect ? {
        left: Math.round(soundRect.left),
        right: Math.round(soundRect.right),
        top: Math.round(soundRect.top),
        bottom: Math.round(soundRect.bottom),
        height: Math.round(soundRect.height)
      } : null,
      voiceBox: voiceRect ? {
        left: Math.round(voiceRect.left),
        right: Math.round(voiceRect.right),
        top: Math.round(voiceRect.top),
        bottom: Math.round(voiceRect.bottom),
        height: Math.round(voiceRect.height)
      } : null,
      viewport: { width: innerWidth, height: innerHeight },
      stored: {
        sound: localStorage.getItem('luohammer_audio'),
        narration: localStorage.getItem('luohammer_narration_mode'),
        voice: localStorage.getItem('luohammer_voice_preset')
      }
    };
  });
}

async function readGameAudioState(page) {
  return page.evaluate(() => {
    const sound = document.getElementById('ui-sound-toggle');
    const narration = document.getElementById('ui-narration-toggle');
    const voice = document.getElementById('ui-voice-toggle');
    const menuSound = document.getElementById('ui-menu-sound-setting');
    const menuNarration = document.getElementById('ui-menu-narration-setting');
    const menuVoice = document.getElementById('ui-menu-voice-setting');
    const pauseBox = document.querySelector('.ui-menu-confirm-box')
      ?.getBoundingClientRect();
    return {
      sound: {
        text: sound?.textContent.trim() || '',
        label: sound?.getAttribute('aria-label') || '',
        pressed: sound?.getAttribute('aria-pressed')
      },
      narration: {
        text: narration?.textContent.trim() || '',
        label: narration?.getAttribute('aria-label') || '',
        pressed: narration?.getAttribute('aria-pressed')
      },
      voice: {
        text: voice?.textContent.trim() || '',
        label: voice?.getAttribute('aria-label') || ''
      },
      menu: {
        soundText: menuSound?.textContent.replace(/\s+/g, ' ').trim() || '',
        soundPressed: menuSound?.getAttribute('aria-pressed'),
        narrationText: menuNarration?.textContent.replace(/\s+/g, ' ').trim() || '',
        narrationPressed: menuNarration?.getAttribute('aria-pressed'),
        voiceText: menuVoice?.textContent.replace(/\s+/g, ' ').trim() || ''
      },
      statusText: document.getElementById('ui-audio-status')?.textContent.trim() || '',
      pauseBox: pauseBox ? {
        left: Math.round(pauseBox.left),
        right: Math.round(pauseBox.right),
        top: Math.round(pauseBox.top),
        bottom: Math.round(pauseBox.bottom)
      } : null,
      viewport: { width: innerWidth, height: innerHeight },
      stored: {
        sound: localStorage.getItem('luohammer_audio'),
        narration: localStorage.getItem('luohammer_narration_mode'),
        voice: localStorage.getItem('luohammer_voice_preset')
      }
    };
  });
}

async function collectCrossSceneState(browser, viewport, label, options = {}) {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173/',
    viewport,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await installSavedAudioState(page);

  const titleInitial = await readTitleAudioState(page);
  await page.locator('#ui-boot-sound-toggle').click();
  await page.waitForTimeout(80);
  const titleChanged = await readTitleAudioState(page);
  if (options.captureEvidence) {
    await page.screenshot({ path: path.join(OUT, `${label}-title-audio.png`) });
  }

  await page.locator('#ui-boot-buttons button', { hasText: '继续游戏' }).click({
    force: true
  });
  await expect(page.locator('#ui-chapter')).toHaveClass(/visible/, {
    timeout: 20_000
  });
  const gameInitial = await readGameAudioState(page);

  await page.locator('#ui-menu-toggle').click();
  await expect(page.locator('#ui-menu-confirm')).toHaveClass(/visible/);
  const pauseInitial = await readGameAudioState(page);
  await page.locator('#ui-menu-sound-setting').click();
  await page.locator('#ui-menu-narration-setting').click();
  await page.locator('#ui-menu-voice-setting').click();
  const pauseChanged = await readGameAudioState(page);
  if (options.captureEvidence) {
    await page.screenshot({ path: path.join(OUT, `${label}-pause-audio.png`) });
  }

  await page.locator('#ui-menu-ok').click();
  await expect(page.locator('#ui-boot-overlay')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#ui-boot-sound-toggle')).toBeVisible({ timeout: 15_000 });
  const titleReturned = await readTitleAudioState(page);

  await context.close();
  return {
    titleInitial,
    titleChanged,
    gameInitial,
    pauseInitial,
    pauseChanged,
    titleReturned
  };
}

async function collectUnsupportedSpeech(browser) {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173/',
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block'
  });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: undefined
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: undefined
    });
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const trigger = page.locator('#ui-boot-buttons button', { hasText: '朗读设置' });
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const panel = page.locator('.ui-voice-panel');
  await expect(panel).toBeVisible();
  const state = await panel.evaluate(element => {
    const previews = [...element.querySelectorAll('button')]
      .filter(button => button.textContent.trim() === '试听');
    const select = element.querySelector('select');
    const rect = element.getBoundingClientRect();
    return {
      role: element.getAttribute('role') || '',
      ariaModal: element.getAttribute('aria-modal'),
      labelledBy: element.getAttribute('aria-labelledby') || '',
      reasonText: element.textContent.replace(/\s+/g, ' ').trim(),
      previewCount: previews.length,
      disabledPreviewCount: previews.filter(button => button.disabled).length,
      selectDisabled: Boolean(select?.disabled),
      focusedInPanel: element.contains(document.activeElement),
      minButtonHeight: Math.min(...[...element.querySelectorAll('button')]
        .map(button => Math.round(button.getBoundingClientRect().height))),
      zIndex: Number.parseInt(getComputedStyle(element).zIndex, 10),
      rotateHintHidden: document.getElementById('rotate-hint')
        ?.classList.contains('hidden') ?? true,
      box: {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        viewportWidth: innerWidth,
        viewportHeight: innerHeight
      }
    };
  });
  await page.screenshot({ path: path.join(OUT, 'mobile-unsupported-speech.png') });

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  state.focusRestored = await trigger.evaluate(element =>
    document.activeElement === element
  );
  state.rotateHintRestored = await page.locator('#rotate-hint').evaluate(element =>
    !element.classList.contains('hidden')
  );
  await context.close();
  return state;
}

test('音频、朗读和配音状态应跨场景一致并解释系统语音不可用', async ({
  browser
}) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  const viewportSpecs = [
    { label: 'desktop-1440', width: 1440, height: 900, captureEvidence: true },
    { label: 'desktop-1366', width: 1366, height: 768 },
    { label: 'desktop-1920', width: 1920, height: 1080 },
    { label: 'mobile-390', width: 390, height: 844, captureEvidence: true },
    { label: 'mobile-375', width: 375, height: 812 },
    { label: 'mobile-360', width: 360, height: 800 }
  ];
  const [journeyEntries, unsupported] = await Promise.all([
    Promise.all(viewportSpecs.map(async spec => [
      spec.label,
      await collectCrossSceneState(
        browser,
        { width: spec.width, height: spec.height },
        spec.label,
        { captureEvidence: spec.captureEvidence }
      )
    ])),
    collectUnsupportedSpeech(browser)
  ]);
  const matrix = Object.fromEntries(journeyEntries);
  const desktop = matrix['desktop-1440'];
  const mobile = matrix['mobile-390'];
  const result = {
    schemaVersion: 1,
    round: 'R024',
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    desktop,
    mobile,
    matrix,
    unsupported
  };
  result.passed = PHASE === 'before' || (
    Object.values(matrix).every(journey =>
      journey.titleInitial.soundPressed === 'false' &&
      journey.titleInitial.soundLabel.includes('静音') &&
      journey.titleInitial.voiceText.includes('完整') &&
      journey.titleInitial.voiceText.includes('温和叙事') &&
      journey.titleInitial.voiceExpanded === 'false' &&
      journey.titleInitial.statusExists &&
      journey.titleInitial.soundBox.height >= 44 &&
      journey.titleInitial.voiceBox.height >= 44 &&
      journey.titleInitial.soundBox.left >= 0 &&
      journey.titleInitial.soundBox.right <= journey.titleInitial.viewport.width &&
      journey.titleInitial.voiceBox.left >= 0 &&
      journey.titleInitial.voiceBox.right <= journey.titleInitial.viewport.width &&
      journey.titleChanged.soundPressed === 'true' &&
      journey.titleChanged.soundLabel.includes('开启') &&
      journey.titleChanged.statusText.includes('声音已开启') &&
      journey.gameInitial.sound.pressed === 'true' &&
      journey.gameInitial.narration.text.includes('全文') &&
      journey.pauseInitial.menu.soundPressed === 'true' &&
      journey.pauseChanged.sound.pressed === 'false' &&
      journey.pauseChanged.menu.soundPressed === 'false' &&
      journey.pauseChanged.menu.narrationText.includes('无障碍') &&
      journey.pauseChanged.statusText.length > 0 &&
      journey.pauseChanged.pauseBox.left >= 0 &&
      journey.pauseChanged.pauseBox.right <= journey.pauseChanged.viewport.width &&
      journey.pauseChanged.pauseBox.top >= 0 &&
      journey.pauseChanged.pauseBox.bottom <= journey.pauseChanged.viewport.height &&
      journey.titleReturned.soundPressed === 'false' &&
      journey.titleReturned.voiceText.includes('无障碍')
    ) &&
    unsupported.role === 'dialog' &&
    unsupported.ariaModal === 'true' &&
    unsupported.reasonText.includes('不支持系统朗读') &&
    unsupported.disabledPreviewCount === unsupported.previewCount &&
    unsupported.selectDisabled &&
    unsupported.focusedInPanel &&
    unsupported.minButtonHeight >= 44 &&
    unsupported.zIndex > 99990 &&
    unsupported.rotateHintHidden &&
    unsupported.rotateHintRestored &&
    unsupported.box.left >= 0 &&
    unsupported.box.right <= unsupported.box.viewportWidth &&
    unsupported.box.top >= 0 &&
    unsupported.box.bottom <= unsupported.box.viewportHeight &&
    unsupported.focusRestored
  );
  fs.writeFileSync(
    path.join(OUT, 'report.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8'
  );
  expect(result.passed).toBeTruthy();
});
