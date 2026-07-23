/**
 * AI 人生复盘系统
 *
 * 结局画面「AI 人生复盘」按钮的核心逻辑。
 * 两条路径：
 *  1. 大模型复盘（配置 VITE_ARK_API_KEY 后启用，火山方舟 Doubao）——真正的运行时 AI
 *  2. 本地复盘引擎（兜底）——基于属性模式匹配的老罗风格洞察，离线可用，演示现场零风险
 *
 * UI 自包含：弹窗 DOM 与样式由本文件注入，不污染 index.html。
 */

const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

export class AIReviewSystem {
  /**
   * @param {object} opts
   * @param {object} opts.state  本局最终状态（属性/天赋/flags/history）
   * @param {object} opts.ending 结局展示数据（title/desc/quote/summary）
   * @param {string} opts.endingKey 结局 id
   */
  constructor(opts) {
    this.state = opts.state || {};
    this.ending = opts.ending || {};
    this.endingKey = opts.endingKey || 'default';
    this.apiKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ARK_API_KEY) || '';
    this.model = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ARK_MODEL) || 'doubao-1-5-pro-32k-250115';
  }

  get isLLMEnabled() { return !!this.apiKey; }

  /**
   * 生成复盘文案。LLM 失败自动回退本地引擎，绝不抛出。
   * @returns {Promise<{text: string, source: 'llm'|'local'}>}
   */
  async generate() {
    if (this.isLLMEnabled) {
      try {
        const text = await this._callLLM();
        if (text) return { text, source: 'llm' };
      } catch (e) {
        console.warn('[AIReview] LLM 复盘失败，回退本地引擎:', e && e.message);
      }
    }
    return { text: this._localReview(), source: 'local' };
  }

  // ================= LLM 路径 =================

  async _callLLM() {
    const s = this.state;
    const attrs = `理想${s.pride ?? 0}/10，财富${s.wealth ?? 0}/10，名声${s.reputation ?? 0}/10，公众信任${s.trust ?? 0}/10，压力${s.pressure ?? 0}/10，翻车${s.failures ?? 0}次`;
    const choices = (s.history || [])
      .slice(-8)
      .map(h => (h.choiceLabel || '').replace(/<[^>]+>/g, '').slice(0, 30))
      .filter(Boolean)
      .join('；');
    const endingTitle = (this.ending.title || '').replace(/<[^>]+>/g, '');

    const systemPrompt = [
      '你是一位毒舌又温暖的人生评论员，口吻酷似罗永浩：直率、自嘲、有理想主义底色，善用短句和反转。',
      '为玩家的一局「罗永浩人生模拟器」写 120-180 字复盘。',
      '要求：1) 先点出玩家与老罗最大的相同或不同；2) 针对属性分布给一句犀利洞察；3) 结尾给一句有金句感的收束。',
      '禁止罗列数字，禁止使用"属性""数值""系统"这类游戏术语，用"你"称呼玩家。'
    ].join('');
    const userPrompt = `玩家走出了结局「${endingTitle}」。人生答卷：${attrs}。关键时刻的选择：${choices || '（无记录）'}。`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(ARK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 400
        }),
        signal: controller.signal
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return (text || '').trim();
    } finally {
      clearTimeout(timer);
    }
  }

  // ================= 本地复盘引擎 =================

  _localReview() {
    const s = this.state;
    const p = s.pride || 0, w = s.wealth || 0, r = s.reputation || 0;
    const t = s.trust ?? 5, pr = s.pressure || 0, f = s.failures || 0;

    const patterns = [
      { when: () => p >= 6 && w >= 6 && r >= 6 && f <= 2, key: 'perfect',
        text: '你几乎把所有牌都打对了——理想没丢，钱也赚到了，名声还在。这种人生只存在两种可能：要么你是天才，要么你偷偷重开了好几局。' },
      { when: () => pr >= 9, key: 'collapse',
        text: '压垮你的从来不是最后那根稻草，是之前每一根你都说"没事"的稻草。你不是输给了现实，是输给了硬撑。' },
      { when: () => p >= 7 && f >= 2, key: 'idealist_fighter',
        text: '你不是被现实打垮的，是被自己太当回事打垮的——但换个说法，这叫不妥协。理想主义者的宿命就是：输的时候比谁都惨，赢的时候比谁都值。' },
      { when: () => p >= 6 && w <= 3, key: 'poor_idealist',
        text: '你守住了理想，没守住钱包。这种人在世界上活得很累，但世界正是因为有这种人，才没那么快烂掉。' },
      { when: () => p <= 3 && w >= 7, key: 'pragmatic_rich',
        text: '你没有被理想饿死，这很了不起。只是偶尔夜深人静的时候，你可能会梦见当年那个什么都不服、什么都敢砸的自己。' },
      { when: () => r >= 7 && w <= 3, key: 'famous_broke',
        text: '你赢得了所有人的掌声，除了银行柜员的。名声是最贵的资产，也是最难变现的资产——你比谁都清楚这一点。' },
      { when: () => f >= 3 && (w >= 5 || r >= 6), key: 'comeback_king',
        text: '你跌倒的次数比大多数人尝试的次数都多。但你站起来了——这才是"真还传"的本义：还的不是钱，是当初吹过的牛。' },
      { when: () => f >= 4, key: 'disaster',
        text: '翻车四次以上还能坐在这里看结局，说明两件事：第一，你命硬；第二，你的每一次翻车，都成了别人眼里的路标。' },
      { when: () => t >= 7 && r >= 6, key: 'trusted_icon',
        text: '你被讨论、被围观、被转发，更难得的是被信任。在这个塌房比翻书还快的时代，信任是比传奇更稀缺的结局。' },
      { when: () => r >= 7 && t <= 3, key: 'controversial_star',
        text: '你被所有人看见，却没几个人真正站在你这边。热闹是流量给的，孤独是自己选的——你早就知道这两件事是一体的。' },
      { when: () => p >= 4 && p <= 6 && w >= 4 && w <= 6 && r >= 4 && r <= 6, key: 'balanced',
        text: '没有大起大落，没有惊天动地。但把"平衡"两个字做到的人，比做成任何一件惊天大事的人都少。这局你走得稳，稳本身就是一种赢。' },
      { when: () => t <= 2, key: 'loner',
        text: '你习惯了一个人扛。有些仗一个人确实打不赢，但你硬是把"打不赢"打成了"还在打"。' },
      { when: () => pr >= 7, key: 'pressure_cooker',
        text: '你把所有压力都调成了静音。外人看你云淡风轻，只有你自己知道，静音不等于没有声音。' },
      { when: () => p <= 4 && w <= 4 && r <= 4 && f <= 1, key: 'quiet',
        text: '你避开了所有的坑，也错过了所有的风景。平凡不是失败——只是偶尔你会不会想：如果当年摔那一本课本，会怎样？' }
    ];

    const hit = patterns.find(pt => pt.when());

    const openings = {
      legendary: '先说结论：这局你活成了传说里才有的样子。',
      tragic: '先说结论：这局不好走，但你走完了。',
      peaceful: '先说结论：这局不惊天动地，但细水长流。',
      default: '先说结论：这局你走得很有自己的样子。'
    };
    const tier = this._endingTier();
    const opening = openings[tier] || openings.default;

    const closing = p >= 6
      ? '记住你此刻的样子——那个在十字路口不肯低头的人，以后别弄丢了他。'
      : w >= 6
        ? '钱是赚不完的，但当年为什么出发，只能想得起一次。'
        : '人生没有标准答案，但你这一局的答案，是你自己一笔一笔写的。';

    const insight = hit ? hit.text : '你的每一步都中规中矩，但回头看，中规中矩本身就是最难复制的路。';
    return `${opening}${insight}${closing}`;
  }

  _endingTier() {
    const legendary = ['legend', 'phoenix', 'warrior', 'returns', 'comeback', 'tycoon', 'balance'];
    const tragic = ['scapegoat', 'bankrupt_early', 'escape', 'supply_chain', 'rational'];
    const peaceful = ['peace', 'monk', 'hermit', 'comfort', 'ordinary', 'scholar'];
    if (legendary.includes(this.endingKey)) return 'legendary';
    if (tragic.includes(this.endingKey)) return 'tragic';
    if (peaceful.includes(this.endingKey)) return 'peaceful';
    return 'default';
  }
}

// ================= 自包含弹窗 UI =================

let _reviewStylesInjected = false;

function _injectReviewStyles() {
  if (_reviewStylesInjected) return;
  _reviewStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'ai-review-styles';
  style.textContent = `
    .ai-review-overlay {
      position: fixed; inset: 0; z-index: 95;
      display: flex; align-items: center; justify-content: center;
      background: rgba(5, 5, 12, 0.82);
      opacity: 0; pointer-events: none;
      transition: opacity 0.35s ease;
    }
    .ai-review-overlay.visible { opacity: 1; pointer-events: auto; }
    .ai-review-panel {
      width: min(560px, 88vw); max-height: 78vh; overflow-y: auto;
      background: linear-gradient(160deg, #14142a 0%, #0d0d1c 100%);
      border: 1px solid rgba(64, 200, 200, 0.45);
      border-radius: 4px;
      box-shadow: 0 0 32px rgba(64, 200, 200, 0.12), inset 0 0 60px rgba(0, 0, 0, 0.4);
      padding: 28px 30px 24px;
      position: relative;
      transform: translateY(12px);
      transition: transform 0.35s ease;
    }
    .ai-review-overlay.visible .ai-review-panel { transform: translateY(0); }
    .ai-review-panel::before, .ai-review-panel::after {
      content: ''; position: absolute; width: 18px; height: 18px;
      border: 2px solid #40c8c8;
    }
    .ai-review-panel::before { top: -2px; left: -2px; border-right: none; border-bottom: none; }
    .ai-review-panel::after { bottom: -2px; right: -2px; border-left: none; border-top: none; }
    .ai-review-tag {
      display: inline-block; font-size: 11px; letter-spacing: 2px;
      color: #40c8c8; border: 1px solid rgba(64, 200, 200, 0.5);
      padding: 2px 10px; margin-bottom: 14px;
    }
    .ai-review-title {
      font-size: 20px; font-weight: bold; color: #e8e4d8;
      margin: 0 0 4px; letter-spacing: 1px;
    }
    .ai-review-sub {
      font-size: 12px; color: #7a7a92; margin-bottom: 18px;
    }
    .ai-review-body {
      font-size: 15px; line-height: 1.9; color: #d8d4c8;
      min-height: 120px; white-space: pre-wrap;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .ai-review-body .cursor {
      display: inline-block; width: 8px; height: 16px;
      background: #40c8c8; vertical-align: -2px; margin-left: 2px;
      animation: aiReviewBlink 0.8s step-end infinite;
    }
    @keyframes aiReviewBlink { 50% { opacity: 0; } }
    .ai-review-loading {
      display: flex; align-items: center; gap: 10px;
      color: #40c8c8; font-size: 14px; padding: 30px 0;
    }
    .ai-review-loading .dots span {
      display: inline-block; width: 6px; height: 6px; margin-right: 4px;
      background: #40c8c8; animation: aiReviewDot 1.2s ease-in-out infinite;
    }
    .ai-review-loading .dots span:nth-child(2) { animation-delay: 0.2s; }
    .ai-review-loading .dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aiReviewDot { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
    .ai-review-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
    .ai-review-source { font-size: 11px; color: #5a5a70; }
    .ai-review-close {
      background: transparent; border: 1px solid rgba(64, 200, 200, 0.6);
      color: #40c8c8; font-size: 14px; padding: 8px 26px;
      cursor: pointer; letter-spacing: 2px;
      transition: background 0.2s, color 0.2s;
    }
    .ai-review-close:hover { background: #40c8c8; color: #0d0d1c; }
  `;
  document.head.appendChild(style);
}

/**
 * 打开 AI 复盘弹窗（生成 + 打字机展示）
 * @param {AIReviewSystem} reviewSystem
 */
export function showAIReviewOverlay(reviewSystem) {
  _injectReviewStyles();

  // 清理已有弹窗
  const old = document.querySelector('.ai-review-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'ai-review-overlay';
  overlay.innerHTML = `
    <div class="ai-review-panel" role="dialog" aria-label="AI 人生复盘">
      <div class="ai-review-tag">AI REVIEW</div>
      <h3 class="ai-review-title">◈ AI 人生复盘</h3>
      <div class="ai-review-sub">基于你这一局的所有选择</div>
      <div class="ai-review-body">
        <div class="ai-review-loading">
          <span>正在复盘你的人生</span>
          <span class="dots"><span></span><span></span><span></span></span>
        </div>
      </div>
      <div class="ai-review-actions">
        <span class="ai-review-source"></span>
        <button class="ai-review-close">关 闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const close = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 350);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.ai-review-close').addEventListener('click', close);

  // 生成 + 打字机
  const bodyEl = overlay.querySelector('.ai-review-body');
  const sourceEl = overlay.querySelector('.ai-review-source');
  reviewSystem.generate().then(({ text, source }) => {
    sourceEl.textContent = source === 'llm' ? '◈ 大模型实时生成' : '◈ 本地复盘引擎';
    _typewrite(bodyEl, text);
  }).catch(() => {
    bodyEl.textContent = '复盘暂时不可用，但你的人生不需要复盘也足够精彩。';
  });

  return { close };
}

function _typewrite(el, text) {
  el.innerHTML = '<span class="tw"></span><span class="cursor"></span>';
  const tw = el.querySelector('.tw');
  const cursor = el.querySelector('.cursor');
  let i = 0;
  const step = () => {
    if (i < text.length) {
      tw.textContent += text[i++];
      setTimeout(step, 28);
    } else if (cursor) {
      cursor.remove();
    }
  };
  step();
}
