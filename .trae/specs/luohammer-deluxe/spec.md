# 真还传 Deluxe · 增强版 Spec

## Why
基础版已完成 29 个剧情节点和核心交互。现在是时候把体验推到极致——加入打字机文字效果、CRT 转场动画、8-bit 音效、决策回顾面板、Canvas 分享卡、localStorage 存档等，让这个像素风互动小说从"能玩"变成"惊艳"。

## What Changes
- **MODIFIED** `/workspace/luohammer-simulator/index.html` — 所有增强功能集成到同一个单文件中
- 类型: 功能增强

## Impact
- Affected specs: `luohammer-crossroads`（增强）
- Affected code: `/workspace/luohammer-simulator/index.html`

---

## ADDED Requirements

### Requirement: 打字机逐字显示效果
故事文本 SHALL 以打字机效果逐字渲染，每字符延迟 25ms，支持跳过（点击故事面板立即显示全文）。

#### Scenario: 正常打字机播放
- **WHEN** 进入新场景
- **THEN** 故事文本逐字出现，每字延迟约 25ms
- **AND** 文本渲染期间选项按钮处于禁用状态（灰色不可点击）
- **AND** 打字完成后所有选项同时解锁

#### Scenario: 点击跳过打字机
- **WHEN** 玩家点击故事面板
- **AND** 打字机正在运行
- **THEN** 立即显示全部文本
- **AND** 立即解锁所有选项

#### Scenario: 历史对照卡跟随展示
- **WHEN** 打字机完成
- **THEN** 延迟 300ms 后弹出历史对照卡（带淡入动画）

### Requirement: CRT 转场动画
场景切换时 SHALL 显示 CRT 开关机效果。

#### Scenario: 场景切换转场
- **WHEN** 玩家点击选项
- **THEN** 屏幕先闪烁白光 100ms（CRT 关机效果）
- **THEN** 黑屏 200ms
- **THEN** 新场景内容以 CRT 开机效果出现（亮度从暗到亮 + 水平扫描线展开，300ms）
- **AND** 转场完成后开始打字机效果

### Requirement: 8-bit 像素音效系统
游戏 SHALL 使用 Web Audio API 合成 8-bit 风格音效（无外部音频文件依赖）。

#### Scenario: 选择确认音效
- **WHEN** 玩家点击选项
- **THEN** 播放短促的 8-bit "叮"声（方波，440Hz→880Hz 滑音，80ms）

#### Scenario: 成就解锁音效
- **WHEN** 成就触发
- **THEN** 播放三段上升音阶（C5→E5→G5，各60ms）

#### Scenario: 结局音效
- **WHEN** 结局画面展示
- **THEN** 播放 C 大调和弦琶音（C4-E4-G4-C5 依次，各 150ms）

#### Scenario: 音效开关
- **GIVEN** 右上角显示 🔊/🔇 音效开关按钮
- **WHEN** 点击按钮
- **THEN** 切换音效启用/静音状态，图标切换，localStorage 持久化设置

### Requirement: 决策回顾面板
结局画面 SHALL 展示玩家 vs 历史上老罗的逐项对比。

#### Scenario: 完整回顾
- **WHEN** 结局展示
- **THEN** 在结局属性面板下方展示"决策回顾"表格
- **AND** 每行显示：节点名称 | 你的选择 | 历史上的选择 | 是否一致
- **AND** 一致用绿色 ✓ 标记，不一致用红色 ✗ 标记
- **AND** 统计一致率（如 "7个关键节点中，你与老罗一致了 3 个，一致率 43%"）

### Requirement: Canvas 分享卡生成
结局画面 SHALL 提供生成分享卡的功能。

#### Scenario: 生成分享卡
- **WHEN** 玩家点击"生成分享卡"按钮
- **THEN** 使用 Canvas 渲染一张 800×500 像素的分享图
- **AND** 包含：结局标题、四维属性条形图、一段老罗金句、游戏二维码占位区
- **AND** 渲染完成后显示在结局画面下方，支持右键另存

### Requirement: localStorage 存档系统
游戏 SHALL 自动存档到浏览器 localStorage。

#### Scenario: 自动存档
- **WHEN** 玩家做出选择
- **THEN** 自动将当前 gameState（含 currentNode）序列化保存到 localStorage

#### Scenario: 读档
- **WHEN** 玩家刷新页面
- **AND** localStorage 中存在存档
- **THEN** 弹出"检测到存档，是否继续？"提示
- **AND** 选择"继续"则恢复到存档节点，选择"新游戏"则清除存档并重新开始

### Requirement: 粒子背景
背景 SHALL 渲染缓慢漂浮的像素粒子（模拟老式显示器的雪花噪声）。

#### Scenario: 粒子渲染
- **WHEN** 游戏加载
- **THEN** 背景渲染 30 个 2×2 像素的方形粒子
- **AND** 粒子以随机速度缓慢漂移，颜色为暗金色（#e2b04a 带不同透明度）
- **AND** 粒子移出屏幕后从对侧重新出现

### Requirement: 决策树可视化
结局画面 SHALL 展示玩家本次游戏的决策路径图。

#### Scenario: 决策路径渲染
- **WHEN** 结局展示
- **THEN** 在"决策回顾"表格上方展示一个简易 ASCII-art 风格的决策路径图
- **AND** 每个节点用方框表示，分支用箭头连接
- **AND** 玩家实际走过的路径用金色高亮

---

## MODIFIED Requirements

### Requirement: 成就系统（增强）
原成就系统新增 4 个隐藏成就（彩蛋类）。

#### Scenario: 隐藏成就触发
- **GIVEN** 玩家做出非常规选择组合
- **WHEN** 满足隐藏条件
- **THEN** 弹出特殊成就（金色边框 + 闪烁动画）

隐藏成就：
1. 🥷 "平行宇宙" — 所有选择都与历史上老罗不同
2. 🧠 "老罗附体" — 所有选择都与历史上老罗完全一致
3. ⚡ "速通玩家" — 3 个选择内到达提前结局
4. 🔄 "再来亿次" — 重新开始超过 5 次