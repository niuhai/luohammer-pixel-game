# W1 随机事件扩充 — 工作者任务文档

## 1. 任务目标

扩充 `src/data/events-random.js` 中的随机事件池。当前约20个事件，需扩充到 **100+ 个**，使每个阶段至少15个事件，且事件具备情感深度和道德困境。

---

## 2. 可修改的文件列表

| 文件 | 说明 |
|------|------|
| `src/data/events-random.js` | 随机事件池数据（唯一修改文件） |

---

## 3. 不可修改的文件列表

- `src/data/` 目录下除 `events-random.js` 之外的所有文件（`story.js`, `talents.js`, `endings.js`, `effects.js`, `stages.js`）
- `src/scenes/` 目录下所有文件
- `src/systems/` 目录下所有文件
- `src/config.js`
- `src/main.js`

---

## 4. 具体要求和验收标准

### 4.1 数量要求

| 阶段 | 当前数量 | 最低要求 | 建议数量 |
|------|---------|---------|---------|
| youth（少年期） | 3 | 15 | 18 |
| teacher（新东方期） | 3 | 15 | 18 |
| startup（创业期） | 5 | 15 | 18 |
| dark（至暗期） | 3 | 15 | 18 |
| repay（还债期） | 4 | 15 | 18 |
| reborn（新生期） | 3 | 15 | 18 |
| **合计** | **~21** | **90+** | **108+** |

### 4.2 事件质量要求

1. **道德困境**：每个事件的2个选项必须构成道德困境——没有"正确答案"，只有"不同的人生选择"
2. **情感深度**：事件文本要生动、有画面感，像在讲故事，而非干巴巴的描述
3. **属性阈值触发**：每个事件必须有 `trigger` 字段，指定属性触发条件
4. **远期标记**：至少20个事件要有 `flag` 字段，标记远期后果
5. **权重分布**：常见事件 weight 2-3，罕见事件 weight 1，高频事件 weight 4-5
6. **onceOnly**：有 flag 的事件必须 `onceOnly: true`；无 flag 的事件可重复触发

### 4.3 验收标准

- [ ] RANDOM_EVENTS 数组元素总数 ≥ 100
- [ ] 每个阶段（youth/teacher/startup/dark/repay/reborn）至少15个事件
- [ ] 有 flag 字段的事件 ≥ 20个
- [ ] 每个事件都有 trigger 字段（至少1个属性条件）
- [ ] 每个事件恰好2个 choices
- [ ] 事件文本有画面感，不是干巴巴的描述
- [ ] 选项构成道德困境，没有明显"正确答案"
- [ ] 不修改现有事件，只往数组末尾追加
- [ ] 数据结构完全一致，不破坏 `getAvailableEvents` 和 `pickRandomEvent` 的逻辑

---

## 5. 数据结构参考

### 5.1 事件对象结构

```javascript
{
  id: string,           // 唯一标识，格式：阶段_描述（如 'youth_bookstore'）
  stage: string,        // 所属阶段：youth / teacher / startup / dark / repay / reborn
  trigger: {            // 触发条件（属性阈值），至少1个
    pride?: [min, max],     // 理想主义范围 0-10
    wealth?: [min, max],   // 财富范围 0-10
    reputation?: [min, max], // 名声范围 0-10
    failures?: number,     // 翻车次数最小值
    pressure?: [min, max],  // 压力范围 0-10
    trust?: [min, max],     // 公众信任范围 0-10
  },
  weight: number,       // 权重（1-5，越高越容易触发）
  text: string,         // 事件描述（生动、有画面感）
  choices: [             // 恰好2个选项
    {
      label: string,      // 选项文本（带引号，像角色在说话）
      effects: {          // 属性变化
        pride?: number,     // 理想主义 ±
        wealth?: number,    // 财富 ±
        reputation?: number, // 名声 ±
        pressure?: number,  // 压力 ±
        trust?: number,     // 公众信任 ±
        failures?: number,  // 翻车 +1
      },
      flag?: string,     // 远期标记（可选）
    },
    {
      label: string,
      effects: { ... },
      flag?: string,
    }
  ],
  onceOnly: boolean,    // 有flag的事件必须为true
}
```

### 5.2 现有事件示例

```javascript
// 少年期事件
{
  id: 'youth_bookstore',
  stage: 'youth',
  trigger: { pride: [3, 10] },
  weight: 3,
  text: '你在地摊上淘到一本绝版书，摊主开价50块——你口袋里只有30。他说"买不起别碰"。',
  choices: [
    { label: '"书我一定要！先欠着，下次还你"', effects: { pride: 1, wealth: -1 }, flag: 'bookworm' },
    { label: '"算了，记下书名去图书馆找"', effects: { wealth: 0, reputation: 0 } }
  ],
  onceOnly: true
}

// 创业期事件（有远期标记）
{
  id: 'startup_copycat',
  stage: 'startup',
  trigger: { reputation: [5, 10] },
  weight: 3,
  text: '大厂发布了一款和你几乎一模一样的产品，但价格只有你的一半。你的用户开始流失。',
  choices: [
    { label: '"告他们！抄袭必须付出代价"', effects: { pride: 2, wealth: -1, pressure: 2 }, flag: 'sued_big_tech' },
    { label: '"打不过就差异化，做他们做不到的"', effects: { pride: 1, wealth: -1 } }
  ],
  onceOnly: true
}
```

### 5.3 已有 flag 列表（避免重复）

现有事件已使用的 flag：`bookworm`, `fighter`, `gambler`, `corrupt`, `influencer`, `all_in`, `sued_big_tech`, `public_feud`, `honest_repay`, `sold_out`, `banned_fight`, `comeback_attempt`, `ai_believer`, `sold_name`, `mentor`

新增 flag 命名规范：`阶段_行为描述`，如 `youth_kindness`, `teacher_whistleblower`, `startup_persist_premium`

---

## 6. 项目灵魂

> **选择没有对错，只有不同的人生。**

从 PROJECT-BACKGROUND.md 中提取的核心设计哲学：

1. **不评判选择** — 没有标准答案，每条路都有风景
2. **选择塑造身份** — 属性不是分数，而是"你是什么样的人"的映射
3. **代价即意义** — 放弃的东西定义了你坚持的东西
4. **所有结局都值得尊重** — "传奇"不比"幸存者"更好，只是不同
5. **重玩不是为了赢，而是为了体验另一种人生**

### 选择远期后果设计原则

选择不只是影响下个节点，而是标记远期影响：

| 阶段 | 选择示例 | 远期后果 |
|------|---------|---------|
| 新东方时期 | "公开批评体制" | → 后期获得公众同情+1 |
| 锤子时期 | "坚持做高端" | → 财富-2但理想主义+2，后期解锁"工匠传奇"结局 |
| 直播还债 | "接所有广告" | → 财富+3但名声-2，公众信任-2 |
| 直播还债 | "只接靠谱的" | → 财富+1但名声+1，公众信任+1 |

### 事件文案风格参考

好的事件文案：
- ✅ "你站在寒风里，看着摊主把那本绝版书收起来。口袋里的30块钱被你攥出了汗。"
- ✅ "妻子打来电话，孩子在学校被同学嘲笑'你爸是老赖'。电话那头，她哭了。"
- ✅ "一个明显是割韭菜的产品找你带货，开价500万。你知道这东西不靠谱，但你真的很需要钱。"

差的事件文案：
- ❌ "你遇到了一个商业机会。"（太抽象，无画面感）
- ❌ "有人给你钱让你做坏事。"（太直白，无道德困境）
- ❌ "你的财富增加了。"（不是事件，是结果）

### 道德困境设计参考

好的道德困境：
- ✅ 接烂广告还债 vs 拒绝烂广告保名声（短期利益 vs 长期信誉）
- ✅ 破产清算合法脱身 vs 扛下6亿债务（理性选择 vs 道义担当）
- ✅ 妥协做中端手机 vs 坚持做高端（生存 vs 理想）

差的道德困境：
- ❌ 做好事+1 vs 做坏事-1（太简单，无困境）
- ❌ 选A全加属性 vs 选B全减属性（有明显正确答案）
