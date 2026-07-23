# W2 天赋+结局扩充 — 工作者任务文档

## 1. 任务目标

扩充天赋系统和结局系统：
- 天赋从17个扩充到 **30+ 个**
- 结局从14个扩充到 **20+ 个**

---

## 2. 可修改的文件列表

| 文件 | 说明 |
|------|------|
| `src/data/talents.js` | 天赋数据 |
| `src/data/endings.js` | 结局数据 |

---

## 3. 不可修改的文件列表

- `src/data/` 目录下除 `talents.js` 和 `endings.js` 之外的所有文件（`story.js`, `events-random.js`, `effects.js`, `stages.js`）
- `src/scenes/` 目录下所有文件
- `src/systems/` 目录下所有文件
- `src/config.js`
- `src/main.js`

**特别注意**：`src/data/story.js` 中也有一个 `ENDINGS` 导出（旧版结局），但 W2 只修改 `src/data/endings.js` 中的 `ENDINGS` 数组，不要碰 `story.js`。

---

## 4. 具体要求和验收标准

### 4.1 天赋扩充（talents.js）

#### 数量要求

| 稀有度 | 当前数量 | 最低要求 |
|--------|---------|---------|
| common（普通） | 10 | 10+ |
| rare（稀有） | 5 | 10+ |
| legendary（传说） | 2 | 5+ |
| **合计** | **17** | **30+** |

#### 天赋效果多样化要求

当前天赋效果主要是属性加减，需要更多 **special 效果**：

| special 效果名 | 说明 | 示例天赋 |
|---------------|------|---------|
| `debt_reduction_bonus` | 还债阶段财富效果+50% | "真还传主角" |
| `random_events_bias_negative` | 随机事件偏向负面 | "命途多舛" |
| `random_events_bias_positive` | 随机事件偏向正面 | "锦鲤体质"（已有） |
| `failure_heals_pride` | 翻车时理想主义+1 | "浴火重生"（已有） |
| `fans_loyalty_bonus` | 名声下降时减半 | "教主气质"（已有） |
| `low_stats_bonus` | 属性低时效果增强 | "弱者逆袭"（已有） |
| `pressure_never_max` | 压力永远不会到上限 | "钢铁意志"（已有） |
| `pride_from_failure` | 每次翻车理想主义+1 | "越挫越勇" |
| `wealth_from_reputation` | 名声变化时同步影响财富 | "名气变现" |
| `trust_bonus_on_high_pride` | 理想主义≥7时公众信任+2 | "理想主义光环" |
| `pressure_reduces_wealth` | 压力越高财富消耗越快 | "焦虑税" |
| `second_chance` | 每局一次，翻车时属性不降 | "再来一次" |
| `dark_horse` | 初始全属性3，但上限提升到12 | "大器晚成" |
| `contrarian` | 与主流选择相反时效果翻倍 | "逆行者" |

#### 天赋命名风格

天赋名称和描述要有"老罗特色"——狂妄、幽默、自嘲：

- ✅ "嘴炮王者" — "我这个人就是嘴欠"
- ✅ "偏执狂" — "工匠精神就是死磕"
- ✅ "厚脸皮" — "被骂习惯了"
- ✅ "行业冥灯" — "做一行凉一行"
- ❌ "勇气加成" — 太通用，无特色
- ❌ "幸运之星" — 太普通，无老罗味

#### 验收标准

- [ ] TALENTS 数组元素总数 ≥ 30
- [ ] common ≥ 10, rare ≥ 10, legendary ≥ 5
- [ ] 至少5个天赋有 special 效果
- [ ] 天赋名称和描述有老罗特色
- [ ] 不修改现有天赋，只往数组末尾追加
- [ ] 数据结构一致，不破坏 `drawTalents` 和 `applyTalentEffects` 逻辑

### 4.2 结局扩充（endings.js）

#### 数量要求

当前14个结局，扩充到 **20+ 个**。

#### 结局设计要求

1. **check 函数**：每个结局必须有 `check` 函数，接收 `(state, flags)` 参数
2. **respect 描述**：每个结局必须有 `respect` 字段，说明"为什么这个结局值得尊重"
3. **远期标记依赖**：新增结局应包含 flag 依赖（如需要同时满足属性条件+特定flag）
4. **组合结局**：至少3个结局需要多个 flag 同时存在才能触发
5. **优先级**：组合结局的 priority 应高于纯属性结局，确保优先匹配
6. **设计哲学**：所有结局都值得尊重，没有"好结局"和"坏结局"

#### 建议新增结局

| 结局名 | 触发条件 | 主题 | 尊重点 |
|--------|---------|------|--------|
| 行业冥灯 | failures≥5 + flag `gambler` | 做一行凉一行 | 先驱者的代价是替大家踩坑 |
| 理想殉道者 | pride≥9 + wealth≤1 + flag `persist_premium` | 为理想而死 | 宁为玉碎不为瓦全 |
| 真还传·完 | pride≥6 + trust≥7 + flag `honest_repay` + failures≥3 | 完整的真还传 | 最老罗的结局 |
| 舆论牺牲品 | reputation≤1 + flag `public_feud` | 被舆论吞噬 | 说话的代价 |
| 江湖大哥 | reputation≥8 + flag `fighter` + pride≥6 | 仗义执言的江湖人 | 侠之大者 |
| 科技布道者 | wealth≥5 + flag `ai_believer` + reputation≥5 | AI时代的传教士 | 永远走在前面 |
| 隐退者 | pressure≤2 + flag `sold_name` | 卖掉名字后消失 | 放下也是一种勇气 |
| 逆袭者 | wealth≥7 + failures≥3 + flag `comeback_attempt` | 史玉柱式东山再起 | 跌到底再站起来 |
| 双面人 | flag `sold_out` + flag `honest_repay` | 既卖过良心又守了承诺 | 人是复杂的 |
| 守夜人 | pride≥5 + trust≥8 + wealth≤3 | 默默守护信任 | 不发光但始终在场 |

#### 验收标准

- [ ] ENDINGS 数组元素总数 ≥ 20
- [ ] 每个结局有 check 函数和 respect 描述
- [ ] 至少3个结局需要多个 flag 同时存在
- [ ] 至少2个结局是"组合结局"（属性条件+多个flag）
- [ ] 不修改现有结局，只往数组末尾追加
- [ ] 数据结构一致，不破坏 `matchEnding` 逻辑
- [ ] 所有结局都值得尊重，没有"坏结局"

---

## 5. 数据结构参考

### 5.1 天赋对象结构

```javascript
{
  id: string,           // 唯一标识（如 'silver_tongue'）
  name: string,         // 显示名称（有老罗特色）
  desc: string,         // 描述（带引号，像角色在说话）
  icon: string,         // emoji图标
  rarity: 'common'|'rare'|'legendary',  // 稀有度
  effects: {            // 初始效果
    pride?: number,       // 理想主义 ±
    wealth?: number,      // 财富 ±
    reputation?: number,  // 名声 ±
    pressure?: number,    // 压力 ±
    trust?: number,       // 公众信任 ±
    pressureMax?: number, // 压力上限调整
    failurePenalty?: number, // 翻车惩罚倍率（0.5=减半）
    successBonus?: number,   // 成功奖励倍率（2=翻倍）
  },
  special?: string,     // 特殊效果描述（由引擎解读）
}
```

### 5.2 现有天赋示例

```javascript
// 普通天赋
{
  id: 'silver_tongue',
  name: '嘴炮王者',
  desc: '"我这个人就是嘴欠"',
  icon: '🗣️',
  rarity: 'common',
  effects: { pride: 2, reputation: 1 }
}

// 稀有天赋（有special）
{
  id: 'phoenix',
  name: '浴火重生',
  desc: '"每次跌倒都让我更强"',
  icon: '🔥',
  rarity: 'rare',
  effects: { pride: 1, trust: 1 },
  special: 'failure_heals_pride'
}

// 传说天赋
{
  id: 'luo_himself',
  name: '老罗附体',
  desc: '"天生骄傲"',
  icon: '⚡',
  rarity: 'legendary',
  effects: { pride: 1, wealth: 1, reputation: 1, trust: 1, pressureMax: 1 }
}
```

### 5.3 结局对象结构

```javascript
{
  id: string,           // 唯一标识
  name: string,         // 结局名称
  subtitle: string,     // 副标题
  desc: string,         // 结局描述
  respect: string,      // 尊重点（为什么这个结局值得尊重）
  icon: string,         // emoji图标
  check: function,      // 触发条件检查函数 (state, flags) => boolean
  priority: number,     // 优先级（数字越大越优先匹配）
  sceneType: string,    // 结局场景类型（固定为 'ending'）
}
```

### 5.4 现有结局示例

```javascript
// 纯属性条件结局
{
  id: 'legend',
  name: '传奇',
  subtitle: '偏执到底，终成传奇',
  desc: '你从未向现实低头。你赔光了钱，失去了朋友，被全世界嘲笑——但你的名字，写进了历史。',
  respect: '坚持的代价是孤独，但孤独是传奇的门票',
  icon: '🏆',
  priority: 10,
  sceneType: 'ending',
  check: (state, flags) => state.pride >= 8 && (state.failures || 0) >= 2 && state.wealth < 3
}

// 属性+flag条件结局
{
  id: 'phoenix',
  name: '浴火重生',
  subtitle: '真还传本传',
  desc: '6亿债务，你一分不少地还清了。',
  respect: '最老罗的结局——跌到底，再站起来',
  icon: '🔥',
  priority: 11,
  sceneType: 'ending',
  check: (state, flags) => state.pride >= 7 && (state.failures || 0) >= 3 && state.wealth >= 4 && flags.has('honest_repay')
}

// 工匠传奇（需要特定flag）
{
  id: 'craftsman',
  name: '工匠传奇',
  subtitle: '像素级完美主义',
  desc: '你做出了世界上最完美的手机——虽然只有100个人买。',
  respect: '极致的代价是极致的孤独',
  icon: '🔧',
  priority: 10,
  sceneType: 'ending',
  check: (state, flags) => state.pride >= 9 && flags.has('persist_premium')
}
```

### 5.5 已有 flag 列表（结局 check 可引用）

来自 events-random.js 的 flag：`bookworm`, `fighter`, `gambler`, `corrupt`, `influencer`, `all_in`, `sued_big_tech`, `public_feud`, `honest_repay`, `sold_out`, `banned_fight`, `comeback_attempt`, `ai_believer`, `sold_name`, `mentor`

来自 effects.js 的 flag：`born_proud_triggered`, `peoples_luo_triggered`, `penniless_triggered`, `deadbeat_triggered`

来自 story.js 的 flag（通过 choices 的 flag 字段）：`retired`, `persist_premium`

---

## 6. 项目灵魂

> **选择没有对错，只有不同的人生。**

核心设计哲学：

1. **不评判选择** — 没有标准答案，每条路都有风景
2. **选择塑造身份** — 属性不是分数，而是"你是什么样的人"的映射
3. **代价即意义** — 放弃的东西定义了你坚持的东西
4. **所有结局都值得尊重** — "传奇"不比"幸存者"更好，只是不同
5. **重玩不是为了赢，而是为了体验另一种人生**

### 天赋设计原则

- 天赋不是"加成"，是"性格"——每个天赋定义了一种人生态度
- 好的天赋也有代价（如"偏执狂"加理想主义但也加压力）
- special 效果比属性加减更有趣，优先设计

### 结局设计原则

- 所有结局都值得尊重，没有"坏结局"
- 组合结局（需要多个flag）是最珍贵的，代表玩家走了一条独特的人生路
- respect 描述要真诚，不要嘲讽玩家
- 优先级设计：组合结局 > 纯属性结局 > 兜底结局
