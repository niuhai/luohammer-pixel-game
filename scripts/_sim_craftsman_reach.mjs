// R90: craftsman 结局剧情图可达性验证（目标导向最佳优先搜索）
// 结局引擎命中 craftsman 的充要窗口：
//   pride>=8 && persist_premium && 躲开更高优先级——
//   balance(p12, 全属性>=6): 用 wealth<6 躲开
//   phoenix(p11, pride>=7&&failures>=2&&wealth>=4&&honest_repay): 用 failures<2 躲开
//   legend(p10 同优先但声明在前, pride>=8&&failures>=2&&wealth<3): 用 failures<2 躲开
// 启发式向【premium 旗标 + 高 pride + 低 failures + 中位 wealth + 深度】收敛。
import { STORY } from '../src/data/story/index.js';
import { matchEnding } from '../src/data/endings.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const RELEVANT_FLAGS = [
  'honest_repay', 'retired', 'started_business', 'stayed_xinfang', 'joined_xiaomi',
  'gave_up_hardware', 'killed_m1', 'declared_bankruptcy', 'conservative_funding',
  'continued_livestream', 'final_comeback', 'education_reform', 'wrote_book',
  'became_influencer', 'mentor', 'never_compromised', 'became_investor',
  'became_tech_blogger', 'public_feud_champion', 'became_monk',
  'luo_teacher_returns', 'philanthropy_champion', 'persist_premium',
];
const FLAG_BIT = Object.fromEntries(RELEVANT_FLAGS.map((f, i) => [f, 1n << BigInt(i)]));
const PREMIUM = FLAG_BIT.persist_premium;
const maskToSet = (m) => new Set(RELEVANT_FLAGS.filter((f) => (m & FLAG_BIT[f]) !== 0n));

function applyEff(s, eff) {
  const n = { ...s };
  for (const [k, v] of Object.entries(eff || {})) {
    if (!['pride', 'wealth', 'reputation', 'trust', 'failures', 'pressure'].includes(k)) continue;
    if (k === 'failures') n[k] = clamp((n[k] || 0) + v, 0, 5);
    else if (k === 'pressure') n[k] = clamp((n[k] || 0) + v, 0, 10);
    else n[k] = clamp((n[k] ?? 5) + v, 0, 10);
  }
  return n;
}

const choiceLocked = (c, s, mask) => {
  if (c.requires) for (const [k, min] of Object.entries(c.requires)) {
    if ((s[k] || 0) < min) return true;
  }
  if (c.maxAttr) for (const [k, max] of Object.entries(c.maxAttr)) {
    if ((s[k] || 0) > max) return true;
  }
  if (c.requiresFlags) for (const f of c.requiresFlags) {
    if (!FLAG_BIT[f] || (mask & FLAG_BIT[f]) === 0n) return true;
  }
  return false;
};

// 二叉最小堆（按 score 降序弹出 => 存负数）
class Heap {
  constructor() { this.a = []; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].score <= a[i].score) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].score < a[m].score) m = l;
        if (r < a.length && a[r].score < a[m].score) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

const init = { pride: 5, wealth: 5, reputation: 5, trust: 5, failures: 0, pressure: 0 };
const visited = new Set();
let expanded = 0;
const MAX_EXPAND = 2000000;

function score(e) {
  const premium = (e.mask & PREMIUM) !== 0n;
  // 目标：深 depth 优先推进剧情；premium 旗标；高 pride；低 failures；wealth 居中(3-5)
  const s = e.depth * 1000
    + (premium ? 4000 : 0)
    + e.s.pride * 60
    - e.s.failures * 200
    - Math.abs(e.s.wealth - 4) * 30
    + e.s.reputation * 5;
  return -s; // 堆顶=最小 => 最高分先弹出
}

const heap = new Heap();
heap.push({ nodeId: 'intro', s: init, mask: 0n, parent: null, via: null, depth: 0, score: 0 });

let craftsmanTerm = null;
const otherHits = new Set();

while (heap.size && expanded < MAX_EXPAND && !craftsmanTerm) {
  const e = heap.pop();
  const key = `${e.nodeId}|${e.s.pride},${e.s.wealth},${e.s.reputation},${e.s.trust},${e.s.failures},${e.s.pressure}|${e.mask.toString(36)}`;
  if (visited.has(key)) continue;
  visited.add(key);
  expanded++;

  const evalTerminal = (ns, nm, entry) => {
    const flags = maskToSet(nm);
    const hit = matchEnding({ ...ns, flags }, flags);
    const id = hit ? hit.id : 'survivor(default)';
    if (id === 'craftsman') craftsmanTerm = entry;
    else otherHits.add(id);
  };

  const node = STORY[e.nodeId];
  if (!node || node.isEnding) { evalTerminal(e.s, e.mask, e); continue; }

  for (const c of node.choices || []) {
    if (choiceLocked(c, e.s, e.mask)) continue;
    const ns = applyEff(e.s, c.effects);
    let nm = e.mask;
    if (c.flag && FLAG_BIT[c.flag]) nm |= FLAG_BIT[c.flag];
    const via = `${e.nodeId}—「${String(c.label).slice(0, 18)}」`;
    if (c.next === null || c.next === undefined) {
      evalTerminal(ns, nm, { nodeId: '[next:null]', s: ns, mask: nm, parent: e, via, depth: e.depth + 1 });
      if (craftsmanTerm) break;
    } else if (String(c.next).startsWith('ending_')) {
      continue;
    } else {
      const child = { nodeId: c.next, s: ns, mask: nm, parent: e, via, depth: e.depth + 1 };
      child.score = score(child);
      heap.push(child);
    }
  }
}

function replay(term) {
  const steps = [];
  let cur = term;
  while (cur) {
    if (cur.via) steps.unshift(cur.via);
    cur = cur.parent;
  }
  return steps;
}

console.log(`展开状态: ${expanded}`);
console.log(`搜索中命中的其他结局: ${[...otherHits].sort().join(', ') || '(无)'}`);

if (craftsmanTerm) {
  console.log('\nPASS: craftsman 结局可达。终态:', JSON.stringify(craftsmanTerm.s),
    '\nflags:', [...maskToSet(craftsmanTerm.mask)].join(','));
  const steps = replay(craftsmanTerm);
  console.log(`见证路径（${steps.length} 步）:`);
  for (const step of steps) console.log('   ', step);
  process.exit(0);
} else {
  console.log('\nFAIL: 搜索预算内未找到 craftsman 可达路径');
  process.exit(1);
}
