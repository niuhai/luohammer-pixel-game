# W4 效果引擎+阶段系统完善 — 工作者任务文档

## 1. 任务目标

完善效果引擎和阶段系统：
- 效果引擎（`effects.js`）：扩充阈值触发事件、远期后果、阶段转换检查、效果预览
- 阶段系统（`stages.js`）：扩充结算检查、阶段转换条件、动态随机事件概率

---

## 2. 可修改的文件列表

| 文件 | 说明 |
|------|------|
| `src/data/effects.js` | 效果引擎 |
| `src/data/stages.js` | 阶段定义 |

---

## 3. 不可修改的文件列表

- `src/data/` 目录下除 `effects.js` 和 `stages.js` 之外的所有文件（`story.js`, `events-random.js`, `talents.js`, `endings.js`）
- `src/scenes/` 目录下所有文件
- `src/systems/` 目录下所有文件
- `src/config.js`
- `src/main.js`

---

## 4. 具体要求和验收标准

### 4.1 效果引擎扩充（effects.js）

#### 4.1.1 扩充 checkThresholdTriggers

当前只有4个阈值触发事件，需扩充到 **至少10个**。

| 触发条件 | 事件ID | 事件描述 | 效果 | flag |
|----------|--------|---------|------|------|
| pride ≥ 9 | born_proud（已有） | 理想主义偏执 | pride+1, pressure+1 | born_proud_triggered |
| trust ≥ 9 | peoples_luo（已有） | 人民的罗老师 | reputation+1, pressure+1 | peoples_luo_triggered |
| wealth ≤ 0 | penniless（已有） | 身无分文 | pressure+2, pride-1 | penniless_triggered |
| failures ≥ 3 | deadbeat（已有） | 被叫老赖 | reputation-2, pressure+2 | deadbeat_triggered |
| pride ≤ 1 | **新增** | 理想破灭 | pressure+1, wealth+1 | ideal_shattered |
| reputation ≥ 9 | **新增** | 全民偶像 | reputation+1, pressure+2 | celebrity_triggered |
| reputation ≤ 1 | **新增** | 社会性死亡 | pressure+3, pride-1 | social_death |
| wealth ≥ 9 | **新增** | 财务自由 | wealth+1, pride-1 | rich_triggered |
| pressure ≥ 8 | **新增** | 崩溃边缘 | pride-1, trust-1 | near_breakdown |
| trust ≤ 1 | **新增** | 众叛亲离 | reputation-2, pressure+2 | abandoned |
| pride ≥ 7 && wealth ≤ 2 | **新增** | 穷且益坚 | pride+1, trust+1 | poor_but_proud |
| failures ≥ 5 | **新增** | 习惯失败 | pressure-1, pride+1 | used_to_failure |

#### 4.1.2 扩充 checkFlagConsequences

当前只有4个远期后果，需扩充到 **每个 flag 至少1个远期后果**。

当前已有：
- `sold_out` → 还债期：粉丝失去信任
- `honest_repay` → 还债期：公众信任增加
- `mentor` → 新生期：被指导者成功
- `sold_name` → 新生期：失去品牌认知

需新增的 flag 后果（至少10个）：

| flag | 触发阶段 | 后果描述 | 效果 |
|------|---------|---------|------|
| `bookworm` | teacher | 读书积累让你讲课更有深度 | pride+1, reputation+1 |
| `fighter` | startup | 你曾经为弱者出头，现在有人帮你 | trust+1, reputation+1 |
| `gambler` | dark | 赌博的恶习让你雪上加霜 | wealth-1, pressure+1 |
| `corrupt` | repay | 曾经收红包的事被翻出来了 | trust-2, reputation-1 |
| `influencer` | repay | 网红身份帮你吸引直播流量 | wealth+1, reputation+1 |
| `all_in` | dark | 孤注一掷的代价来了 | wealth-2, pressure+2 |
| `sued_big_tech` | repay | 起诉大厂的经历让你更懂法律 | trust+1 |
| `public_feud` | dark | 公开撕逼的后遗症 | reputation-1, pressure+1 |
| `banned_fight` | repay | 维权被封的经历引起公众同情 | trust+1, reputation+1 |
| `comeback_attempt` | reborn | 再次创业的经历让你更成熟 | pride+1, pressure-1 |
| `ai_believer` | reborn | AI信仰让你在新时代找到方向 | wealth+1 |
| `born_proud_triggered` | repay | 天生骄傲的标签让你获得铁粉 | trust+2 |

#### 4.1.3 新增 checkStageTransition

阶段转换时的特殊检查函数。当玩家从一个阶段进入下一个阶段时触发。

```javascript
/**
 * 检查阶段转换时的特殊事件
 * @param {string} fromStage - 上一阶段ID
 * @param {string} toStage - 下一阶段ID
 * @param {object} state - 当前游戏状态
 * @param {Set} flags - 远期标记集合
 * @returns {object|null} 转换事件，或null
 */
export function checkStageTransition(fromStage, toStage, state, flags) {
  // 实现要求：
  // 1. startup → dark：检查财富是否足够（wealth < 3 才能进入至暗期）
  // 2. dark → repay：检查是否有 honest_repay flag
  // 3. repay → reborn：检查债务是否还清（wealth >= 5）
  // 4. 每个转换返回一个事件对象，包含 text 和 effects
}
```

具体转换事件：

| 转换 | 条件 | 事件描述 | 效果 |
|------|------|---------|------|
| youth → teacher | 无条件 | "你走进了新东方的大门" | reputation+1 |
| teacher → startup | pride ≥ 6 | "你的理想主义驱使你创业" | pride+1, wealth-1 |
| teacher → startup | pride < 6 | "你决定试试做自己的事" | wealth+1 |
| startup → dark | wealth < 3 | "公司倒闭了，债务压顶" | wealth-2, pressure+3, failures+1 |
| startup → dark | wealth ≥ 3 | "虽然公司没做成，但你保住了一些资产" | wealth-1, pressure+1 |
| dark → repay | flags.has('honest_repay') | "你选择了还债，这条路很长" | trust+2, pride+1 |
| dark → repay | !flags.has('honest_repay') | "你必须想办法还钱" | pressure+1 |
| repay → reborn | wealth ≥ 5 | "债还清了，你自由了" | pressure-3, pride+1 |
| repay → reborn | wealth < 5 | "债还没还完，但你已经看到了希望" | pressure-1 |

#### 4.1.4 新增 getEffectPreview

预览选择效果，用于UI显示"+2理想"等提示。

```javascript
/**
 * 预览选择效果
 * @param {object} state - 当前游戏状态
 * @param {object} effects - 效果对象
 * @returns {array} 预览信息数组 [{ attr, name, icon, delta, newValue, hidden }]
 */
export function getEffectPreview(state, effects) {
  // 实现要求：
  // 1. 计算每个属性的变化值（考虑天赋倍率）
  // 2. 返回变化摘要，用于UI显示
  // 3. 隐藏属性的变化也要计算，但标记为 hidden
  // 4. delta为0的属性不返回
}
```

返回格式示例：
```javascript
[
  { attr: 'pride', name: '理想主义', icon: '⭐', delta: 2, newValue: 7, hidden: false },
  { attr: 'wealth', name: '财富', icon: '💰', delta: -1, newValue: 4, hidden: false },
  { attr: 'pressure', name: '压力', icon: '😰', delta: 1, newValue: 3, hidden: true },
]
```

#### 4.1.5 验收标准

- [ ] checkThresholdTriggers 至少10个触发事件
- [ ] checkFlagConsequences 至少14个flag后果（现有4个+新增10个）
- [ ] checkStageTransition 函数实现，至少5个转换事件
- [ ] getEffectPreview 函数实现，返回格式正确
- [ ] 不修改现有函数的签名和返回格式
- [ ] 不破坏 applyEffects 和 createInitialState 的逻辑
- [ ] 新增函数都有 JSDoc 注释

### 4.2 阶段系统扩充（stages.js）

#### 4.2.1 扩充 settlement.checks

当前每个阶段只有2-3个结算检查，需扩充到 **3-5个**。

| 阶段 | 当前checks数 | 要求 | 建议新增 |
|------|-------------|------|---------|
| youth | 2 | 3-5 | +{ pride ≤ 2: "你学会了务实", effects: { wealth: 1 } } |
| teacher | 2 | 3-5 | +{ trust ≥ 7: "学生信任你", effects: { reputation: 1 } } |
| startup | 3 | 3-5 | +{ pressure ≥ 8: "你快撑不住了", effects: { failures: 1 } } |
| dark | 2 | 3-5 | +{ trust ≥ 5: "还有人相信你", effects: { pride: 1 } } |
| repay | 2 | 3-5 | +{ reputation ≥ 7: "你赢得了尊重", effects: { trust: 1 } } |
| reborn | 0 | 3-5 | +{ pride ≥ 7: "你依然骄傲", effects: { trust: 1 } } 等 |

#### 4.2.2 新增阶段转换条件

在 STAGES 数组中为每个阶段新增 `transitionCondition` 字段：

```javascript
{
  id: 'dark',
  name: '至暗时刻',
  // ... 现有字段 ...
  transitionCondition: {
    // 进入此阶段需要满足的条件
    require: { wealth: [0, 3] },  // 财富 ≤ 3 才能进入至暗期
    // 如果不满足条件的替代阶段
    fallback: null,  // 无替代，强制进入
  }
}
```

具体转换条件：

| 阶段 | 进入条件 | 说明 |
|------|---------|------|
| youth | 无 | 初始阶段 |
| teacher | 无 | 自然过渡 |
| startup | 无 | 自然过渡 |
| dark | wealth ≤ 4 | 财富过低才能进入至暗期 |
| repay | 无 | 自然过渡（但效果受flag影响） |
| reborn | wealth ≥ 3 | 至少有一定经济基础 |

#### 4.2.3 动态随机事件概率

当前 `randomEventChance` 是固定值，需改为根据属性动态调整。

新增 `getDynamicEventChance` 函数：

```javascript
/**
 * 根据属性动态计算随机事件触发概率
 * @param {string} stageId - 阶段ID
 * @param {object} state - 当前游戏状态
 * @returns {number} 触发概率 0-1
 */
export function getDynamicEventChance(stageId, state) {
  // 基础概率
  const baseChances = {
    youth: 0.2, teacher: 0.25, startup: 0.35,
    dark: 0.3, repay: 0.25, reborn: 0.2
  };
  let chance = baseChances[stageId] || 0.25;

  // 压力越高，随机事件越多（祸不单行）
  if (state.pressure >= 7) chance += 0.1;
  if (state.pressure >= 9) chance += 0.1;

  // 名声越高，随机事件越多（树大招风）
  if (state.reputation >= 8) chance += 0.05;

  // 财富越低，随机事件越多（屋漏偏逢连夜雨）
  if (state.wealth <= 2) chance += 0.1;

  // 天赋影响
  if (state.specialEffects?.includes('random_events_bias_positive')) chance -= 0.05;
  if (state.specialEffects?.includes('random_events_bias_negative')) chance += 0.05;

  return Math.min(0.6, Math.max(0.1, chance));
}
```

#### 4.2.4 验收标准

- [ ] 每个阶段的 settlement.checks 至少3个
- [ ] 每个阶段有 transitionCondition 字段
- [ ] getDynamicEventChance 函数实现
- [ ] 不修改现有函数的签名和返回格式
- [ ] 不破坏 getStageByNodeId 和 getCurrentStage 的逻辑
- [ ] 新增函数都有 JSDoc 注释

---

## 5. 数据结构参考

### 5.1 effects.js 现有结构

```javascript
// 属性定义
export const ATTRIBUTES = {
  pride: { name: '理想主义', icon: '⭐', min: 0, max: 10, hidden: false, color: 0xF0C040 },
  wealth: { name: '财富', icon: '💰', min: 0, max: 10, hidden: false, color: 0x40C040 },
  reputation: { name: '名声', icon: '📢', min: 0, max: 10, hidden: false, color: 0x4080F0 },
  failures: { name: '翻车', icon: '💥', min: 0, max: 99, hidden: false, color: 0xE04040 },
  pressure: { name: '压力', icon: '😰', min: 0, max: 10, hidden: true, color: 0x8040C0 },
  trust: { name: '公众信任', icon: '🤝', min: 0, max: 10, hidden: true, color: 0x40C0C0 },
};

// 现有函数签名（不可修改）
export function applyEffects(state, effects) { ... }        // 返回 { state, changes }
export function checkPressureCrash(state) { ... }           // 返回 事件对象 或 null
export function checkThresholdTriggers(state, flags) { ... } // 返回 事件数组
export function checkFlagConsequences(stageId, flags) { ... } // 返回 后果数组
export function createInitialState(talentEffects = {}) { ... } // 返回 初始状态对象
```

### 5.2 stages.js 现有结构

```javascript
export const STAGES = [
  {
    id: string,           // 阶段ID
    name: string,         // 阶段名称
    period: string,       // 时间段
    sceneType: string,    // 默认场景类型
    nodes: [string],      // 该阶段的主线节点ID列表
    randomEventChance: number, // 每个节点触发随机事件的概率 (0-1)
    settlement: {         // 阶段结算规则
      text: string,       // 结算描述
      checks: [           // 属性检查
        { attr: string, min: number, max: number, result: string, effects: object }
      ]
    }
  },
  // ...
];

// 现有函数签名（不可修改）
export function getStageByNodeId(nodeId) { ... }  // 返回阶段对象或null
export function getCurrentStage(state) { ... }     // 返回阶段对象或null
```

### 5.3 阈值触发事件结构

```javascript
{
  id: string,           // 事件ID
  text: string,         // 事件描述
  effects: object,      // 属性效果
  flag: string,         // 标记flag（防止重复触发）
}
```

### 5.4 远期后果事件结构

```javascript
{
  id: string,           // 后果ID
  text: string,         // 后果描述
  effects: object,      // 属性效果
}
```

### 5.5 阶段转换事件结构

```javascript
{
  id: string,           // 转换事件ID
  text: string,         // 转换描述
  effects: object,      // 属性效果
  flag?: string,        // 可选标记
}
```

---

## 6. 项目灵魂

> **选择没有对错，只有不同的人生。**

核心设计哲学：

1. **不评判选择** — 没有标准答案，每条路都有风景
2. **选择塑造身份** — 属性不是分数，而是"你是什么样的人"的映射
3. **代价即意义** — 放弃的东西定义了你坚持的东西
4. **所有结局都值得尊重** — "传奇"不比"幸存者"更好，只是不同
5. **重玩不是为了赢，而是为了体验另一种人生**

### 效果引擎设计原则

- **属性变化要有意义**：不是简单的加减，而是"你是什么样的人"的映射
- **远期后果要有因果**：flag 后果要让玩家感受到"当初的选择真的有影响"
- **阈值触发要自然**：不是突然冒出来，而是"你的状态导致了这个结果"
- **效果预览要透明**：让玩家知道选择会带来什么变化，但远期后果不预览

### 阶段系统设计原则

- **阶段转换要有代价**：不是自动过渡，而是有条件的
- **结算检查要有叙事**：不是"属性检查通过"，而是"你的选择导致了这个结果"
- **动态概率要合理**：祸不单行是真的，但也不能让玩家觉得被针对
