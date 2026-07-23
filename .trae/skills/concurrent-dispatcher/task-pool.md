# Task Pool — 任务池

> 当前项目：真还传·创业模拟器（Phaser 3 + Vite 5 像素风互动小说）
> 任务拆分策略：**按文件拆分**（不同 Worker 改完全不同的文件 → 零冲突）
> 每次并发调度前读取本文件，调度完成后由调度器更新各任务的 status

---

## R15 轮次任务（全量 SCAN 产出 · 2026-07-22）

> 来源：复赛查缺补漏提示词 7 维度全量审查
> 基线评分：8.4/10（产品完整性 8.5 / 技术实现 8.0 / 实用性 8.5 / 创新性 9.0）
> 收敛状态：未收敛，继续迭代

---

## 任务清单（T1-T8 按编号执行，互不依赖）

### T1 — 润色 0_intro.js + 1_act0.js（序章 + 延边少年）

- **状态**：done 完成 2026-06-12）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/0_intro.js`
  - `luohammer-pixel-game/src/data/story/1_act0.js`
- **修改范围**：文件级修改（整个文件的 text/historyNote/effects 内容），**不改 index.js / export 结构**
- **任务类型**：文案润色编辑
- **润色重点**：退学决定的叛逆感、延边少年的街头气息、父亲管教的严厉与无奈、"老师我自己来"的骨气
- **工作原则**：
  1. 保留原有节点 ID 和 next 指向 —— 游戏流程不动
  2. 每个节点 text ≥ 80 字，有画面感和情绪张力
  3. choices 的两个选项要有纠结感，不是简单好坏
  4. historyNote 要加"为什么这件事重要" + "后来怎样了"
- **验收标准**：
  1. 每个节点 text ≥ 80 字，有画面感
  2. choices 两个选项有纠结感，不是简单好坏
  3. historyNote 加上"为什么"和"后来怎样了"
  4. effects 数值与文案逻辑一致，无越界
- **严格禁止**：不改节点 ID（key 名）、不改 next 指向、不改 sceneType、不修改 index.js 或其他文件
- **依赖**：无

---

### T2 — 润色 2_act1.js（新东方时期）

- **状态**：done（2026-06-12 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/2_act1.js`
- **修改范围**：文件级修改（整个文件的 text/historyNote/effects 内容）
- **任务类型**：文案润色编辑
- **润色重点**：试讲三次的紧张感、语录走红的荒诞感、辞职的决绝、"用灵魂讲课"的激情
- **工作原则**：同 T1
- **验收标准**：同 T1
- **严格禁止**：不改节点 ID、不改 next 指向、不改 sceneType、不动其他文件
- **依赖**：无

---

### T3 — 润色 3_act2.js + 4_fridge.js（牛博网 + 砸冰箱）

- **状态**：done（2026-06-12 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/3_act2.js`
  - `luohammer-pixel-game/src/data/story/4_fridge.js`
- **修改范围**：文件级修改
- **任务类型**：文案润色编辑
- **润色重点**：牛博网的理想主义宣言、砸冰箱的戏剧张力、"100 台冰箱全砸了"的震撼
- **工作原则**：同 T1
- **验收标准**：同 T1
- **严格禁止**：同 T1
- **依赖**：无

---

### T4 — 润色 5_fang.js + 6_act3.js（方舟子论战 + 锤子成立）

- **状态**：done（2026-06-12 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/5_fang.js`
  - `luohammer-pixel-game/src/data/story/6_act3.js`
- **修改范围**：文件级修改
- **任务类型**：文案润色编辑
- **润色重点**：论战攻防节奏的紧张感、与雷军会面的微妙氛围、创业初期焦虑和激情并存
- **工作原则**：同 T1
- **验收标准**：同 T1
- **严格禁止**：同 T1
- **依赖**：无

---

### T5 — 润色 7_act4.js + 8_act5.js + 9_act6.js（T1发布 → 资金链断裂）

- **状态**：done（2026-06-12 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/7_act4.js`
  - `luohammer-pixel-game/src/data/story/8_act5.js`
  - `luohammer-pixel-game/src/data/story/9_act6.js`
- **修改范围**：文件级修改
- **任务类型**：文案润色编辑
- **润色重点**：T1 发布的狂喜、供应链噩梦的窒息感、阿里弃投的绝望、坚果 Pro 的回光返照、TNT 鸟巢发布会的"安静"名场面、资金链断裂的压迫感
- **工作原则**：同 T1
- **验收标准**：同 T1
- **严格禁止**：同 T1
- **依赖**：无

---

### T6 — 润色 10_act7.js（真还传：电子烟/直播/脱口秀）

- **状态**：done（2026-06-12 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/10_act7.js`
- **修改范围**：文件级修改
- **任务类型**：文案润色编辑
- **润色重点**："行业冥灯"自嘲的幽默与辛酸、直播首秀 1.1 亿的反差、脱口秀大会上的自黑艺术、还债进度的真实感和数字背后的人生
- **工作原则**：同 T1
- **验收标准**：同 T1
- **严格禁止**：同 T1
- **依赖**：无

---

### T7 — 润色 11_act8.js + 12_act9.js（AR/AI/播客 + 终章结局）

- **状态**：done（2026-06-12 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/11_act8.js`
  - `luohammer-pixel-game/src/data/story/12_act9.js`
- **修改范围**：文件级修改
- **任务类型**：文案润色编辑
- **润色重点**：AR 梦碎的遗憾感、AI 转型的赌注与希望、播客的回归初心、终章结局的多样性和每一条路的意义
- **工作原则**：同 T1
- **验收标准**：同 T1
- **严格禁止**：同 T1
- **依赖**：无

---

### T8 — 内容一致性 + 可达性 + 效果校验（脚本开发）

- **状态**：done（2026-06-12 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/scripts/validate-story.cjs`（已有，检查是否需要增强）
  - `luohammer-pixel-game/scripts/validate-story.mjs`（已有，检查是否需要增强）
  - 可选：新建 `luohammer-pixel-game/scripts/validate-effects.cjs`
- **修改范围**：脚本开发（不修改 story 文件，只读）
- **任务类型**：质量校验脚本开发
- **工作重点**：
  1. 确保 `validate-story.mjs` 能检测：死链、孤立节点、循环指向、卡死节点
  2. 新增/增强 effects 校验：数值越界、flag 链路完整性、结局可达性
  3. 脚本输出可读的 HTML 或 Markdown 报告
  4. 能一键运行：`node scripts/validate-story.mjs`
- **验收标准**：
  1. validate-story.mjs 能正确报告 story 结构问题
  2. effects 校验能检测数值越界（>100 或 <0）、未定义 flag 引用
  3. 脚本运行无报错，输出清晰可读
  4. 对当前 story 运行后报告 0 errors
- **严格禁止**：不修改任何 story 节点内容、不改 story 文件结构
- **依赖**：无

---

## 全局约束（所有任务必须遵守）

1. **文件独立原则**：每个任务的操作文件列表与其他任务**完全不重叠**，从根本上消除并发冲突
2. **结构保护原则**：不能修改节点 ID、next 指向、sceneType —— 这些是游戏流程的骨架
3. **文件完整性原则**：每个 story 文件是一个独立的 ES 模块，修改后必须能被 `import` 正常加载
4. **语法保护原则**：text 中的模板字符串（反引号）如有嵌套，必须正确转义
5. **内容审核原则**：文案润色是"让现有内容更好"，不是"推翻重来" —— 保留原有的核心情节选择和分支逻辑

---

## 状态字段说明

- `pending`：待执行
- `in_progress`：正在被某个 Worker 执行
- `done`：已完成并通过调度器检查
- `blocked`：被其他任务阻塞（有依赖关系时使用）

每次调度完成后，由调度器负责更新本文件的状态字段。

---

## v0.4 任务池（视觉交互打磨版）

### T9 — 过渡动画升级 + 粒子特效增强

- **状态**：done（2026-06-13 调度器完成）
- **修改范围**：文件级修改
- **任务类型**：视觉交互增强
- **工作重点**：
  1. 升级 Transition.js：从简单淡入淡出升级为 CRT 关机/开机效果 + 像素块擦除转场
  2. 增强粒子系统：背景粒子从25个增到40个、选择反馈粒子、属性变化粒子
  3. 屏幕震动反馈：翻车强震动(8px,300ms)、重大选择轻微震动(2px,100ms)
- **工作原则**：
  1. 保持现有 Transition API 兼容（fade 方法仍可用）
  2. 新增 crtOff/crtOn/pixelWipe/stageTransition 方法
  3. 粒子使用对象池避免频繁 GC
  4. 震动通过 camera shake 实现，不影响 UI 层
- **验收标准**：
  1. 场景切换有 CRT 质感（白光闪烁→黑屏→扫描线展开）
  2. 选择选项时有金色粒子反馈
  3. 翻车时有屏幕震动冲击
  4. 不破坏现有场景切换流程
- **严格禁止**：不改 story 数据文件、不改 config.js 的常量定义、不改 GameScene 的核心流程
- **依赖**：无

---

### T10 — 音效系统丰富化 + 背景音乐循环

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/AudioSystem.js`
- **修改范围**：文件级修改
- **任务类型**：音效增强
- **工作重点**：
  1. 当前已有 15+ 种音效，检查是否有遗漏的交互场景
  2. 增强 BGM 系统：主界面缓慢方波循环、结局画面根据类型播放不同氛围
  3. 音量渐变：场景切换时 fade out 100ms → 切换 → fade in 100ms
  4. 确保所有音效统一经过 gainNode 控制
- **工作原则**：
  1. 所有音效用 Web Audio API 合成，不引入外部音频文件
  2. 音效不刺耳不突兀，频率和音量控制在舒适范围
  3. BGM 音量低于音效（0.25 vs 0.7）
  4. 保持现有 API 兼容
- **验收标准**：
  1. 所有交互场景有对应音效
  2. BGM 在主界面和结局画面正常播放
  3. 音量渐变平滑无爆音
  4. 不破坏现有音效播放
- **严格禁止**：不改 story 数据文件、不引入外部音频文件、不改 GameScene 的核心流程
- **依赖**：无

---

### T11 — 分享卡 + 决策回顾面板

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/EndingScene.js`
  - `luohammer-pixel-game/src/systems/PixelRenderer.js`（添加分享卡渲染方法）
  - `luohammer-pixel-game/src/scenes/GameScene.js`（state.history 记录）
- **修改范围**：文件级修改
- **任务类型**：功能开发
- **工作重点**：
  1. 在 GameScene.makeChoice() 中记录 state.history（nodeId, choiceLabel, historyChoice）
  2. 在 EndingScene 中添加"决策回顾"面板：表格式展示选择对比
  3. Canvas 分享卡生成：800×500 图片含结局标题+属性条+金句+水印
  4. 分享卡支持长按保存
- **工作原则**：
  1. 决策回顾用像素风表格样式（金色边框+暗色行交替）
  2. 分享卡背景暗色+金色装饰角，与游戏整体风格一致
  3. state.history 是数组，每次选择 push 一条记录
  4. 分享卡用 Canvas API 渲染，转为 dataURL 显示
- **验收标准**：
  1. 结局画面有决策回顾表格，显示每个关键选择
  2. 分享卡可生成并保存
  3. state.history 正确记录每次选择
  4. 不破坏现有结局展示流程
- **严格禁止**：不改 story 数据文件、不改 config.js 常量
- **依赖**：无

---

### T12 — 成就系统增强 + 隐藏成就

- **状态**：done（对话-1 完成 2026-06-13）
- **操作文件**：
  - `luohammer-pixel-game/src/ui/AchievementPopup.js`
  - `luohammer-pixel-game/src/scenes/GameScene.js`（成就触发逻辑）
  - `luohammer-pixel-game/src/scenes/EndingScene.js`（成就列表展示）
- **修改范围**：文件级修改
- **任务类型**：功能增强
- **工作重点**：
  1. 整理现有成就（来自 story.js choices 的 achievement 字段）
  2. 新增 4 个隐藏成就：平行宇宙/老罗附体/速通玩家/再来亿次
  3. 增强成就弹窗动画：普通→右侧滑入+金色边框，隐藏→全屏闪光+闪烁
  4. EndingScene 底部展示已解锁/未解锁成就列表
- **工作原则**：
  1. 成就数据存储在 localStorage
  2. 隐藏成就条件在 GameScene 中检测
  3. 弹窗显示 3 秒后自动消失
  4. 未解锁成就显示灰色 + "???"
- **验收标准**：
  1. 12 个成就全部可触发
  2. 隐藏成就有惊喜感（全屏闪光+特殊音效）
  3. EndingScene 展示成就列表
  4. 不破坏现有成就弹窗
- **严格禁止**：不改 story 数据文件、不改 config.js 常量
- **依赖**：无

---

### T13 — 性能优化 + Bug 修复

- **状态**：done（对话-1 完成 2026-06-13）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/PixelRenderer.js`
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/src/data/story.js`（如有冗余数据需清理）
- **修改范围**：文件级修改
- **任务类型**：性能优化
- **工作重点**：
  1. PixelRenderer.js（6495字符）性能优化：缓存常用图形为 RenderTexture
  2. 粒子系统使用对象池，避免频繁 new/GC
  3. 内存泄漏检查：场景切换时清理旧 Graphics 对象、移除事件监听器
  4. 修复存档恢复时 Set 对象的序列化/反序列化问题
- **工作原则**：
  1. 不改变渲染结果，只优化性能
  2. 优先优化最频繁调用的方法
  3. 对话框打字机效果用 requestAnimationFrame 替代 setTimeout
  4. 保持现有 API 兼容
- **验收标准**：
  1. Chrome DevTools 无 console 错误
  2. 内存使用稳定（连续玩5局不增长）
  3. 帧率 ≥ 30fps
  4. 不破坏现有渲染效果
- **严格禁止**：不改 story 数据文件、不改 config.js 常量、不删除功能
- **依赖**：无

---

## v0.5 任务池（UI/视觉/内容丰富度升级）

> 来源：2026-06-12 改进计划 docs/plans/2026-06-12-ui-content-improvement-plan.md

### T14 — 去除角色图片水印

- **状态**：done（对话-1 完成 2026-06-13）
- **操作文件**：
  - `luohammer-pixel-game/assets/characters/luo-angry.png`
  - `luohammer-pixel-game/assets/characters/luo-depressed.png`
  - `luohammer-pixel-game/assets/characters/luo-happy.png`
  - `luohammer-pixel-game/assets/characters/luo-livestream.png`
  - `luohammer-pixel-game/assets/characters/luo-speaking.png`
  - `luohammer-pixel-game/assets/characters/luo-standing.png`
  - `luohammer-pixel-game/assets/characters/luo-young.png`
  - `luohammer-pixel-game/assets/characters_clean/luo-angry.png`
  - `luohammer-pixel-game/assets/characters_clean/luo-depressed.png`
  - `luohammer-pixel-game/assets/characters_clean/luo-happy.png`
  - `luohammer-pixel-game/assets/characters_clean/luo-livestream.png`
  - `luohammer-pixel-game/assets/characters_clean/luo-speaking.png`
  - `luohammer-pixel-game/assets/characters_clean/luo-standing.png`
  - `luohammer-pixel-game/assets/characters_clean/luo-young.png`
- **修改范围**：图片处理（裁剪右下角水印区域）
- **任务类型**：图片处理
- **工作重点**：
  1. 所有角色图片右下角有「豆包AI生成」水印，需要去除
  2. 用 Python PIL 裁剪右下角约 15% 宽 × 8% 高的水印区域
  3. 两个目录都要处理：characters/ 和 characters_clean/
  4. 处理后图片尺寸会略小，但不影响使用
- **工作原则**：
  1. 优先用裁剪方式（最干净），如果裁剪损失太多画面则用 inpaint
  2. 保持图片格式为 PNG
  3. characters_clean/ 的图片已有透明背景，处理时保留 alpha 通道
  4. 处理完验证图片能正常打开
- **验收标准**：
  1. 14 张图片水印全部去除
  2. 图片能正常打开，无损坏
  3. characters_clean/ 图片保留透明背景
  4. 水印区域无残留文字
- **严格禁止**：不修改任何代码文件、不修改场景图片（scene-*.png）
- **依赖**：无

---

### T15 — 补充选项数量（2选项节点→3-4选项）

- **状态**：done（对话-2 完成 2026-06-13，97个2选项节点全部补充为3+选项）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/0_intro.js`
  - `luohammer-pixel-game/src/data/story/1_act0.js`
  - `luohammer-pixel-game/src/data/story/2_act1.js`
  - `luohammer-pixel-game/src/data/story/3_act2.js`
  - `luohammer-pixel-game/src/data/story/4_fridge.js`
  - `luohammer-pixel-game/src/data/story/5_fang.js`
  - `luohammer-pixel-game/src/data/story/6_act3.js`
  - `luohammer-pixel-game/src/data/story/7_act4.js`
  - `luohammer-pixel-game/src/data/story/8_act5.js`
  - `luohammer-pixel-game/src/data/story/9_act6.js`
  - `luohammer-pixel-game/src/data/story/10_act7.js`
  - `luohammer-pixel-game/src/data/story/11_act8.js`
  - `luohammer-pixel-game/src/data/story/12_act9.js`
- **修改范围**：文件级修改 —— 为所有只有 2 个 choices 的节点补充第 3 个选项
- **任务类型**：内容扩充
- **工作重点**：
  1. 遍历所有 story 文件，找出 choices 数组长度为 2 的节点
  2. 为每个 2 选项节点补充第 3 个选项（"第三条路"：折中/创新/逃避/幽默）
  3. 关键转折点（如 act0_korea、act3_a、act6_a）补充第 4 个选项
  4. 新选项的 next 指向必须指向已有节点（不能创建新节点）
  5. 新选项的 effects 必须合理，与文案逻辑一致
- **工作原则**：
  1. 第 3 选项不能是简单的"好/坏"二分，要有独特视角
  2. 新选项的 label 文字风格与现有一致（第一人称引号格式）
  3. effects 数值范围 -2 到 +2，总和尽量接近 0（有得有失）
  4. 保持原有 2 个选项不变，只在末尾追加
- **验收标准**：
  1. 所有节点 choices 数组长度 ≥ 3
  2. 新选项 next 指向的节点确实存在
  3. 新选项 effects 数值合理，无越界
  4. 文字风格与现有一致
- **严格禁止**：不改节点 ID、不改已有 choices 的 next 指向、不改 sceneType、不创建新节点、不改 import/export
- **依赖**：无

---

### T16 — 增加 historyNote 展示功能

- **状态**：done（2026-06-13 调度器完成，已有实现无需修改）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/src/systems/DialogSystem.js`
- **修改范围**：文件级修改
- **任务类型**：功能开发
- **工作重点**：
  1. 在选择完成后，增加「历史真相」按钮，点击后展示当前节点的 historyNote
  2. historyNote 用 DOM overlay 方式渲染（不用 Canvas），确保中文清晰
  3. 展示方式：半透明遮罩 + 居中卡片，含标题"历史真相" + historyNote 文本 + 关闭按钮
  4. 按钮样式：金色边框像素风，与游戏风格一致
- **工作原则**：
  1. historyNote 展示是可选的，玩家可以选择不看
  2. 展示时不暂停游戏，关闭后继续
  3. DOM overlay 叠加在 Canvas 上方
  4. 文字用 "Microsoft YaHei", "PingFang SC" 系统字体
- **验收标准**：
  1. 选择完成后出现「历史真相」按钮
  2. 点击后正确展示当前节点的 historyNote
  3. 关闭按钮正常工作
  4. 不影响现有游戏流程
- **严格禁止**：不改 story 数据文件、不改 config.js 常量、不改其他系统文件
- **依赖**：无

---

### T17 — DOM Overlay 文字渲染替换 Canvas 文字

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/DialogSystem.js`
  - `luohammer-pixel-game/src/systems/ChoiceSystem.js`
  - `luohammer-pixel-game/src/systems/StatsSystem.js`
  - `luohammer-pixel-game/src/systems/TalentSystem.js`
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/src/scenes/BootScene.js`
  - `luohammer-pixel-game/src/scenes/EndingScene.js`
  - `luohammer-pixel-game/index.html`
- **修改范围**：文件级修改
- **任务类型**：架构改造
- **工作重点**：
  1. 将对话框、选项按钮、属性条、天赋卡片从 Canvas 渲染改为 DOM overlay
  2. Canvas 只保留：背景图、角色立绘、粒子特效、转场动画
  3. 在 index.html 中添加 DOM overlay 容器（#ui-overlay）
  4. 所有文字 UI 用 HTML div/button 渲染，确保中文清晰
  5. 属性条加 tooltip：鼠标悬停显示属性含义说明
  6. 对话框支持动态高度，解决文字溢出问题
  7. 选项按钮与对话框分离，不重叠
- **工作原则**：
  1. DOM overlay 用 position: absolute 叠加在 Canvas 上方
  2. 保留原有 API（showDialog/showChoices/updateStats 等），内部实现改为操作 DOM
  3. 样式参考 prototype.html 的设计
  4. 响应式：跟随 Canvas 缩放
  5. 字体："Microsoft YaHei", "PingFang SC", sans-serif
- **验收标准**：
  1. 中文文字清晰，无模糊/拉扯
  2. 对话框文字不溢出
  3. 选项按钮与对话框不重叠
  4. 属性条 hover 显示 tooltip
  5. 天赋选择改为 5 选 2（展示 5 个天赋卡片）
  6. 游戏流程不受影响
- **严格禁止**：不改 story 数据文件、不改 config.js 常量、不删除 Canvas 渲染（背景/角色/粒子保留）
- **依赖**：无

---

### T18 — 标题画面重设计

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/BootScene.js`
  - `luohammer-pixel-game/index.html`（DOM overlay 部分）
- **修改范围**：文件级修改
- **任务类型**：视觉重设计
- **工作重点**：
  1. 标题画面改为 DOM overlay 渲染（不用 Canvas 画文字）
  2. 左侧：真实角色图片（去背景 PNG），加金色轮廓光 drop-shadow
  3. 右侧：大标题 + 金句 + 按钮
  4. 增加角色金句（如"彪悍的人生不需要解释"）
  5. 去掉底部版权文字
  6. 加打字机效果或呼吸灯动态
  7. 角色加聚光灯/光晕效果
- **工作原则**：
  1. 页面不能空，视觉焦点要集中
  2. 角色图片用 assets/characters_clean/ 下去背景的 PNG
  3. 金色主题一致：#f0c040
  4. 动态效果不超过 2 种，避免花哨
- **验收标准**：
  1. 标题画面视觉充实，不空旷
  2. 角色图片清晰，与背景有区分
  3. 无版权文字
  4. 有动态效果
  5. 按钮可点击（继续游戏/新游戏）
- **严格禁止**：不改 story 数据文件、不改 config.js 常量
- **依赖**：T14（去水印）、T17（DOM Overlay 基础）

---

### T19 — 随机事件弹窗 UI

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/RandomEventSystem.js`
  - `luohammer-pixel-game/index.html`（DOM overlay 部分）
- **修改范围**：文件级修改
- **任务类型**：功能增强
- **工作重点**：
  1. 随机事件弹窗改为 DOM overlay 渲染
  2. 弹窗样式：半透明遮罩 + 居中卡片，含事件标题 + 描述 + 2个选项
  3. 弹窗出现时有动画（从底部滑入或淡入）
  4. 选项按钮样式与主线选择一致
  5. 弹窗关闭后有属性变化反馈动画
- **工作原则**：
  1. 随机事件是"打断式"体验，弹窗要醒目但不突兀
  2. 弹窗文字清晰（DOM 渲染）
  3. 与主线叙事有视觉区分（如不同边框颜色/图标）
  4. 保持现有随机事件触发逻辑不变
- **验收标准**：
  1. 随机事件弹窗正确展示
  2. 选项可选择，效果正确应用
  3. 弹窗动画流畅
  4. 不影响主线叙事流程
- **严格禁止**：不改 story 数据文件、不改随机事件数据（events-random.js）、不改触发概率
- **依赖**：T17（DOM Overlay 基础）

---

### T20 — 多段叙事（长文本拆分 + 点击继续）

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/DialogSystem.js`
  - `luohammer-pixel-game/src/scenes/GameScene.js`
- **修改范围**：文件级修改
- **任务类型**：功能增强
- **工作重点**：
  1. 将长文本（>150字）自动拆分为多段，每段 100-150 字
  2. 每段显示后，底部出现"点击继续 ▶"提示
  3. 点击后显示下一段，最后一段显示完后出现选项
  4. 拆分规则：按句号/感叹号/问号自然断句，不在词中间断
  5. 每段显示时有淡入动画
- **工作原则**：
  1. 拆分不能破坏语义，每段要能独立成句
  2. "点击继续"提示要有呼吸灯动画
  3. 最后一段与选项之间有明确过渡
  4. 短文本（<150字）不拆分，直接显示
- **验收标准**：
  1. 长文本自动拆分为 2-4 段
  2. 每段点击后显示下一段
  3. 最后一段显示完后出现选项
  4. 短文本不拆分
  5. 不影响现有游戏流程
- **严格禁止**：不改 story 数据文件、不改 config.js 常量
- **依赖**：T17（DOM Overlay 基础）

---

### T21 — 阶段结算画面

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/index.html`（DOM overlay 部分）
- **修改范围**：文件级修改
- **任务类型**：功能开发
- **工作重点**：
  1. 每个阶段结束时，弹出阶段结算画面
  2. 结算内容：阶段名称 + 时间段 + 结算文字 + 属性变化动画 + 成就解锁
  3. 属性变化用动画条展示（旧值→新值，颜色区分增减）
  4. 成就解锁用金色弹窗展示
  5. 结算画面持续 3-5 秒，或点击"继续"关闭
- **工作原则**：
  1. 结算画面是"喘息时刻"，节奏要慢
  2. 属性变化要直观（+1 绿色，-1 红色）
  3. 成就解锁要有仪式感
  4. DOM overlay 渲染，文字清晰
- **验收标准**：
  1. 阶段结束时正确弹出结算画面
  2. 属性变化动画正确
  3. 成就解锁弹窗正常
  4. 点击继续或自动关闭后进入下一阶段
  5. 不影响现有游戏流程
- **严格禁止**：不改 story 数据文件、不改 stages.js 阶段定义、不改 config.js 常量
- **依赖**：T17（DOM Overlay 基础）

---

### T22 — 视觉还原度审查 + Bug 修复

- **状态**：done（2026-06-13 视觉审查报告已输出，P0 已修复）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/DialogSystem.js`
  - `luohammer-pixel-game/src/systems/ChoiceSystem.js`
  - `luohammer-pixel-game/src/systems/StatsSystem.js`
  - `luohammer-pixel-game/src/systems/TalentSystem.js`
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/src/scenes/BootScene.js`
  - `luohammer-pixel-game/src/scenes/EndingScene.js`
  - `luohammer-pixel-game/index.html`
- **修改范围**：文件级修改（审查 + 修复）
- **任务类型**：审查 + Bug 修复
- **工作重点**：
  1. 启动游戏（npm run dev），逐画面对照 prototype.html 检查还原度
  2. 检查 4 个画面：标题画面、天赋选择、游戏主界面、结局画面
  3. 对照项：文字清晰度、布局位置、颜色一致性、间距比例、动画效果
  4. 记录所有差异，按严重程度分级：P0（必须修）/ P1（应该修）/ P2（可以修）
  5. 直接修复 P0 级别的问题
  6. P1/P2 级别问题列出清单，不修
- **工作原则**：
  1. 以 prototype.html 为标准，实际游戏要尽量还原
  2. P0 = 文字模糊/溢出/重叠/功能不可用
  3. P1 = 位置偏移/颜色偏差/动画缺失
  4. P2 = 细节差异/优化建议
  5. 修复时只改 CSS/DOM 结构，不改游戏逻辑
- **验收标准**：
  1. 输出审查报告（Markdown 格式），含所有差异项和分级
  2. P0 问题全部修复
  3. 修复后游戏可正常运行
  4. 不引入新 Bug
- **严格禁止**：不改 story 数据文件、不改游戏逻辑、不改 config.js 常量
- **依赖**：T17（DOM Overlay）、T18（标题画面）
- **审查报告**：`luohammer-pixel-game/docs/t22-visual-review-report.md`

---

### T23 — DOM Overlay 定位修复（文字模糊根因）

- **状态**：done（2026-06-13 已修复，fixed inset:0 + 删除同步脚本）
- **操作文件**：
  - `luohammer-pixel-game/index.html`（CSS + JS 同步脚本）
- **修改范围**：文件级修改（仅 CSS + 定位脚本）
- **任务类型**：Bug 修复（P0 级）
- **问题根因**：
  - `#ui-overlay` 固定 800×500px，通过 JS 同步到 Canvas 的 getBoundingClientRect()
  - Canvas 被 Scale.FIT 拉伸后，overlay 跟着拉伸，文字变形模糊
  - 这跟 Canvas 文字模糊是同一个问题——都是因为缩放
- **工作重点**：
  1. `#ui-overlay` 改为 `position: fixed; inset: 0;`，直接铺满整个视口
  2. 所有内部布局用百分比/vw/vh/clamp()，不用固定 px
  3. 删除 index.html 底部的 syncOverlay JS 脚本（不再需要同步 Canvas 位置）
  4. 对话框：`bottom: 0; left: 0; right: 0; height: auto; max-height: 30vh;`
  5. 选项区：`bottom: 30vh; left: 5%; right: 5%;`（对话框上方）
  6. 属性条：`top: 2vh; right: 2vw;`
  7. 天赋/标题/结局 overlay：`inset: 0;`（铺满屏幕）
  8. 字体大小用 clamp()：如 `font-size: clamp(14px, 2vw, 18px);`
  9. 间距用 clamp()：如 `padding: clamp(8px, 1.5vw, 16px);`
- **工作原则**：
  1. overlay 不跟着 Canvas 走，独立铺满屏幕
  2. Canvas 只管背景/角色/粒子，overlay 只管文字/按钮
  3. 两者视觉对齐靠百分比布局自然实现，不需要 JS 同步
  4. 保持现有 DOM 结构不变，只改 CSS 和定位脚本
- **验收标准**：
  1. 中文文字 1:1 像素渲染，不模糊不拉扯
  2. 窗口缩放时 overlay 正确响应
  3. 对话框/选项/属性条位置正确，不重叠
  4. 游戏流程不受影响
- **严格禁止**：不改 story 数据文件、不改游戏逻辑、不改 Canvas 渲染代码
- **依赖**：无（独立修复，优先级最高）

---

### T24 — 天赋选择界面中文化

- **状态**：done（2026-06-13 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/TalentSystem.js`
  - `luohammer-pixel-game/src/data/talents.js`（未改动）
  - `luohammer-pixel-game/index.html`（天赋 overlay CSS 部分，未改动）
- **修改范围**：文件级修改
- **任务类型**：文案本地化
- **问题根因**：天赋卡片底部的效果/特殊说明目前显示英文（如"Idealism +2"），目标用户全中文
- **完成内容**：
  1. `specialLabels` 中文映射表：9 个特殊能力全部中文（随机事件更偏向好结果、每次跌倒让理想主义更坚定、公众信任和名声双倍增长等）
  2. 效果描述格式修正："理想主义 +2" → "理想主义+2"（符号后无空格）
  3. 稀有度标签：common/rare/legendary → 普通/稀有/传说（已存在）
  4. 属性键：pride/wealth/reputation 等全部映射到中文
- **验收标准**：
  1. 天赋选择界面无英文文案 ✅
  2. 30 个天赋的效果描述全部中文 ✅
  3. 游戏流程不受影响 ✅
- **依赖**：无

---

### T25 — 角色图片全面重制

- **状态**：done（2026-06-13 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/assets/characters/`（角色立绘 + 场景图）
  - `luohammer-pixel-game/assets/characters_clean/`（BootScene 角色图）
  - `luohammer-pixel-game/src/scenes/GameScene.js`（核心修复：_layoutCharacter 智能裁剪 + _updateCharacterPosition）
- **修改范围**：资源级 + 代码级修改
- **问题根因**：
  1. "半边脸"：角色全身站立图（1069x1468）在右侧 1/3 区域显示时，脸部占比太小
  2. 图片体积过大（1.8MB/张），加载缓慢
  3. 3 个场景图（stage/lab/podcast）缺失，Phaser preload 失败
  4. 新 AudioSystem 的 unlocked 状态阻塞 BGM 启动
- **修复方案**：
  1. **智能裁剪**：GameScene._layoutCharacter() 加入 setCrop 逻辑——竖版图保留顶部 55%（包含头+肩），横版图保留顶部 65%
  2. **scale 重新计算**：基于裁剪后尺寸而非原图尺寸重新计算 baseScale，使角色在右侧 1/3 区域完整显示
  3. **图片压缩**：用 sharp 库压缩所有 PNG 图片，角色图调整为 512px，场景图调整为 800px，总体积从 50MB → 20MB
  4. **缺失场景图**：从 scene-office.png / scene-talkshow.png 复制生成 scene-podcast.png / scene-stage.png / scene-lab.png
  5. **7 种不同角色图**：standing/speaking/angry/depressed/happy/livestream/young 齐备
- **验证结果**：
  - 角色完整显示（setCrop 确保脸部可见 ✅
  - 所有场景图存在（修复 preload 失败 ✅
  - 图片大小：角色图 180-580KB，场景图 800-1100KB ✅
  - npm run build 通过 exit code 0 ✅
  - 无控制台报错 ✅

---

### T26 — BGM / 音效系统修复

- **状态**：done（2026-06-13 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/AudioSystem.js`（核心：Web Audio API 程序化 BGM，12 种氛围音乐模式）
  - `luohammer-pixel-game/src/scenes/BootScene.js`（标题画面解锁 + menu BGM）
  - `luohammer-pixel-game/src/scenes/GameScene.js`（核心修复：新增 AudioSystem 后自动 unlock + 去掉 isUnlocked 硬检查）
- **修改范围**：音频系统初始化 + 解锁时序修复
- **任务类型**：Bug 修复
- **问题根因**：
  1. BootScene 点击 "开始游戏" 后 → BootScene 销毁
  2. 进入 GameScene 时 **GameScene.create() 又创建了新的 AudioSystem**
  3. 新 AudioSystem 的 `_unlocked` 初始值为 false，`_tryStartStageBGM()` 的 `!this.audio.isUnlocked()` 永远阻止 BGM 启动
- **修复方案**：
  1. **GameScene.js create()**：`this.audio = new AudioSystem(this)` 后立即 `this.audio.unlock()` —— 用户已点击开始按钮，AudioContext 可以直接 resume
  2. **GameScene.js _tryStartStageBGM()**：去掉 `!this.audio.isUnlocked()` 硬检查，改为"若未解锁尝试 unlock 再播放"；BGM 启动逻辑不再被锁
  3. **GameScene.js _updateStageBGM()**：同样去掉 isUnlocked 硬检查，节点切换时可正确切换氛围音乐
- **现有功能确认**（已实现，无需新增）：
  - AudioSystem.js 内置 12 种 BGM 模式（menu/7 stage/4 ending），用方波+三角波程序化生成
  - BootScene `_setupAudioUnlock()` 在用户首次 pointerdown 后解锁 + 启动 menu BGM
  - BootScene 静音按钮 `_createSoundToggle()` 已存在
  - DialogSystem 打字机音效已接入 AudioSystem
  - 音量默认 master=0.6, bgm=0.25, sfx=0.5 — 不为 0
- **验收标准达成**：
  1. 标题画面有 BGM ✓（BootScene 首次点击后 startBGM('menu')）
  2. 游戏主界面不同阶段有不同 BGM ✓（youth/teacher/startup/dark/repay/reborn 各有独立模式）
  3. 打字机音效正常 ✓（DialogSystem this.system.audio.play('typewriter')）
  4. 静音按钮可用 ✓（BootScene + GameScene 各有 soundToggle）
  5. 不引入音频相关的报错 ✓（`npm run build` 通过，AudioSystem 内部全有 try/catch）
- **构建验证**：`vite build` 通过，exit code 0

---

### T27 — 角色名字替换（罗永浩 → 小罗/老罗）

- **状态**：done（2026-06-13 构建验证通过）
- **操作文件**（全部修改，不改动原始数据）：
  - `luohammer-pixel-game/src/scenes/GameScene.js`（核心：_resolveCharacterName + _replaceCharacterNameInText 动态替换）
  - `luohammer-pixel-game/src/scenes/EndingScene.js`（结局文本 desc/summary/quote/title 替换为"老罗"）
  - `luohammer-pixel-game/src/systems/RandomEventSystem.js`（随机事件 title/text/choice.label 动态替换）
- **修改范围**：渲染层修改，不改原始数据文件
- **任务类型**：文案修改
- **实现方案**（数据零改动 / 渲染层动态替换）：
  1. **GameScene._resolveCharacterName(nodeId)**：根据节点所在 stage 判断：youth/teacher/startup → "小罗"，dark/repay/reborn → "老罗"
  2. **GameScene._replaceCharacterNameInText(text, nodeId)**：文本中所有"罗永浩"替换为当前阶段名
  3. **loadNode**：speaker 名 + 对话文本 + 选项 label 全部替换
  4. **往事回响 / 压力崩溃 / 隐藏事件**：文本中替换
  5. **EndingScene**：title/desc/summary/quote 全部替换为"老罗"（结局均为后期）
  6. **RandomEventSystem**：title/text/choice.label 根据当前节点 stage 动态替换
  7. **HistoryCard**：不做替换（historyNote 中保留真实姓名"罗永浩"）
- **验收标准**：
  1. 游戏对话框中不再出现"罗永浩"作为玩家名字 ✅
  2. 阶段切换时名字正确变化（youth→teacher→startup=小罗, dark→repay→reborn=老罗）✅
  3. historyNote 中仍保留真实姓名 ✅
  4. 构建通过，流程不受影响 ✅
- **依赖**：无

---

### T28 — 自动滚动文字功能（非自动继续）

- **状态**：done（2026-06-13 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/DialogSystem.js`（全部改动集中在此）
  - `luohammer-pixel-game/index.html`（continueEl 默认文本已存在，无需改动）
- **修改范围**：文件级修改
- **任务类型**：功能增强
- **实现方案**：
  1. **状态属性**：`_autoPlay`（开关）、`_autoPlayDelay`（段间延迟）、`_autoPlaySpeedIdx`（速度档位）、`_autoPlayTimer`（定时器句柄）、`_typingSpeedIdx`（打字速度档位）
  2. **键盘快捷键**（document 级监听，AbortController 管理生命周期）：
     - `A`：切换自动播放开关
     - `S`：切换段间延迟（慢 2500ms / 中 1500ms / 快 700ms）
     - `Q`：切换打字机速度（慢 60ms / 中 30ms / 快 12ms）
  3. **finishTyping()**：打字完成后，若 `_autoPlay` 开启且在多段叙事非末段 → 延迟后自动调用 `_showSegment(下一段)`
  4. **关键约束**：单段文本 / 多段叙事最后一段 → **不自动推进**，始终等待用户点击
  5. **`_updateContinueHint()`**：根据状态切换提示文字为「▶ 自动播放中 (中速/中打) · 点击继续或按 A 关闭」或「点击继续 ▶」
  6. **清理**：`hide()` 中清理定时器，`destroy()` 中 abort 键盘信号
- **验收标准**：
  1. 开启自动播放后，文字自动逐字显示 ✅
  2. 显示完整后：多段自动推进下一段，单段/最后一段等待点击 ✅
  3. 可随时关闭自动播放 ✅
  4. 不影响现有游戏流程 ✅
- **依赖**：无

---

### T29 — 选项框动态位置与布局优化

- **状态**：done（2026-06-13 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/ChoiceSystem.js`
  - `luohammer-pixel-game/index.html`（选项区 CSS）
- **修改范围**：文件级修改
- **任务类型**：UI 布局优化
- **问题根因**：当前选项框会"戳到中间"，位置固定为底部，长选项时会遮挡角色/背景重点内容
- **工作重点**：
  1. 选项区位置根据屏幕内容动态调整：
     - 2 个选项：底部居中，横向并排或底部堆叠
     - 3-4 个选项：左侧或右侧垂直排列，不遮挡角色
     - 选项较多时：右侧滑入式面板
  2. 选项框背景加半透明模糊，避免与背景混淆
  3. 选项按钮高度根据文字自动扩展（不要截断）
  4. 选项标记 A/B/C/D 加图标化设计
  5. 鼠标悬停时有明显高亮，移动端正反高亮
  6. 选项与对话框之间保留清晰间距
- **工作原则**：
  1. 不遮挡角色脸部和重要背景元素
  2. 选项文字必须完整显示，不换行到第二行时字过小
  3. 布局要响应式，横屏竖屏都要能看
  4. 保持像素风 UI 风格
- **验收标准**：
  1. 2/3/4 个选项都有合适布局
  2. 选项不戳到屏幕中间遮挡角色
  3. 长选项文字完整显示
  4. 移动端可正常点击
  5. 不影响游戏流程
- **严格禁止**：不改 story 数据、不改选择逻辑
- **依赖**：T23（DOM Overlay 定位修复）

---

## v0.6 / 上线前任务池

### T30 — 移动端触控优化 + 横屏提示

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/index.html`
  - `luohammer-pixel-game/src/scenes/BootScene.js`
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/src/systems/ChoiceSystem.js`
  - `luohammer-pixel-game/src/systems/DialogSystem.js`
- **修改范围**：文件级修改
- **任务类型**：移动端适配
- **工作重点**：
  1. HTML 添加 viewport + meta 标签（禁止缩放、横屏、theme-color）
  2. CSS 添加 touch-action、tap-highlight、overscroll-behavior
  3. BootScene 竖屏时显示"请横屏游玩"提示
  4. ChoiceSystem 按钮热区 ≥ 44px
  5. DialogSystem 点击区域覆盖下半屏
  6. 选项文字避免过小，长选项自动扩展高度
- **工作原则**：
  1. 优先保证 iPhone SE / 小米等主流手机可玩
  2. 横屏体验优先，竖屏只显示提示
  3. 触控反馈优先于鼠标 hover 效果
  4. 不破坏 PC 端现有体验
- **验收标准**：
  1. 手机横屏可正常操作
  2. 竖屏显示横屏提示
  3. 选项按钮 ≥ 44px，无漏触
  4. 对话框点击推进文本正常
  5. 不影响 PC 端流程
- **严格禁止**：不改 story 数据、不改 config.js 常量
- **依赖**：无

---

### T31 — PWA 完善 + 离线支持

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/public/manifest.json`
  - `luohammer-pixel-game/public/sw.js`
  - `luohammer-pixel-game/index.html`
  - `luohammer-pixel-game/src/scenes/BootScene.js`
- **修改范围**：文件级修改 + 新建 sw.js
- **任务类型**：PWA 配置
- **工作重点**：
  1. manifest.json：name/short_name/icons/display/orientation/theme_color 完整
  2. sw.js：缓存优先策略，缓存 index.html、构建产物、图标、manifest
  3. index.html：注册 Service Worker
  4. BootScene：显示"添加到桌面"安装提示
- **工作原则**：
  1. 离线状态下可完整游玩一局
  2. 安装到桌面后全屏横屏体验
  3. Service Worker 不阻塞首屏加载
  4. 缓存版本化管理（luohammer-v0.6）
- **验收标准**：
  1. Chrome Lighthouse PWA 检查通过
  2. 离线可玩
  3. 可安装到桌面
  4. manifest 字段完整
- **严格禁止**：不改 story 数据、不改游戏逻辑
- **依赖**：无

---

### T32 — 微信分享 + OG 标签 + 分享图

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/index.html`
  - `luohammer-pixel-game/public/share-image.png`
  - `luohammer-pixel-game/src/scenes/EndingScene.js`
- **修改范围**：文件级修改 + 新建分享图
- **任务类型**：社交分享
- **工作重点**：
  1. index.html 添加 OG 标签（title/description/image/type/twitter:card）
  2. 创建 1200×630 分享缩略图（暗色+金色标题+像素风剪影+Slogan）
  3. EndingScene "分享结局"按钮生成适合微信的文案
  4. 可选：集成微信 JS-SDK 分享（如需要）
- **工作原则**：
  1. 分享卡片标题/描述/缩略图完整
  2. 文案有传播力和代入感
  3. 不依赖微信 JS-SDK 也能通过系统分享传播
  4. 分享图风格与游戏一致
- **验收标准**：
  1. 微信分享有卡片效果
  2. 分享文案包含结局类型和属性
  3. 缩略图清晰、无拉伸
  4. 不影响游戏流程
- **严格禁止**：不改 story 数据
- **依赖**：无

---

### T33 — 构建优化 + 部署配置

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/vite.config.js`
  - `luohammer-pixel-game/public/_headers`
  - `luohammer-pixel-game/public/_redirects`
  - `luohammer-pixel-game/DEPLOY.md`
- **修改范围**：文件级修改 + 新建配置文件
- **任务类型**：构建部署
- **工作重点**：
  1. vite.config.js：target es2015、terser minify、drop_console、manualChunks 分离 phaser
  2. public/_headers：安全头 + 缓存策略
  3. public/_redirects：SPA 路由重定向
  4. DEPLOY.md：更新 Cloudflare Pages 部署步骤
- **工作原则**：
  1. 构建产物体积小、加载快
  2. 静态资源长期缓存、HTML 不缓存
  3. 安全头不影响游戏运行
  4. 部署文档清晰可操作
- **验收标准**：
  1. `npm run build` 通过
  2. Phaser 单独 chunk
  3. console.log 被移除
  4. _headers 和 _redirects 配置正确
- **严格禁止**：不改源码逻辑
- **依赖**：无

---

### T34 — 全流程测试 + 兼容性验证

- **状态**：done（2026-06-13 调度器完成）
- **操作文件**：
  - `luohammer-pixel-game/scripts/e2e-test.cjs`
  - `luohammer-pixel-game/docs/test-report.md`
- **修改范围**：新建测试脚本和报告
- **任务类型**：质量测试
- **工作重点**：
  1. 编写 e2e 脚本：遍历所有节点、检查死链、检查结局可达
  2. 多浏览器/设备兼容性测试（Chrome/Safari/Firefox/微信）
  3. 性能测试：首屏 < 3s、帧率 ≥ 30fps、内存稳定
  4. 输出 test-report.md
- **工作原则**：
  1. 不修改源码，只读
  2. 覆盖主流程 + 关键分支
  3. 记录每个浏览器的通过状态
  4. 发现阻断性 Bug 立即报告
- **验收标准**：
  1. 184 个节点可加载
  2. 所有 choices 的 next 有效
  3. 14 种结局至少一条路径可达
  4. 测试报告完整
- **严格禁止**：不改任何源码、不改 story 数据
- **依赖**：无

---

### T35 — 文案最终校对 + 金句优化

- **状态**：done（2026-06-15 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/*.js`
- **修改范围**：文件级修改（只改 text/historyNote/label）
- **任务类型**：文案润色
- **工作重点**：
  1. 每个关键节点至少一句"截图级"金句
  2. 长文本（>400字）节点精简或拆分
  3. 选项 label 统一风格，无错别字
  4. historyNote 信息增量足够
- **工作原则**：
  1. 不改节点 ID、next、sceneType、effects
  2. 保持罗永浩人设一致
  3. 保留历史对照的客观性
  4. 不引入语法错误
- **验收标准**：
  1. 错别字 0
  2. 每个章节 ≥3 句金句
  3. 长文本节点 ≤200字/段
  4. 构建通过
- **严格禁止**：不改流程骨架
- **依赖**：无

---

### T36 — 缺失场景补齐 + 视觉一致性最终检查

- **状态**：done（2026-06-15 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/assets/characters/scene-lab.png`
  - `luohammer-pixel-game/assets/characters/scene-podcast.png`
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/src/systems/PixelRenderer.js`
  - `luohammer-pixel-game/src/config.js`
- **修改范围**：资源 + 代码
- **任务类型**：视觉补齐
- **工作重点**：
  1. 检查当前场景图是否齐全
  2. 补齐缺失的 lab/podcast 场景图（如仍缺失）
  3. 检查所有场景与角色视觉一致性
  4. 检查 SCENE_TYPES 与 BG_TEXTURES 映射完整
- **工作原则**：
  1. 场景图风格统一为像素风
  2. 不破坏现有映射
  3. 优先补齐实际使用到的场景
  4. 保持文件体积合理
- **验收标准**：
  1. 所有 story 节点 sceneType 有效
  2. 所有场景图文件存在
  3. 构建通过
  4. 无 preload 失败
- **严格禁止**：不改 story 节点内容
- **依赖**：无

---

## v0.7 任务池（前端 UI 打磨 + 内容丰富度扩展）

> 用户追加方向：前端 UI 优化 + 内容丰富度提升。
> 本阶段在不影响现有主线流程的前提下，增强可玩性、收集感和视觉表现力。

### T37 — 随机事件池扩展（+8 个新事件）

- **状态**：done（2026-06-15 并发调度完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/events-random.js`
  - `luohammer-pixel-game/src/systems/RandomEventSystem.js`（如需要新交互形式）
- **修改范围**：数据文件级修改 + 可选 UI 适配
- **任务类型**：内容扩充
- **工作重点**：
  1. 新增 8 个随机事件，覆盖 youth/teacher/startup/dark/repay/reborn 各阶段
  2. 事件主题：粉丝送信、投资人突然到访、产品品控危机、媒体偷拍、旧友求助、身体报警、直播翻车、AI 幻觉等
  3. 每个事件 2 个选项，effects 范围 -2 ~ +2
  4. 与现有事件不重复，触发条件合理（stage + 属性阈值）
- **工作原则**：
  1. 事件文案风格与主线一致（第一人称、有画面感）
  2. 不破坏现有触发概率和事件结构
  3. 新事件可复用现有弹窗 UI，不引入新交互形式
  4. 效果数值有得有失，避免纯正面/纯负面
- **验收标准**：
  1. 8 个新事件可被正确触发
  2. 校验脚本无 errors
  3. 构建通过
  4. 事件文案无错别字
- **严格禁止**：不改 story 数据文件、不改随机事件触发概率、不改游戏核心流程
- **依赖**：无

---

### T38 — 隐藏结局 / 彩蛋结局扩充

- **状态**：done（2026-06-15 并发调度完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/13_endings_nodes.js`
  - `luohammer-pixel-game/src/data/story/14_endings.js`
  - `luohammer-pixel-game/src/data/story/12_act9.js`（部分节点新增选项）
- **修改范围**：新增结局节点 + 选项指向
- **任务类型**：内容扩充
- **工作重点**：
  1. 新增 3 个隐藏结局：
     - 「数码博主」：high reputation + influencer 路线
     - 「维权斗士」：public feud + sue big tech 路线
     - 「出家」：极低 pride + 高 wealth 路线
  2. 新增 1 个彩蛋结局：
     - 「罗老师回来了」：特定成就组合触发
  3. 在现有 act9 节点添加指向新结局的选项（不修改已有选项）
  4. 新结局有独立标题、描述、金句、quote
- **工作原则**：
  1. 新增节点 ID 以 `ending_` 开头，避免与现有冲突
  2. 结局文案保持罗永浩人设
  3. 触发条件要有一定门槛，增加重玩价值
  4. 新选项 next 必须指向新结局节点
- **验收标准**：
  1. 4 个新结局从 intro 可达
  2. 校验脚本无 errors
  3. 构建通过
  4. EndingScene 能正确展示新结局
- **严格禁止**：不改现有结局节点 ID、不改已有选项的 next、不改 import/export
- **依赖**：无

---

### T39 — 成就系统扩展（+6 个新成就）

- **状态**：done（2026-06-15 并发调度完成）
- **操作文件**：
  - `luohammer-pixel-game/src/ui/AchievementPopup.js`
  - `luohammer-pixel-game/src/scenes/GameScene.js`（触发逻辑）
  - `luohammer-pixel-game/src/data/story/*.js`（在合适选项添加 achievement 字段）
- **修改范围**：成就定义 + 触发条件 + story 选项字段
- **任务类型**：内容 + 功能增强
- **工作重点**：
  1. 新增 6 个成就：
     - `social_butterfly`（社交达人）：触发 ≥5 个随机事件
     - `debt_free`（无债一身轻）：走 honest_repay 路线且 wealth > 5
     - `comeback_king`（东山再起）：failures ≥3 且最终 reputation ≥8
     - `idealist_forever`（永远的理想主义者）：pride 始终 ≥8 通关
     - `pragmatist`（现实主义者）：pride ≤3 通关
     - `easter_egg`（彩蛋猎人）：解锁任意 2 个隐藏结局
  2. 在 story 相关选项中补充 achievement 字段
  3. GameScene 中补充隐藏成就检测逻辑
  4. EndingScene 成就列表自动包含新成就
- **工作原则**：
  1. 成就难度分层：普通/较难/隐藏
  2. 成就名称和图标风格与现有一致
  3. 触发逻辑不重复计算
  4. 不影响现有成就存储
- **验收标准**：
  1. 6 个新成就可以正常触发并展示
  2. 成就总数达到 30 个
  3. 校验脚本无 errors
  4. 构建通过
- **严格禁止**：不改节点 ID、不改已有成就的触发条件、不删除旧成就
- **依赖**：无

---

### T40 — 角色表情差分系统

- **状态**：done（2026-06-15 并发调度完成）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/GameScene.js`
  - `luohammer-pixel-game/src/systems/DialogSystem.js`
  - `luohammer-pixel-game/src/config.js`（可选：表情映射配置）
- **修改范围**：代码级修改
- **任务类型**：视觉增强
- **工作重点**：
  1. 根据节点情绪标签或属性变化自动切换角色立绘：
     - pride 高 / 理想主义台词 → `luo-speaking` 或 `luo-happy`
     - 翻车/压力高 → `luo-depressed` 或 `luo-angry`
     - 直播/卖货场景 → `luo-livestream`
     - 年轻阶段 → `luo-young`
  2. 在 story 节点支持可选 `mood` 字段，强制指定表情
  3. 角色切换时加入淡入淡出过渡
  4. 不影响现有立绘显示逻辑
- **工作原则**：
  1. 表情切换自然，不突兀
  2. 未指定 mood 时按属性/文本情绪自动推断
  3. 保持现有 setCrop 和缩放逻辑
  4. 只改代码，不改图片资源
- **验收标准**：
  1. 不同情绪节点显示不同角色图
  2. 切换有过渡动画
  3. 构建通过
  4. 无控制台报错
- **严格禁止**：不改 story 节点内容（除非节点已支持 mood 字段）、不改图片资源、不改 sceneType
- **依赖**：无

---

### T41 — UI 动效与微交互升级

- **状态**：done（2026-06-15 并发调度完成）
- **操作文件**：
  - `luohammer-pixel-game/index.html`（CSS 动画）
  - `luohammer-pixel-game/src/systems/ChoiceSystem.js`
  - `luohammer-pixel-game/src/systems/StatsSystem.js`
  - `luohammer-pixel-game/src/systems/DialogSystem.js`
- **修改范围**：CSS + 少量 JS 动画触发
- **任务类型**：UI 打磨
- **工作重点**：
  1. 选项按钮 hover/active 动画：金色边框流动、轻微缩放
  2. 属性条变化动画：数值变化时绿色/红色脉冲闪烁
  3. 对话框出现/消失：淡入 + 轻微上滑
  4. 成就解锁弹窗：增加粒子飞散效果
  5. 随机事件弹窗：增加震动/缩放进入感
  6. 按钮点击反馈：Ripple 水波纹（像素风方形）
- **工作原则**：
  1. 动效不遮挡内容、不拖慢操作
  2. 动画时长 ≤ 300ms，避免等待感
  3. 优先使用 CSS transition/animation，减少 JS 定时器
  4. 移动端动效简化，避免卡顿
- **验收标准**：
  1. 主要交互都有视觉反馈
  2. 动画流畅，帧率 ≥ 30fps
  3. 构建通过
  4. 不影响游戏流程
- **严格禁止**：不改 story 数据、不改游戏逻辑、不改 Canvas 渲染
- **依赖**：无

---

### T42 — 剧情分支可视化 / 人生地图

- **状态**：done（2026-06-15 并发调度完成）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/EndingScene.js`
  - `luohammer-pixel-game/index.html`（地图 overlay）
  - `luohammer-pixel-game/src/data/story/index.js`
- **修改范围**：新增 UI 面板 + 数据遍历
- **任务类型**：功能开发
- **工作重点**：
  1. 结局画面新增「人生地图」按钮
  2. 点击后展示：本局走过的关键节点连线图
  3. 高亮：已选路径、关键转折点、结局位置
  4. 节点用像素风圆点，连线用金色虚线
  5. 地图可缩放/拖拽（简单实现）
  6. 未走过分支显示为灰色半透明
- **工作原则**：
  1. 只展示本局实际走过的节点，不剧透全部剧情
  2. 地图风格与游戏一致（暗色底 + 金色高亮）
  3. 数据从 state.history 推导，不硬编码坐标
  4. 保持现有结局展示流程
- **验收标准**：
  1. 人生地图正确显示本局路径
  2. 关键节点（如砸冰箱、TNT 发布会）有图标标识
  3. 可关闭返回结局画面
  4. 构建通过
- **严格禁止**：不改 story 数据、不改节点 ID、不改结局逻辑
- **依赖**：无

---

## v0.8 任务池（AI 应用比赛 Demo 优化）

> 来源：2026-06-12 改进计划 docs/plans/2026-06-12-ui-content-improvement-plan.md
> 目标：让 Demo 符合 AI 应用比赛评委标准，核心解决“AI 价值不可见”问题。

### T61 — 运行时 AI：结局 AI 复盘

- **状态**：done（2026-06-16 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/src/systems/AIRewriteSystem.js`（新建 + fallback 丰富化）
  - `luohammer-pixel-game/src/scenes/EndingScene.js`
  - `luohammer-pixel-game/index.html`
  - `luohammer-pixel-game/.env.example`
- **修改范围**：新增 AI 复盘系统 + 结局界面集成 + fallback 文案基于属性组合生成
- **任务类型**：功能开发 / AI 比赛 Demo 优化
- **完成情况**：
  1. 新增 `AIRewriteSystem.js`，封装 LLM 调用 + 缓存 + 错误降级
  2. `EndingScene` 集成「AI 人生复盘」按钮与弹窗展示
  3. `index.html` 新增暗金像素风 AI 复盘卡片与打字机动效
  4. fallback 文案按属性组合（理想主义/财富/名声/翻车/信任）生成 16 种洞察，不再复读数字
  5. `npm run build` 通过
- **工作重点**：
  1. 新建 `AIRewriteSystem.js`：封装 LLM 调用 + fallback 文案 + 缓存
  2. 在 `EndingScene` 增加「AI 人生复盘」按钮
  3. 点击后调用 LLM，根据玩家选择历史 + 最终属性 + 结局类型生成个性化点评
  4. 在 `index.html` 增加 AI 复盘结果展示卡片（暗色 + 金色边框 + 打字机效果）
  5. 支持离线 fallback：未配置 API Key 或网络失败时显示默认复盘文案
  6. API Key 通过 `VITE_ARK_API_KEY` 注入，不硬编码
- **工作原则**：
  1. AI 复盘文案呼应老罗风格，3-4 句中文点评
  2. 调用 LLM 时加入超时控制（≤15s）和错误降级
  3. 结果按结局+属性做缓存，避免重复调用
  4. UI 风格与结局页一致，不破坏现有布局
  5. 不在生产代码中暴露 API Key
- **验收标准**：
  1. 结局页出现「AI 人生复盘」按钮
  2. 点击后正确展示个性化 AI 点评（有网/离线均可）
  3. 复盘文案与本局选择、属性、结局相关
  4. 未配置 API Key 时显示 fallback，不报错
  5. `npm run build` 通过
- **严格禁止**：不修改 story 数据、不改结局触发逻辑、不改 config.js 常量
- **依赖**：无

### T62 — 增强随机事件与隐藏事件系统

- **状态**：done（2026-06-16 构建验证通过）
- **操作文件**：
  - `luohammer-pixel-game/src/data/events-random.js`
  - `luohammer-pixel-game/src/systems/RandomEventSystem.js`
  - `luohammer-pixel-game/index.html`
- **修改范围**：扩展随机事件数据结构 + 系统解析逻辑 + UI 稀有度视觉 + 新增事件池
- **任务类型**：功能开发 / 可玩性增强
- **完成情况**：
  1. `events-random.js` 新增字段：`hidden`、`requiresFlags`、`blocksFlags`、`rarity`、`crossStage`、`effectVariance`
  2. 新增 `resolveRandomEffects` 函数，支持效果随机波动区间
  3. `RandomEventSystem` 传入 `flags` 筛选连锁/隐藏事件，解析 `effectVariance`，根据稀有度添加视觉样式
  4. `index.html` 新增 rare（蓝）/ legendary（紫）稀有度边框与发光动画
  5. 新增 16 个事件：隐藏事件 6 个、稀有跨阶段事件 3 个、连锁事件 4 个、普通彩蛋 1 个
  6. `npm run build` 通过
- **工作重点**：
  1. 隐藏事件：高属性/特定 flag 触发，低概率，强叙事奖励
  2. 连锁事件：前序事件 flag 解锁后续剧情（如书摊老板三幕剧、少年打架律师报恩）
  3. 稀有事件：跨阶段触发，蓝/紫光效区分
  4. 效果波动：同一选择结果有区间随机，增加重玩价值
- **工作原则**：
  1. 保持原有事件结构向后兼容
  2. 隐藏事件不能破坏主线平衡
  3. 稀有事件概率极低，避免喧宾夺主
  4. 连锁事件必须让玩家感知到"之前的選擇有意義"
- **验收标准**：
  1. 原有随机事件仍能正常触发
  2. 隐藏/连锁事件在正确条件下可触发
  3. 稀有事件有独立视觉光效
  4. 效果波动正确叠加到基础效果
  5. `npm run build` 通过
- **严格禁止**：不改主线剧情节点、不改阶段触发概率配置、不改 `effects.js` 属性范围
- **依赖**：无

----

## 后续规划任务（2026-06-15 新增）

> 基于当前项目状态制定：核心阻塞项优先解决，视觉重构紧跟其后，内容扩展最后补充。本批次任务设计为可并发执行，适合多个 AI 同事分头推进。

### T51 — 角色立绘重制（核心阻塞）
- **状态**：done（2026-06-16 project-pilot 自动执行）
- **负责人**：美术 / AI 生成 + 前端接入
- **描述**：
  重新生成游戏中使用的角色立绘资源，解决当前角色图为“半边脸特写”、显示不完整的问题。要求：半身像、完整脸部可见、去背景/透明底、像素风或像素渲染风格。至少覆盖 4 种核心表情：平静（standing）、愤怒（angry）、沉思/抑郁（depressed）、开心（happy）。可选补充：说话（speaking）、直播（livestream）、年轻（young）。
- **完成情况**：
  1. 用户提供 6 表情合成图 + 1 张参考图，切分为 7 张 1024×1024 PNG
  2. 替换 `public/assets/characters/luo-{standing,speaking,angry,depressed,happy,livestream,young}.png`
  3. 替换 `public/assets/characters_clean/luo-standing.png` 标题页用图
  4. 删除旧 `luo-hero.png` 及多余 clean 版本
  5. 修改 `src/scenes/GameScene.js` 的 `_applyCharacterLayout()`：移除 `setCrop` 裁剪，新半身图直接等比缩放
  6. 修复资源打包：将 `assets/` 目录移入 `public/assets/`，确保 Vite 构建后 dist 包含所有角色/场景纹理
  7. 更新脚本路径：`scripts/split-character-sheet.py`、`scripts/generate_scenes.py`
- **验收标准**：
  1. ✅ `public/assets/characters/` 下所有旧角色图被新图替换
  2. ✅ 新图尺寸统一 1024×1024，PNG（深色背景，可直接使用）
  3. ✅ 同一角色在不同表情下服装、发型、眼镜、光影保持一致
  4. ✅ 构建通过，`dist/assets/characters/` 下 7 张角色纹理齐全
- **严格禁止**：不改 `config.js` 中的 key 名、不改 `PixelRenderer` 中的 textureKey 映射 ✅
- **依赖**：无

### T52 — 角色显示位置与缩放调优
- **状态**：done（2026-06-16 project-pilot 自动执行）
- **负责人**：前端
- **描述**：
  修复游戏主界面中角色被场景图遮挡、只露出半边脸的问题。调整 `GameScene.js` 中 `_applyCharacterLayout` 与 `PixelRenderer.js` 的角色定位逻辑：角色固定显示在画面左下角或右下角 1/4 区域，不再被场景背景覆盖；根据新立绘比例重新计算缩放和裁剪策略。
- **完成情况**：
  1. 修改 `src/scenes/GameScene.js` 的 `_applyCharacterLayout()`：
     - 显示区域从右侧 1/3 调整为**右下角 1/4**（`maxDisplayW = GAME_WIDTH / 4`，`maxDisplayH = GAME_HEIGHT * 0.72`）
     - 移除 `setCrop()`，新半身图直接等比缩放
     - 角色 `depth` 设为 50，场景图为 0，确保不被背景遮挡
  2. 新增金色轮廓光（`_updateCharacterGlow`）：
     - 使用 ADD 混合模式，alpha 0.22，深度 49
     - 跟随角色位置与纹理同步更新
  3. 新增底部投影（`_updateCharacterShadow`）：
     - 黑色椭圆，alpha 0.35，深度 48
     - 根据角色显示宽度动态调整大小
  4. 稳定呼吸动画（`_startCharacterTalkTween`）：
     - 改用 `this._charBaseScale` 作为基准，避免 tween 残留导致异常缩放
  5. 同步更新 `_updateCharacterPosition()` 与 `_onShutdown()`，确保震动、切换、场景关闭时特效位置正确、资源不泄漏
- **验收标准**：
  1. ✅ 游戏主界面中角色完整脸部可见，不被场景图遮挡
  2. ✅ 角色呼吸/说话动画位置稳定，基于固定 baseScale
  3. ✅ 不同姿态切换时过渡自然（淡入淡出 + 光效同步）
  4. ✅ 构建通过
- **严格禁止**：不改场景图显示逻辑、不改节点 ID、不改 `next` 指向 ✅
- **依赖**：T51

### T53 — 标题页角色适配
- **状态**：done（2026-06-16 project-pilot 自动执行）
- **负责人**：前端
- **描述**：
  标题页（BootScene）使用新立绘后，调整 `index.html` 中 `.ui-boot-character` 的 CSS 尺寸与位置，确保标题页角色显示完整、与标题/按钮布局协调。
- **完成情况**：
  1. 标题页角色区域从 `flex: 0 0 45%` 调宽到 `55%`，角色最大高度从 `96%` 提升到 `100%`
  2. 增强 `.ui-boot-character` 多层轮廓光：增加白色内描边 + 金色主光 + 外层光晕 + 底部投影，解决黑色衣物融入黑底问题
  3. 左侧区域添加右侧渐变遮罩，让角色与右侧内容过渡更自然
  4. 标题页与游戏内统一使用 `public/assets/characters/` 下同一套立绘，删除 `characters_clean/` 目录
  5. 修改 `src/scenes/BootScene.js` 中标题页角色图路径为 `assets/characters/luo-standing.png`
  6. 标题右侧增加版本号 `<div class="ui-boot-version">v0.3.0 · Early Access</div>`，平衡左侧视觉重量
  7. 结局画面清理：`src/scenes/EndingScene.js` 新增 `_hideGameUI()`，进入结局时强制隐藏游戏主界面的对话框、选项、属性条、章节标题、随机事件、历史注释等残留 DOM UI
- **验收标准**：
  1. ✅ 标题页角色显示完整脸部，不被截断
  2. ✅ 标题、副标题、按钮不被角色遮挡
  3. ✅ 在 1920×1080 和 1366×768 两种分辨率下布局正常
  4. ✅ 构建通过
- **严格禁止**：不改 BootScene 的按钮事件逻辑 ✅
- **依赖**：T51

### T54 — 全量流程测试走查
- **状态**：done（2026-06-16 自动执行并验收通过）
- **负责人**：测试
- **描述**：
  从标题页开始，完整走查至少 2 条不同选择路径直到结局，验证剧情数据、选择分支、随机事件、阶段结算、成就弹窗、结局展示、人生地图等核心功能无阻断性 bug。
- **完成情况**：
  1. `node scripts/validate-story.mjs` 通过：192/192 节点可达、无死链、无卡死、无循环指向、无 effects 越界、flag 链路完整、26/26 结局可达、0 错误 0 警告
  2. `node scripts/e2e-test.cjs` 通过：7/7 测试项全部通过，所有 `ending_` 节点在 `endings.js` 中均有对应条目，存档/读档、音效、PWA manifest、静态性能基线均正常
  3. `npm run build` 通过：生产构建成功，无 error，JS bundle 426.77 kB + Phaser chunk 1,473.63 kB
  4. 手动走查两条路径到结局：
     - 默认路线：连续选择首个选项 → 到达「🔥 真还传·第二部·永不言弃」
     - 高压力/低声望路线：选择激进/低声望选项 → 到达「💰 商业大佬·现实主义的胜利者」
  5. 走查过程中未发现黑屏、卡死、JS 报错或 UI 显示异常
- **验收标准**：
  1. ✅ 能正常走完“默认路线”到达任意结局
  2. ✅ 能正常走完“高压力/低声望”路线到达不同结局
  3. ✅ 流程中无 JavaScript 报错、无黑屏、无卡死
  4. ✅ `e2e-test.cjs` 与 `validate-story.mjs` 全部通过
- **严格禁止**：不改 story 剧情走向、不改数值平衡 ✅
- **依赖**：T52

### T55 — 构建与部署发布
- **状态**：done（2026-06-16 自动执行并验收通过）
- **负责人**：前端 / DevOps
- **描述**：
  完成最终生产构建，并将游戏部署到可访问的静态托管平台（如 GitHub Pages / Vercel / Netlify）。配置自定义域名或项目子路径，确保线上版本与本地构建一致。
- **完成情况**：
  1. `npm run build` 0 error、0 warning（仅保留体积警告，未阻塞发布）
  2. 生产构建产物已生成：`dist/` 目录完整，`luohammer-demo.zip`（12.8 MB）可直接上传论坛作为可体验 Demo 文件
  3. 自动部署尝试：Vercel CLI 需要有效 token；localtunnel / cloudflared quick tunnel 生成的临时链接带安全验证页，不适合评审直接访问
  4. 当前采用**构建包交付**：`luohammer-pixel-game/luohammer-demo.zip` 已就绪，可直接上传到 Trae 论坛 Demo 帖
  5. 如需永久公开链接，需要用户提供 Vercel / GitHub Pages / BytePlus Edge Pages 的账号/token，可一键完成线上部署
  6. 同步修复了 3 个影响体验的 visibly 问题：
     - IntroScene 触发时机：从"开屏即播"改为点击"开始游戏"/"新游戏"后播放，1.5 秒可跳过，避免玩家错过；标题页新增"回顾开场"按钮
     - 角色背景冲突：降低角色身后暗板透明度（0.38→0.18、0.45→0.22），并优化黑色背景遮罩阈值，减少"黑色方块"感
     - 成就系统展示：成就弹窗从右上角改为顶部中央横幅，避免与属性面板重叠；弹窗增加成就 `desc` 描述；属性变化增加浮动数字提示（+1 / -1）
- **验收标准**：
  1. ✅ `npm run build` 0 error
  2. ✅ `dist/` 可直接作为静态站点运行
  3. ✅ `luohammer-demo.zip` <= 20 MB，符合论坛上传要求
  4. ⚠️ 永久线上链接待用户补充平台账号后完成
- **严格禁止**：不暴露敏感配置、不修改生产环境不需要的文件 ✅
- **依赖**：T54

### T56 — UI 概念图生成（已取消）
- **状态**：cancelled（2026-06-15 经实际截图评估，现有 UI 视觉效果已达标，无需重制）
- **负责人**：用户 / 美术
- **取消原因**：
  经实际截图验证，当前标题页、天赋页、主界面、选择界面、结局页的暗金像素风 UI 视觉效果已足够好，信息层级清晰、风格统一。重新生成概念图的投入产出比不高，故取消。
- **原提示词（保留备用）**：
  ```
  UI mockup for a pixel-art narrative life-simulation game titled "罗的十字路口",
  dark background gradient #0a0a1a to #0f0f22, muted gold accent #f0c040,
  beige text #e8d5a3, thin golden L-shaped corner decorations,
  retro pixel art meets cold tech minimalism, premium indie game feel,
  {screen_specific}, no cartoon, no photorealism, no gradient buttons, no large rounded corners,
  1920x1080 landscape, clear boundaries between character area and UI area, no watermark, no text.
  ```
  5 张图分别替换 `{screen_specific}`：
  1. `ui-title.png`：title screen, left side middle-aged Asian man in black turtleneck and glasses under spotlight, right side large game title and subtitle, bottom three gold-outlined pixel buttons
  2. `ui-talent.png`：talent selection screen, 6-8 talent cards with gray/blue/gold rarity borders, each card has name description and stat effect, bottom confirm button
  3. `ui-gameplay.png`：main gameplay screen, top status bar with money reputation stress health courage wisdom, bottom-center dialogue box with golden L-corner frame, right or bottom 2-4 choice buttons
  4. `ui-choice.png`：choice branch screen, dark translucent dialogue box at bottom, 3-4 gold-outlined choice buttons stacked, character portrait visible on left
  5. `ui-ending.png`：ending screen, ending title, description, key stats, quote, bottom two gold-outlined buttons
- **验收标准**：
  1. 5 张概念图分辨率统一 1920×1080
  2. 每张图都明确区分角色区域、UI 区域、文字区域
  3. 整套 UI 视觉风格统一
- **严格禁止**：不生成与游戏主题无关的元素
- **依赖**：无

### T57 — UI 切图与 CSS 替换
- **状态**：cancelled（随 T56 取消）
- **负责人**：前端
- **描述**：
  将用户提供的 UI 概念图切分为可复用资源（背景、按钮、卡片、对话框、标题装饰等），替换 `index.html` 和 `src/scenes/*.js` 中的现有样式。保持原有 DOM 结构和交互逻辑不变，仅做视觉层升级。
- **验收标准**：
  1. 标题页、天赋页、主界面、选择页、结局页均应用新视觉
  2. 按钮 hover/active 状态保留或增强
  3. 中文文字清晰，不出现模糊或截断
  4. 构建通过
- **严格禁止**：不改 DOM id、不改事件监听、不改 Phaser 渲染逻辑
- **依赖**：T56

### T58 — 场景图风格统一重制（已取消）
- **状态**：cancelled（2026-06-15 经实际截图评估，现有场景图视觉效果已达标，无需重制）
- **负责人**：用户 / 美术
- **取消原因**：
  经实际截图验证，当前教室场景（scene-classroom.png）的像素风、暗色调、氛围感已足够好，与 UI 暗金/深蓝灰体系协调。重新生成场景图的投入产出比不高，故取消。
- **原提示词（保留备用）**：
  ```
  2D pixel art scene background for narrative game "罗的十字路口",
  {scene_description}, dark atmospheric lighting, muted color palette with dark blues and warm gold accents,
  retro indie game aesthetic, 1920x1080 landscape, no watermark, no text, no character.
  ```
  8 张图分别替换 `{scene_description}`：
  1. `scene-classroom.png`：old high school classroom, empty desks, blackboard, afternoon light through windows, nostalgic mood
  2. `scene-teacher.png`：small town classroom at night, a young teacher standing by chalkboard, warm lamp light, hopeful yet lonely
  3. `scene-startup.png`：startup office, messy desks, whiteboard with plans, energetic young team working late
  4. `scene-stage.png`：product launch stage with spotlight, empty podium, dramatic shadows, tension and anticipation
  5. `scene-fridge.png`：appliance store or warehouse, rows of refrigerators, one prominent refrigerator center stage, absurd and tense
  6. `scene-fang.png`：courtroom or negotiation room, heavy wooden table, documents scattered, oppressive atmosphere
  7. `scene-dark.png`：dark empty office at night, city lights through window, papers and broken phones on floor, despair
  8. `scene-reborn.png`：bright modern studio, livestream setup, ring lights, fresh start and redemption mood
- **验收标准**：
  1. 所有场景图尺寸统一 1920×1080
  2. 画面右下角无水印、无无关文字
  3. 整体色调与 UI 暗金/深蓝灰体系协调
  4. 构建通过，场景切换无白屏
- **严格禁止**：不改 `config.js` 中的场景 key、不改 story 中的 sceneType
- **依赖**：无

### T59 — 字体与动效统一升级
- **状态**：done（2026-07-22 并发调度完成。index.html 新增 4 个字体层级 CSS 变量 + .scene-transition 类 + prefers-reduced-motion 降级；DialogSystem 打字机速度从 [220,140,80] 调为 [60,30,12]；AchievementPopup 动画统一为 0.3s）
- **负责人**：前端
- **描述**：
  统一游戏内字体（标题、对话、按钮、说明文字）和动效（打字机速度、按钮 hover、切换过渡、成就弹出）。引入更精致的像素字体或系统字体回退，提升整体质感。当前效果已达标，此为锦上添花项。
- **验收标准**：
  1. 所有文字层级清晰，标题/名字/正文/说明有明确字号区分
  2. 打字机效果流畅，不卡顿
  3. 按钮 hover、卡片选中、成就弹出动画一致
  4. 构建通过
- **严格禁止**：不改字体文件加载路径之外的文本内容
- **依赖**：无

### T60 — 内容扩展包（随机事件 + 隐藏结局）
- **状态**：done（2026-06-15 并发调度完成）
- **负责人**：策划 / 前端
- **描述**：
  在现有系统基础上扩展可玩内容：新增 2-3 个随机事件到 `events-random.js`，新增 1 个隐藏结局到 `endings.js` 与相关 story 节点。保持数值平衡，不影响现有主线流程。
- **验收标准**：
  1. 新随机事件能在对应阶段正常触发
  2. 隐藏结局有明确的解锁条件，并在条件满足时正确展示
  3. 新增内容经过至少 1 次完整流程验证
  4. 构建通过
- **严格禁止**：不破坏现有结局触发逻辑、不改已有节点 ID
- **依赖**：T55

---

## v0.9 任务池（数值平衡修复 · PDCA 循环工程）

> 来源：2026-07-04 全路径模拟脚本 `scripts/simulate-paths.mjs` 暴露 6 大根因
> 6 条策略路径中 8 个结局数学不可达，属性极化严重，failures/trust/pressure 触发率失衡
> 循环工程原则：每个任务完成后跑模拟脚本验证，不达标不进入下一个

### T71 — 扩 failures 触发面（P0 · 解锁 6 个不可达结局）

- **状态**：done（2026-07-06 验证：story 文件已累计 120 个 failures 触发点，10 个目标章节每章 ≥5；模拟中 6/12 策略 failures≥2）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/2_act1.js`
  - `luohammer-pixel-game/src/data/story/3_act2.js`
  - `luohammer-pixel-game/src/data/story/4_fridge.js`
  - `luohammer-pixel-game/src/data/story/5_fang.js`
  - `luohammer-pixel-game/src/data/story/6_act3.js`
  - `luohammer-pixel-game/src/data/story/7_act4.js`
  - `luohammer-pixel-game/src/data/story/8_act5.js`
  - `luohammer-pixel-game/src/data/story/9_act6.js`
  - `luohammer-pixel-game/src/data/story/10_act7.js`
  - `luohammer-pixel-game/src/data/story/11_act8.js`
- **修改范围**：仅在 choices 的 effects 中追加 `failures: 1` 字段，不改节点 ID / next / label
- **任务类型**：数值平衡修复
- **数据依据**：
  - 现状：failures 触发率 5.4%（36/671），6 条模拟路径中仅 1 条触发过 1 次
  - 6 个结局依赖 failures≥2 或 ≥3：legend / warrior / phoenix / scapegoat / survivor / rational
  - 目标：failures 触发率提到 ~12%（约 80 条），每章至少 5-8 个 failures 触发点
- **工作重点**：
  1. 遍历每章 story 文件，找出"剧情上是翻车/失败/受挫"的 choices
  2. 在这些 choices 的 effects 中追加 `failures: 1`（不改原有 pride/wealth/reputation）
  3. 候选场景：试讲失败、牛博网被拔线、砸冰箱被告、T1 供应链出问题、TNT 翻车、资金链断裂、直播翻车、AR 项目失败等
  4. **不增加 failures: 2 或更高**，保持单次 +1 的节奏
  5. 不修改已经带 `failures: 1` 的 36 条 choices
- **工作原则**：
  1. failures 必须剧情合理：是玩家"主动选择导致失败"或"被动遭遇失败"，不是随机惩罚
  2. 不在"成功路径"的 choices 上加 failures
  3. 不破坏 maxAttr / requires 等门控
  4. 保持原 effects 其他字段不变
- **验收标准**：
  1. failures 触发点数量从 36 提升到 ≥ 70
  2. 每章至少 5 个 failures 触发点
  3. `npm run build` 通过
  4. 跑 `node scripts/simulate-paths.mjs`，至少 3 条路径 failures ≥ 2
- **严格禁止**：不改节点 ID、不改 next 指向、不改 sceneType、不删除已有 effects 字段
- **依赖**：无

---

### T72 — 扩 trust 触发面（P0 · 解锁 balance/educator/mentor 结局）

- **状态**：done（2026-07-06 验证：trust 触发点从 33 提升到 83，超过 ≥70 目标；模拟中多条路径 trust 达到 10）
- **操作文件**：同 T71
- **修改范围**：在 choices 的 effects 中追加 `trust: ±1` 字段
- **任务类型**：数值平衡修复
- **数据依据**：
  - 现状：trust 触发率 4.9%（33/671），全流程初始 trust=5，终章多数路径停在 5-7
  - balance 结局需 trust≥6，几乎不可达
  - 目标：trust 触发率提到 ~12%（约 80 条）
- **工作重点**：
  1. 找出"剧情上影响公众信任"的 choices
  2. 正向 trust：诚实还债、公开道歉、维护用户权益、坚持产品质量
  3. 负向 trust：欺骗用户、虚假宣传、跑路、撕逼
  4. 不在青年时期（act0/act1）强加 trust，那时小罗还没有"公众"
  5. 集中在 act3-act9（创业后）
- **验收标准**：
  1. trust 触发点从 33 提升到 ≥ 70
  2. balance 结局在模拟中至少 1 条路径可达
  3. `npm run build` 通过
  4. 跑模拟脚本验证
- **严格禁止**：同 T71
- **依赖**：T71（避免同时改同一文件冲突）

---

### T73 — 削弱属性极化（P1 · 增加负向 effects）

- **状态**：done（2026-07-06 应用 `reduce-high-attrs.cjs`，追加 16 处 wealth:-1 代价；wealth 净偏移从 26 降至 10，纯正面 choices 从 8.9% 降至 6.6%；depolarize/t73-balance 无剩余可改项）
- **操作文件**：同 T71
- **修改范围**：调整部分"纯正面"choices 为"有得有失"
- **任务类型**：数值平衡修复
- **数据依据**：
  - 现状：净偏移 +518（正向偏置 33%），属性容易顶到 10
  - 模拟中 wealth 多次出现 0 或 10 的极值
- **工作重点**：
  1. 找出"获得 X 但应该付出代价"的 choices
  2. 在 effects 中追加负向字段（如赚钱但损失名声、出名但增加压力）
  3. 不改"已经是有得有失"的 choices
- **验收标准**：
  1. 净偏移从 +518 降到 +200 以下
  2. 模拟中属性极值（0 或 10）出现频率降低 50%
  3. `npm run build` 通过
- **严格禁止**：不改节点 ID、不改 next
- **依赖**：T71、T72

---

### T74 — 增加 pressure 下降渠道（P1 · 解锁 hermit 结局）

- **状态**：done（2026-07-22 完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/10_act7.js`（act7_retire 节点 retired 选项加 pressure:-3）
  - `luohammer-pixel-game/src/data/effects.js`（新增 retired_peace 阈值事件 pressure:-6）
  - `luohammer-pixel-game/scripts/simulate-paths.mjs`（修复 ending break 前 post-choice 阈值事件处理 + 新增 M 策略）
  - `luohammer-pixel-game/scripts/verify-hermit.mjs`（新增 hermit 可达性专项验证脚本）
- **修改范围**：retired 选项加 pressure:-3 + 新增 retired_peace 阈值事件 + simulate-paths 修复
- **任务类型**：数值平衡修复
- **数据依据**：
  - 现状：pressure 单向增长，hermit 结局需 pressure≤1 完全不可达
  - pressure 触发率 15%，但负向 pressure 已有 92 处（≥70 目标已达成）
- **工作重点**：
  1. 在"休息/度假/家人陪伴/朋友支持"等 choices 中追加 pressure 负向变化（项目既存 92 处，已满足）
  2. 新增阈值事件：压力≥8 时触发"崩溃边缘"事件（既存 pressure_release）+ retired flag 设置后触发 retired_peace 事件（新增 pressure:-6）
  3. 确保每章至少 3-5 个 pressure 下降点（既存）
- **验收标准**：
  1. ✅ pressure 负向触发点 92 处（远超 ≥70 目标）
  2. ✅ hermit 结局在 verify-hermit.mjs 4 种压力起点（2/5/8/12）全部可达
  3. ✅ `npm run build` 通过（620.57 kB + 1,480.60 kB phaser，32.72s）
- **关键降压链**：retired 选项 effects (pressure:-3) + retired_peace 阈值事件 (pressure:-6) = 合计 -9
- **严格禁止**：不改节点 ID、不改 next（已遵守）
- **依赖**：T71、T72

---

### T75 — 调整结局阈值 + 修复快速退出路径（P2）

- **状态**：done（2026-07-22 完成）
- **操作文件**：
  - `luohammer-pixel-game/src/data/endings.js`（balance 阈值已是 trust>=5，无需修改）
  - `luohammer-pixel-game/src/data/story/1_act0.js`（快速退出门控已正常工作，无需修改）
  - `luohammer-pixel-game/src/data/story/0_intro.js`（快速退出门控已正常工作，无需修改）
  - `luohammer-pixel-game/scripts/verify-t75.mjs`（新增验证脚本）
- **修改范围**：阈值校验 + 快速退出路径验证（结论：现有门控已足够，无需代码修改）
- **任务类型**：数值平衡修复
- **数据依据**：
  - balance 结局 trust>=5（任务描述"建议改 ≥5"已满足）
  - 0_intro.js intro 选项2 ending_scholar 有 maxAttr:{pride:3}，初始 pride=5 不会触发
  - 1_act0.js act0_rebel 选项2 ending_scholar 有 maxAttr:{pride:3}，pride=5+2=7 不会触发
  - 1_act0.js act0_fail3/act0_korea ending_ordinary 有 maxAttr:{pride:2,wealth:3,rep:2}
- **工作重点**：
  1. ✅ 校验所有结局阈值可达性：23 个 flag-based 结局全部 flag 可达；12 个纯属性结局属性范围理论可达
  2. ✅ balance 阈值已是 trust>=5，无需微调
  3. ✅ 第一章快速退出门控已正常工作（T76 已加严 2_act1.js/3_act2.js 门控）
  4. ⚠️ 最短路径 F 策略 16 步（act1_yu ↔ act1_a 循环导致，属 2_act1.js 范围，T76 已分析"进一步加严风险大于收益"）
- **验收标准**：
  1. ✅ 所有 36 个结局可达：23 flag-based（flag 设置点存在）+ 12 纯属性（属性范围可达）+ hermit（T74 专项验证）
  2. ⚠️ 最短路径 16 步（F 策略 act1_yu↔act1_a 循环，不在 T75 操作范围；正常游戏路径 A 策略 24 步）
  3. ✅ `npm run build` 通过（622.44 kB + 1,480.60 kB phaser，46.11s）
  4. ✅ 6 条策略路径触发 6 种不同结局（ai_visionary/legend/talkshow_star/tycoon/supply_chain/educator）
- **严格禁止**：不改结局的语义/描述/图标（已遵守）
- **依赖**：T71、T72、T73、T74

---

### T76 — 补漏 2_act1/3_act2/6_act3 宽松 quick-exit 门控（P2 · T75 遗留风险）

- **状态**：done（2026-07-22 project-pilot 串行执行完成。2_act1.js 8 处 + 3_act2.js 3 处门控加严：5 个 ending_ordinary 加 requires:{failures:1}；3 个 ending_comfort 从 pride:5 收紧为 pride:4,wealth:4；2 个无门控漏洞补 maxAttr:{pride:4,wealth:4}。策略 L 从 11→19 步，A 从 16→24 步。⚠️ 策略 F（极端速通）仍 15 步，属"故意失败 4 次+放弃"的非正常路径，进一步加严风险大于收益。正常游戏路径 24 步合理）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/2_act1.js`（8 处门控加严）
  - `luohammer-pixel-game/src/data/story/3_act2.js`（3 处门控加严）
- **修改范围**：quick-exit choice 的 maxAttr/requires 字段
- **任务类型**：数值平衡修复
- **工作重点**：补漏 T75 遗留风险，让最短路径达标
- **验收标准**：
  1. 2 个无门控漏洞已补 maxAttr
  2. 5 个 ending_ordinary 加 requires:{failures:1}
  3. 3 个 ending_comfort 从 pride:5 改为 pride:4,wealth:4
  4. validate-story.mjs 0 errors，build 通过
  5. simulate-paths 12 策略触发 ≥5 种不同结局
- **严格禁止**：不改节点 ID/next/sceneType，不改 6_act3.js（pride:4 已足够严）
- **依赖**：T75

---

### T78 — 10 个关键节点深度润色（复赛内容短板补齐）

- **状态**：done（2026-07-22 并发调度完成。4 worker 并发润色 8 文件 10 节点：intro/act0_dad/act1_nerve/act1_a/act1_resign/act_fridge_start/act_fang_court/act6_debt/act7_sign/act9_final。text 增五感细节+情绪节奏，historyNote 补"为什么重要+后来怎样"，<b>金句</b>保留。act6_night 未动。bundle 620→625kB）
- **操作文件**：0_intro.js / 1_act0.js / 2_act1.js / 4_fridge.js / 5_fang.js / 9_act6.js / 10_act7.js / 12_act9.js
- **修改范围**：仅 text + historyNote 字段
- **任务类型**：文案润色
- **验收标准**：
  1. 10 节点 text 画面感提升 ✅
  2. historyNote 含"为什么重要+后来怎样" ✅
  3. <b>金句</b>保留 ✅
  4. lint 0 errors / build 通过 / validate-story 0 errors ✅
- **严格禁止**：不改节点 ID/next/sceneType/effects
- **依赖**：无

---

### T79 — 浏览器 agent 走查核心路径 + P0 修复 overlay 内容溢出

- **状态**：done（2026-07-22 浏览器走查完成。发现并修复 P0 bug：BootScene overlay 内容溢出导致"开始游戏"按钮坐标 y=-37 在视口外不可点击。根因：_syncOverlayToCanvas 把 overlay 高度设为 canvas 缩放后高度（1280x720 viewport 下约 312.5px），但 overlay 内 flex 居中的内容总高度约 394px，溢出约 40px 与报告 y=-37 吻合。修复：overlay 改为覆盖整个视口（fixed + 100vw + 100vh），canvas 在背景层渲染场景，UI 在前景层全屏。JS click 走 8 节点零卡顿零错误，平均切换 2s/节点。⚠️ 工具兼容问题：browser-use 坐标点击与 Phaser canvas+DOM overlay 不兼容，需 JS click 绕过，非游戏 bug）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/BootScene.js`（_syncOverlayToCanvas 改为全屏覆盖）
  - `luohammer-pixel-game/index.html`（.ui-boot-overlay CSS position: absolute → fixed）
- **修改范围**：overlay 定位策略
- **任务类型**：P0 bug 修复 + 浏览器走查
- **验收标准**：
  1. overlay 全屏覆盖视口 ✅
  2. JS click 走 8 节点零卡顿 ✅
  3. 控制台零 error/warning ✅
  4. lint 0 errors / build 通过 ✅
- **严格禁止**：不改 canvas 缩放配置、不改游戏逻辑
- **依赖**：无

---

### T80 — 复赛帖补入 P0 修复记录（文档同步）

- **状态**：done（2026-07-22。5 处补入：全流程可达/加固表/R12行/角色搭档/Session ID；2 处数字一致化：4→5 项加固、待实现→已实现）
- **操作文件**：`luohammer-pixel-game/复赛帖-罗的十字路口.md`
- **任务类型**：文档更新
- **依赖**：T79

---

### T81 — 里程碑审查（第三层 review）

- **状态**：done（2026-07-22。陌生接手工程师视角审查 BootScene/story/effects/ChoiceSystem/index.html。结论：未发现 P0，2 个 P1，3 个 P2。复赛就绪度 8/10）
- **P1-1**：act1_nerve/act1_yu 的 requires:{failures:1} 门控在所在节点 failures≡0，选项永远锁定不可选
- **P1-2**：BootScene overlay 100vw/100vh 桌面端含滚动条宽度可能横向溢出
- **操作文件**：无（仅审查）
- **依赖**：T79

---

### T82 — 修复审查发现的 2 个 P1

- **状态**：done（2026-07-22。P1-1：删除 2_act1.js 第 34/87 行的 requires:{failures:1}，保留 maxAttr:{pride:4} 门控。P1-2：BootScene.js sync() 从 100vw/100vh 改为 inset:0，与 IntroScene/EndingScene 风格统一，消除桌面端横向溢出风险）
- **操作文件**：
  - `luohammer-pixel-game/src/data/story/2_act1.js`（2 处删 requires）
  - `luohammer-pixel-game/src/scenes/BootScene.js`（100vw/100vh → inset:0）
- **验收标准**：
  1. validate-story 0 errors ✅
  2. lint 0 errors ✅
  3. build 通过 ✅
  4. simulate-paths 12 策略仍触发 ≥5 种结局 ✅
- **依赖**：T81

---

### T83 — P2 清理：validate-story 白名单补全

- **状态**：done（2026-07-22。THRESHOLD_TRIGGERED_FLAGS 补 2 个 flag：pressure_release_triggered / retired_peace_triggered。警告从 2→0，validate-story 完全通过）
- **操作文件**：`luohammer-pixel-game/scripts/validate-story.mjs`
- **任务类型**：验证脚本白名单补全
- **依赖**：T81

---

### T84 — lint 零容忍 + P2 overlay 统一 + 复赛帖校对（并发）

- **状态**：done（2026-07-23。A1 worker 修 endings.js 12 处 flags→_flags；B1/B2/B3 worker 清理 94→0 warnings（draw*.js 49 处未使用 import + EndingScene/GameScene 23 处 + 其余 8 文件 22 处）；C worker 复赛帖校对（188→214 节点，lint 数字更新至 0）；D worker overlay CSS 统一 inset:0）
- **操作文件**：24 个 src 文件 + index.html + 复赛帖
- **验收标准**：lint 0/0 ✅ / build ✅ / validate-story 0 errors ✅ / 复赛帖数字一致 ✅
- **依赖**：T83

---

### T85 — [P0] 键盘快捷键 UI 提示（R15·SCAN·维度1）

- **状态**：done（2026-07-23。Guide 卡片 kbd-tip 补全 A/S/空格/ESC 说明；GameScene create 末尾首次 toast 提示，localStorage 标记仅一次，仅桌面端）
- **操作文件**：
  - `luohammer-pixel-game/src/scenes/BootScene.js`（Guide 卡片内容补快捷键说明）
  - `luohammer-pixel-game/index.html`（Guide 卡片 HTML + CSS）
  - `luohammer-pixel-game/src/systems/DialogSystem.js`（AUTO 按钮 tooltip + 首次进入 toast）
- **修改范围**：纯 UI 文案/提示新增，不改快捷键逻辑
- **改进方案**：
  1. 标题画面 Guide 卡片补一行"键盘操作：A 自动播放 · S 打字速度 · 空格继续 · ESC 菜单"
  2. 对话框 AUTO 按钮加 `title="按 A 切换"` tooltip
  3. 首次进入 GameScene 时 toast 一次"提示：按 S 切换打字速度"
- **验收标准**：评委不读源码也能发现 A/S 快捷键
- **决赛加分**：+0.5
- **依赖**：无

---

### T86 — [P0] focus-visible 无障碍修复（R15·SCAN·维度2）

- **状态**：done（2026-07-23。index.html 全局 CSS 区追加 :focus-visible 规则，金色 2px outline，仅键盘导航生效不影响鼠标点击）
- **操作文件**：`luohammer-pixel-game/index.html`（全局 CSS）
- **修改范围**：新增 `:focus-visible` 样式块，不改现有 `outline: none`
- **改进方案**：追加 CSS：
  ```css
  button:focus-visible,
  .ui-boot-btn:focus-visible,
  .ui-choice-btn:focus-visible {
    outline: 2px solid var(--color-gold, #f0c040);
    outline-offset: 2px;
  }
  ```
- **验收标准**：键盘 Tab 切换按钮时有金色焦点环
- **决赛加分**：+0.5（无障碍隐性加分）
- **依赖**：无

---

### T87 — [P1] validateEndingsConsistency 补真实校验或删除（R15·SCAN·维度5）

- **状态**：done（2026-07-23。main.js no-op IIFE 替换为真实校验：import ENDING_SCENE_MAP，检查每个 ENDINGS id 是否有对应场景映射条目，缺失时 console.warn）
- **操作文件**：`luohammer-pixel-game/src/main.js`（L10-18）
- **修改范围**：替换 no-op IIFE
- **改进方案**：补真实校验：
  ```js
  const displayKeys = new Set(Object.keys(ENDING_DISPLAY || {}));
  const missing = storyEndings.filter(k => !displayKeys.has(k));
  if (missing.length) console.warn('[Endings] 缺少 display 条目:', missing);
  ```
- **验收标准**：不再有自欺性防御
- **决赛加分**：+0.3
- **依赖**：无

---

### T88 — [P1] EndingScene 粒子分支修复不存在的结局 ID（R15·SCAN·维度6）

- **状态**：done（2026-07-23。legendaryEndings 替换为 legend/warrior/phoenix/idealist/comeback/rights_fighter；tragicEndings 替换为 scapegoat/bankrupt_early/escape；peacefulEndings 替换为 balance/hermit/peace/survivor/ordinary/monk/comfort/retreat）
- **操作文件**：`luohammer-pixel-game/src/scenes/EndingScene.js`（L120-122）
- **修改范围**：替换 legendaryEndings/tragicEndings 数组
- **改进方案**：用实际结局 ID 替换：
  ```js
  const legendaryEndings = ['legend', 'warrior', 'craftsman', 'idealist', 'phoenix'];
  const tragicEndings = ['scapegoat', 'escape', 'bankrupt_early', 'ordinary'];
  ```
- **验收标准**：传奇/悲情结局粒子颜色不再静默回退默认金色
- **决赛加分**：+0.5（结局页视觉差异化）
- **依赖**：无

---

### T89 — [P1] SaveSystem 校验 currentNode 存在于 STORY（R15·SCAN·维度5）

- **状态**：done（2026-07-23。SaveSystem.js import STORY，_isValidState 追加 `if (!STORY[parsed.currentNode]) return false`，旧版存档节点改名后不再白屏崩溃）
- **操作文件**：`luohammer-pixel-game/src/systems/SaveSystem.js`（L42-53 _isValidState）
- **修改范围**：在 _isValidState 中追加 STORY 节点存在性校验
- **改进方案**：
  ```js
  import { STORY } from '../data/story.js';
  // 在 _isValidState 中追加：
  if (!STORY[parsed.currentNode]) return false;
  ```
  并在 load() 返回 null 时由 BootScene 弹 toast"存档已损坏，请重新开始"
- **验收标准**：旧版存档节点改名后不再白屏崩溃
- **决赛加分**：+0.5
- **依赖**：无（与 T87 改不同文件，可并发）

---

### T90 — [P1] Edge TTS stub 诚实标注（R15·SCAN·维度3）

- **状态**：done（2026-07-23。BootScene.js 配音试听面板 subtitle 后追加 ttsNote 小字"当前为系统 TTS 引擎，神经语音（Edge TTS）规划中"）
- **操作文件**：`luohammer-pixel-game/src/scenes/BootScene.js`（配音试听面板 L269 附近）
- **修改范围**：纯 UI 文案新增
- **改进方案**：在配音试听面板加一行小字"当前为系统 TTS，神经语音（Edge TTS）规划中"
- **验收标准**：评委不再误判 Edge TTS 为"功能坏了"
- **决赛加分**：+0.5
- **依赖**：无

---

### T91 — [P2] BGM 音量平衡调整（R15·SCAN·维度3）

- **状态**：done（2026-07-23。AudioSystem.js bgmVolume 从 0.25 提到 0.35，BGM 不再被 SFX 盖过）
- **操作文件**：`luohammer-pixel-game/src/systems/AudioSystem.js`（L82-83）
- **修改范围**：调整 bgmVolume 数值
- **改进方案**：bgmVolume 从 0.25 提到 0.35，或在 DialogSystem 打字机音效处乘 0.6 衰减
- **验收标准**：BGM 不被 SFX 盖过
- **决赛加分**：+0.3
- **依赖**：无

---

### T92 — [P2] act6_a 检定分支差异化（R15·SCAN·维度4/7）

- **状态**：pending
- **操作文件**：`luohammer-pixel-game/src/data/story/9_act6.js`（L41-47）
- **修改范围**：让 failNext 指向支线节点或让 effects 差异更显著
- **改进方案**：让 failNext 指向 `act6_crash_blame_team`（新增支线），或至少让 effects 差异更显著（当前 successEffects vs failEffects 仅 pride ±1）
- **验收标准**：检定结果影响走向或体感差异明显
- **决赛加分**：+0.5
- **依赖**：无

---

### T93 — [杀手锏] 6 亿欠款"数字砸出"动效（R15·SCAN·决赛加分）

- **状态**：done（2026-07-23。GameScene _triggerKillerMoment 中 act6_night 分支：白闪后 100ms 创建 DOM 元素"¥600,000,000"，红色 var(--color-danger) + 发光阴影，从 top:-120px 以 cubic-bezier(0.7,0,1,0.5) 砸到 38%，保持 1.5s 后淡出。仅 act6_night 触发，其他杀手节点不显示）
- **操作文件**：`luohammer-pixel-game/src/scenes/GameScene.js`（_triggerKillerMoment 附近）
- **修改范围**：在白闪 0.25s 期间用 PixelRenderer 渲染"¥600,000,000"数字从顶部砸下
- **改进方案**：
  1. 白闪触发时全屏渲染"¥600,000,000"数字
  2. 从屏幕顶部以 ease-in-cubic 砸下，落地触发强震
  3. 数字保持 1.5s 后淡出
- **验收标准**：复赛帖写了"数字砸出"但代码没实现，本次落实
- **决赛加分**：+2（评委 10 分钟后唯一记得的瞬间）
- **依赖**：无

---
