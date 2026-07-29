/**
 * 声音相关 UI 的统一呈现层。
 * AudioSystem / localStorage 仍是唯一状态源；此模块只负责把同一状态翻译成
 * 标题、游戏顶栏、暂停菜单都一致的标签、pressed 语义和 live feedback。
 */
export function getAudioControlState(audio) {
  const soundEnabled = Boolean(audio?.enabled);
  const narration = audio?.getNarrationModeInfo?.() || {
    key: 'highlights',
    label: '金句',
    shortLabel: '金句',
    desc: '只朗读剧情中的高亮金句'
  };
  const voice = audio?.getVoicePreset?.() || {
    key: 'luo_style',
    label: '沉稳演讲'
  };
  return {
    sound: {
      enabled: soundEnabled,
      label: soundEnabled ? '开启' : '静音',
      icon: soundEnabled ? '♪' : '×',
      ariaPressed: String(soundEnabled),
      ariaLabel: `声音：${soundEnabled ? '开启' : '静音'}。点击${
        soundEnabled ? '静音' : '开启'
      }`
    },
    narration: {
      ...narration,
      enabled: narration.key !== 'off',
      ariaPressed: String(narration.key !== 'off'),
      ariaLabel: `剧情朗读：${narration.label}。点击切换`
    },
    voice
  };
}

export function getVoiceSettingsTriggerText(audio) {
  const state = getAudioControlState(audio);
  return `♪ 朗读设置 · ${state.narration.label} / ${state.voice.label}`;
}

export function getVoiceSettingsAriaLabel(audio) {
  const state = getAudioControlState(audio);
  return `朗读设置：${state.narration.label}，${state.voice.label}`;
}

export function getSpeechSupportState(audio) {
  return audio?.getSpeechSupportInfo?.() || {
    state: 'ready',
    supported: true,
    canPreview: true,
    hasChineseVoice: true,
    label: '系统朗读可用',
    detail: '使用当前设备的中文系统语音'
  };
}

export function announceAudioState(message) {
  const status = document.getElementById('ui-audio-status');
  if (!status || !message) return false;
  // 先清空再写入，连续两次切回同一状态时仍会触发 live region。
  status.textContent = '';
  status.textContent = message;
  return true;
}
