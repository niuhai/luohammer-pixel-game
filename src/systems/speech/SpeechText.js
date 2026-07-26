const HTML_ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' '
};

const ACRONYM_REPLACEMENTS = new Map([
  ['AI', 'A I'],
  ['AR', 'A R'],
  ['CEO', 'C E O'],
  ['GRE', 'G R E'],
  ['MP3', 'M P 三'],
  ['PPT', 'P P T'],
  ['ROM', 'R O M'],
  ['TNT', 'T N T']
]);

export const SPEECH_CHUNK_MIN = 24;
export const SPEECH_CHUNK_MAX = 68;

/**
 * 将剧情富文本转换为适合朗读的纯文本。保留引号和标点，因为它们会影响
 * 系统 TTS 的停顿与语气；只移除展示用标签和装饰符号。
 */
export function stripSpeechMarkup(text) {
  if (!text) return '';
  return String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/gi, entity => HTML_ENTITY_MAP[entity.toLowerCase()] || entity);
}

/**
 * 提取 <b> 金句。金句模式只读显式高亮内容，避免把整段长文都念完。
 */
export function extractSpeechHighlights(richText) {
  if (!richText) return '';
  const highlights = [...String(richText).matchAll(/<b>([\s\S]*?)<\/b>/gi)]
    .map(match => stripSpeechMarkup(match[1]).trim())
    .filter(Boolean);
  return highlights
    .map((highlight, index) => {
      if (index === highlights.length - 1 || /[。！？!?；;：:]$/.test(highlight)) return highlight;
      return `${highlight}。`;
    })
    .join('');
}

/**
 * 统一常见数字和英文缩写的读法。这里保持规则克制：无法可靠判断的品牌名
 * 交给系统语音自行处理，避免“修正”后反而更难听。
 */
export function normalizeSpeechText(text) {
  let normalized = stripSpeechMarkup(text)
    .replace(/[◊▲◆★✦⚠]/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, '百分之$1')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1比$2')
    .replace(/\s*\+\s*(?=\d)/g, '加')
    .replace(/\n+/g, '。')
    .replace(/[ \t]+/g, ' ')
    .replace(/。{2,}/g, '。')
    .trim();

  for (const [source, spoken] of ACRONYM_REPLACEMENTS) {
    const pattern = new RegExp(`\\b${source}\\b`, 'gi');
    normalized = normalized.replace(pattern, spoken);
  }

  return normalized;
}

function findPreferredBreak(text, start, hardEnd, minChars) {
  const lowerBound = Math.min(hardEnd, start + minChars);
  const strong = '。！？!?；;：:';
  const weak = '，,、';

  for (let i = hardEnd - 1; i >= lowerBound; i--) {
    if (strong.includes(text[i])) return i + 1;
  }
  for (let i = hardEnd - 1; i >= lowerBound; i--) {
    if (weak.includes(text[i])) return i + 1;
  }
  return hardEnd;
}

/**
 * 将长文本拆成短语音块。块长控制在约 24–68 字，优先在句号、问号、
 * 感叹号处断开，其次才使用逗号，降低 Web Speech 长句截断概率。
 */
export function splitSpeechText(text, {
  minChars = SPEECH_CHUNK_MIN,
  maxChars = SPEECH_CHUNK_MAX
} = {}) {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    const remaining = normalized.length - start;
    if (remaining <= maxChars) {
      chunks.push(normalized.slice(start).trim());
      break;
    }

    const hardEnd = Math.min(normalized.length, start + maxChars);
    const end = findPreferredBreak(normalized, start, hardEnd, minChars);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end;
    while (start < normalized.length && /\s/.test(normalized[start])) start++;
  }

  // 避免最后只剩几个字：在不明显超过上限的情况下并回上一块。
  if (chunks.length > 1 && chunks[chunks.length - 1].length < Math.floor(minChars / 2)) {
    const tail = chunks.pop();
    const previous = chunks.pop();
    chunks.push(`${previous}${tail}`);
  }

  return chunks;
}
