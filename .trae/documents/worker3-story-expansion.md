# W3 主线剧情扩充 — 工作者任务文档

## 1. 任务目标

扩充 `src/data/story.js` 中的主线剧情。当前约70个节点（含结局节点），需扩充到 **150+ 个**，使每个阶段至少20个剧情节点。

---

## 2. 可修改的文件列表

| 文件 | 说明 |
|------|------|
| `src/data/story.js` | 主线剧情数据（唯一修改文件） |

---

## 3. 不可修改的文件列表

- `src/data/` 目录下除 `story.js` 之外的所有文件（`events-random.js`, `talents.js`, `endings.js`, `effects.js`, `stages.js`）
- `src/scenes/` 目录下所有文件
- `src/systems/` 目录下所有文件
- `src/config.js`
- `src/main.js`

---

## 4. 具体要求和验收标准

### 4.1 数量要求

| 阶段 | 当前节点数 | 最低要求 | 建议数量 |
|------|-----------|---------|---------|
| youth（少年期） | ~6 | 20 | 25 |
| teacher（新东方期） | ~6 | 20 | 25 |
| startup（创业期） | ~14 | 20 | 30 |
| dark（至暗期） | ~4 | 20 | 25 |
| repay（还债期） | ~5 | 20 | 25 |
| reborn（新生期） | ~8 | 20 | 25 |
| **合计** | **~43（非结局节点）** | **120+** | **155+** |

注：结局节点不算在剧情节点数内。

### 4.2 节点质量要求

1. **每个节点必须有 choices**：至少2个选项，构成道德困境
2. **选项必须有 effects**：属性变化要合理，不能全是0
3. **关键选择要有 flag**：远期标记，影响后期事件和结局
4. **文案有情感深度**：符合老罗的人生经历，有画面感
5. **节点衔接正确**：next 字段必须指向存在的节点ID
6. **每个节点 text 不超过200字**：简洁有力
7. **sceneType 匹配阶段**：youth→classroom, teacher→lecture, startup→office/stage, dark→court/street, repay→livestream, reborn→podcast/lab
8. **progress 字段**：表示游戏进度百分比（0-100）

### 4.3 新增节点策略

在现有节点之间插入新节点，而非修改现有节点。具体策略：

1. **在现有节点之间插入过渡节点**：如 `act0_childhood` 和 `act0_b` 之间插入 `act0_childhood_2`
2. **在现有节点的选择分支后插入新分支**：如选择A走新分支，选择B走原有路径
3. **新增阶段内事件**：每个阶段可以增加更多生活细节和内心挣扎
4. **新增阶段过渡节点**：阶段转换时的心理描写和选择

### 4.4 各阶段扩充方向

#### youth（少年期）扩充方向
- 延边的童年细节（父亲的关系、母亲的期望）
- 退学后的心理挣扎
- 自学读书的具体经历
- 去韩国前的犹豫
- 在韩国的更多故事
- 回国后的迷茫期

#### teacher（新东方期）扩充方向
- 试讲前的准备细节
- 成名后的诱惑（商业合作、综艺邀请）
- 与俞敏洪的理念分歧细节
- 牛博网的创办过程
- 砸冰箱的更多细节
- 方舟子论战的更多回合

#### startup（创业期）扩充方向
- 找投资的艰辛过程
- 团队建设的挑战
- 产品设计的纠结（细节打磨 vs 快速迭代）
- 供应链问题的更多细节
- 与竞争对手的较量
- 内部团队矛盾

#### dark（至暗期）扩充方向
- 债务压力下的日常生活
- 供应商围堵的更多细节
- 家人承受的压力
- 尝试各种还债方式
- 电子烟和Sharklet的更多故事
- 限制消费令的影响

#### repay（还债期）扩充方向
- 直播带货的学习过程
- 与各种品牌合作的故事
- 还债过程中的心理变化
- 脱口秀的更多细节
- 公众态度的转变
- 还清债务的那一刻

#### reborn（新生期）扩充方向
- AR研发的细节
- AI转型的决策过程
- 播客录制的故事
- 与各路大佬的对谈
- 科技春晚的准备
- 对未来的思考

### 4.5 验收标准

- [ ] STORY 对象中非结局节点总数 ≥ 150
- [ ] 每个阶段至少20个节点
- [ ] 每个节点都有 choices（至少2个选项）
- [ ] 每个选项都有 effects（不全为0）
- [ ] 关键选择有 flag（至少20个新 flag）
- [ ] 所有 next 字段指向存在的节点ID
- [ ] 每个节点 text 不超过200字
- [ ] sceneType 匹配阶段
- [ ] 不修改现有节点，只新增节点
- [ ] 不修改现有 ENDINGS 和 CHAR_INFO 对象
- [ ] 新增节点需要同步更新 CHAR_INFO 对象

---

## 5. 数据结构参考

### 5.1 剧情节点结构

```javascript
{
  act: string,          // 章节名（如 '第一章'）
  actSub: string,       // 章节副标题（如 '社会大学 · 摆摊岁月 1989-1995'）
  sceneType: string,    // 场景类型（来自 config.js 的 SCENE_TYPES）
  character: string,    // 角色名（通常为 '罗远'）
  text: string,         // 剧情文本（≤200字）
  choices: [             // 至少2个选项
    {
      label: string,      // 选项文本（带引号，像角色在说话）
      next: string,       // 下一节点ID
      effects: {          // 属性变化
        pride?: number,
        wealth?: number,
        rep?: number,      // 注意：story.js 中 reputation 简写为 rep
        pressure?: number,
        trust?: number,
        fail?: boolean,    // 是否翻车（true = failures+1）
      },
      flag?: string,     // 远期标记（可选）
      achievement?: string, // 成就名称（可选）
      icon?: string,     // 成就图标（可选）
    },
    { ... }
  ],
  historyNote: string,  // 历史注释（可选，说明真实历史）
  progress: number,     // 游戏进度百分比 0-100
}
```

### 5.2 结局节点结构

```javascript
{
  sceneType: SCENE_TYPES.ENDING,
  isEnding: true,
  title: string,        // 结局标题
  desc: string,         // 结局描述
  quote: string,        // 结局金句
  summary: string,      // 结局总结
}
```

### 5.3 现有节点示例

```javascript
act0_korea: {
  act: '第一章',
  actSub: '韩国打工 · 卖壮阳药 1995-1999',
  sceneType: SCENE_TYPES.STREET,
  character: '罗远',
  text: `你去了韩国打工。语言不通？没关系，全靠比划。你在工地上搬过砖，在餐馆里洗过碗，最离谱的一份工作是——卖壮阳药。你站在首尔街头，对着路过的中年男人比划"你懂的"手势，然后把药往对方手里塞。`,
  choices: [
    { label: '"在韩国攒够钱，回国做小生意安安稳稳过日子"', next: 'ending_ordinary', effects: { pride: -1, wealth: 2, rep: 0 } },
    { label: '"回国！听说新东方老师年薪百万，我要去试试！"', next: 'act0_gre', effects: { pride: 2, wealth: -1, rep: 1 } }
  ],
  historyNote: '历史上老罗确实去韩国打过工，卖过壮阳药。',
  progress: 13
},
```

### 5.4 SCENE_TYPES 枚举（来自 config.js）

```javascript
export const SCENE_TYPES = {
  CLASSROOM: 'classroom',
  STREET: 'street',
  LECTURE: 'lecture',
  OFFICE: 'office',
  STAGE: 'stage',
  COURT: 'court',
  LAB: 'lab',
  FRIDGE_SMASH: 'fridge_smash',
  LIVESTREAM: 'livestream',
  TALKSHOW: 'talkshow',
  PODCAST: 'podcast',
  ENDING: 'ending',
};
```

### 5.5 CHAR_INFO 结构

每个新增节点需要在 CHAR_INFO 中添加对应条目：

```javascript
export const CHAR_INFO = {
  // 格式：节点ID: [角色名, 场景副标题]
  'act0_childhood_2': ['罗远', '延边·少年心事'],
  // ...
};
```

### 5.6 已有节点ID列表（新增节点不能与现有ID冲突）

`intro`, `act0_childhood`, `act0_b`, `act0_street`, `act0_korea`, `act0_gre`, `act1_first`, `act1_second`, `act1_a`, `act1_quotes`, `act1_fame`, `act1_resign`, `act2_a`, `act2_fight`, `act2_down`, `act2_b`, `act2_poster`, `act_fridge_start`, `act_fridge_fight`, `act_fridge_smash`, `act_fridge_theater`, `act_fang_start`, `act_fang_report`, `act3_lei`, `act3_a`, `act3_b`, `act3_rom`, `act4_a`, `act4_if`, `act4_price`, `act4_b`, `act4_factory`, `act5_a`, `act5_people`, `act5_b`, `act6_bird`, `act6_a`, `act6_crash`, `act6_supplier`, `act6_debt`, `act7_smoke`, `act7_shark`, `act7_restrict`, `act7_sign`, `act7_b`, `act7_talkshow`, `act7_payback`, `act7_retire`, `act8_thinred`, `act8_a`, `act8_ai`, `act8_podcast`, `act8_spring`, `act8_liang`, `act8_b`, `act9_final`

新增节点ID命名规范：`act{章节}_{描述}`，如 `act0_childhood_2`, `act1_class_2`, `act3_investor_1`

---

## 6. 项目灵魂

> **选择没有对错，只有不同的人生。**

核心设计哲学：

1. **不评判选择** — 没有标准答案，每条路都有风景
2. **选择塑造身份** — 属性不是分数，而是"你是什么样的人"的映射
3. **代价即意义** — 放弃的东西定义了你坚持的东西
4. **所有结局都值得尊重** — "传奇"不比"幸存者"更好，只是不同
5. **重玩不是为了赢，而是为了体验另一种人生**

### 阶段系统设计原则

| 阶段 | 章节 | 核心冲突 |
|------|------|---------|
| 少年 | 1-3 | 退学、自学、去新东方 |
| 名师 | 4-6 | 新东方讲课、砸冰箱、维权 |
| 创业 | 7-12 | 锤子科技、做手机、T1/T2 |
| 至暗 | 13-16 | 锤子倒闭、欠债6亿、被限高 |
| 还债 | 17-20 | 直播带货、真还传、退网 |
| 新生 | 21-23 | 播客、AI转型、新可能 |

### 选择远期后果设计原则

选择不只是影响下个节点，而是标记远期影响：

| 阶段 | 选择 | 远期后果 |
|------|------|---------|
| 新东方时期 | "公开批评体制" | → 后期获得公众同情+1 |
| 锤子时期 | "坚持做高端" | → 财富-2但理想主义+2，后期解锁"工匠传奇"结局 |
| 直播还债 | "接所有广告" | → 财富+3但名声-2，公众信任-2 |
| 退网宣言 | "真的退网" | → 锁死部分路线，但解锁"隐士"结局 |

### 文案风格参考

好的剧情文案：
- ✅ 有画面感："你站在寒风里，看着摊主把那本绝版书收起来"
- ✅ 有情感深度："妻子打来电话，孩子在学校被同学嘲笑'你爸是老赖'"
- ✅ 有老罗特色："你对着麦克风说'下一张'，屏幕没反应。你又喊了一遍——'下一张。'还是没反应。"
- ✅ 不超过200字，简洁有力

差的剧情文案：
- ❌ 纯叙述无画面："你经历了一些困难"
- ❌ 太长超过200字
- ❌ 无道德困境的选项
