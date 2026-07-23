# 真还传 · 创业模拟器 — 浏览器自动化全流程测试计划

## 背景

`luohammer-pixel-game` 是一个基于 Phaser 3 + Vite 的 2D 像素风互动视觉小说游戏。

- **入口文件**: `src/main.js` → `index.html`
- **主场景流程**: BootScene → GameScene → EndingScene
- **核心数据**: `src/data/story.js`（剧情）、`talents.js`（天赋）、`endings.js`（结局）
- **资源**: `assets/characters/*.png`（角色+场景图）
- **构建**: `npm run dev` / `npm run build`

本计划通过浏览器自动化测试全流程的可用性，在关键节点截图并视觉分析，发现问题。

---

## 一、测试环境准备

### 1.1 依赖检查
- 确认 `package.json` 存在且脚本正常（`dev`, `build`）
- 确认 `node_modules` 存在，否则执行 `npm install`
- 确认 `vite.config.js` 存在

### 1.2 启动开发服务器
- 运行 `npm run dev`
- 确认服务启动后获得本地 URL（如 `http://localhost:5173`）
- 等待 5 秒确保 Phaser 资源加载完成

### 1.3 构建产物验证（可选步骤）
- 运行 `npm run build` 验证无构建错误
- `dist/` 目录产物完整性检查

---

## 二、全流程测试路径

### 2.1 测试路径 A：正常通关流程（最优先级）

| 步骤 | 节点 | 截图时机 | 检查项 |
|------|------|----------|--------|
| A1 | 启动页面加载 | 打开 URL 后 3 秒 | 游戏画布渲染、无白屏、标题可见 |
| A2 | BootScene 标题页 | 标题+按钮渲染完成 | "真还传" 标题、"开始游戏" 按钮、角色立绘、背景粒子 |
| A3 | 点击"开始游戏" | 按钮点击后 | 按钮有 hover 效果，点击有反馈 |
| A4 | 天赋选择界面 | 天赋卡片渲染完成 | 3 张天赋卡片、标题、卡片内容可读、卡片布局合理 |
| A5 | 选择第 1 个天赋 | 选择后 1 秒 | 天赋应用效果、进入 GameScene |
| A6 | GameScene 首个节点 | 对话框渲染完成 | 场景背景、角色立绘、对话框、角色名、文本打字效果、属性面板 |
| A7 | 点击推进对话 | 对话文本完整显示 | 打字效果正常、点击跳过功能、选项出现 |
| A8 | 选择第 1 个选项 | 选项点击后 | 属性变化、阶段切换、历史对照卡片（如有） |
| A9 | 推进 3-5 个剧情节点 | 每个节点截图 | 场景切换过渡动画、不同场景背景、角色姿态变化、属性更新 |
| A10 | 阶段结算 | 结算对话框 | "阶段结算" 标题、属性检查逻辑、后果提示 |
| A11 | 随机事件 | 如有触发 | 随机事件 UI、选项、效果应用 |
| A12 | 结局场景 | 到达 EndingScene | 结局标题、描述、属性条动画、金句、成就列表、"再来一次"按钮 |
| A13 | 点击"再来一次" | 回到 BootScene | 回到标题页、状态重置 |

### 2.2 测试路径 B：存档与读档

| 步骤 | 节点 | 检查项 |
|------|------|--------|
| B1 | 游戏中做出 3 个选择后 | 检查 localStorage 是否有存档数据 |
| B2 | 刷新页面 | 检测"继续游戏"/"新游戏"按钮出现 |
| B3 | 点击"继续游戏" | 状态恢复到存档节点、属性一致 |
| B4 | 点击"新游戏" | localStorage 清除、状态重置 |

### 2.3 测试路径 C：UI 元素与交互细节

| 步骤 | 元素 | 检查项 |
|------|------|--------|
| C1 | 音效开关按钮 | 右上角 🔊/🔇 图标、点击切换、持久化 |
| C2 | 属性面板 | 四维属性条数值正确、动画流畅 |
| C3 | 章节/进度显示 | 左上角章节文本、进度条 |
| C4 | 成就弹窗 | 触发成就时右上角金色弹窗动画 |
| C5 | 历史对照卡片 | 选择后出现历史对照信息 |
| C6 | 过渡动画 | 场景切换时有过渡遮罩/淡入淡出 |
| C7 | 选项按钮 hover | 悬停状态边框/颜色变化 |
| C8 | 对话框点击区域 | 点击对话框任意位置可推进文本 |

### 2.4 测试路径 D：移动端适配（浏览器视口模拟）

| 步骤 | 条件 | 检查项 |
|------|------|--------|
| D1 | 视口 800x500 (PC) | 所有元素在画布内、无溢出 |
| D2 | 视口 640x360 (横屏手机) | 缩放适配、按钮可点击、文字可读 |
| D3 | 视口 360x640 (竖屏手机) | 横屏提示是否正确显示 |

### 2.5 测试路径 E：控制台错误检查

- **持续检查**: 全程监控浏览器 console 输出
- **重点时刻**:
  - 场景切换时 (BootScene → GameScene → EndingScene)
  - 资源加载时 (图片加载)
  - 属性更新时 (效果引擎 applyEffects)
  - 存档/读档时 (localStorage 序列化/反序列化)

---

## 三、截图与视觉分析要点

### 3.1 关键截图节点（必须覆盖）
1. **BootScene 完整页** - 标题、按钮、角色立绘
2. **天赋选择页** - 3 张卡片布局
3. **GameScene 首节点** - 场景+角色+对话框+属性面板
4. **选择界面** - 选项按钮样式
5. **阶段结算** - 特殊对话框
6. **历史对照卡片** - 金色边框样式
7. **成就弹窗** - 右上角动画
8. **EndingScene 结局页** - 完整结局界面
9. **移动端横屏** - 640x360 视口下的完整游戏页
10. **移动端竖屏提示** - 360x640 视口下的提示层

### 3.2 视觉分析维度

每张截图需分析：

| 维度 | 检查要点 |
|------|----------|
| **布局** | 元素是否在画布内、是否重叠、是否溢出 |
| **可读性** | 中文字体是否正常、颜色对比度是否足够 |
| **像素一致性** | 边框/装饰是否为像素风、是否模糊 |
| **颜色** | 是否符合暗色 + 金色主题 (#0a0a0a / #f0c040) |
| **角色图像** | PNG 是否正确加载、尺寸比例是否合理 |
| **场景图像** | 背景图是否与节点描述匹配、是否有黑边 |
| **文字截断** | 对话框文字是否溢出、是否有 word-wrap |
| **UI 完整性** | 四角装饰、下划线、按钮边框是否齐全 |

### 3.3 潜在问题预判

- **图片加载路径问题**: Phaser 在 Vite dev server 下的相对路径问题（`assets/characters/` vs `/assets/characters/`）
- **中文 CORS 字体**: Google Fonts 代理 `fonts.loli.net` 可用性
- **属性字段名不一致**: `pride`/`wealth`/`reputation`/`failures` 在 story.js 与 effects.js 中一致性检查
- **Set 序列化**: `flags` 和 `triggeredEvents` 的 Set → Array → Set 序列化循环
- **节点不存在**: `choice.next` 指向未定义节点 → 白屏/崩溃
- **深度层级**: depth 值是否正确分层（0/100/200/300/400/1000）
- **字符图像缩放**: 角色立绘 `setDisplaySize(180, 240)` 比例是否合理
- **粒子性能**: 大量粒子动画导致卡顿（尤其是 EndingScene 的 35+ 粒子）
- **移动端触摸**: `useHandCursor` 在移动端无意义，但触摸区域是否够大（≥44px）

---

## 四、执行步骤（按序）

### 阶段 1：环境启动
1. 检查依赖 → `npm install`（如无 node_modules）
2. 启动 dev server → `npm run dev`
3. 获取 URL → 记录控制台输出

### 阶段 2：页面加载测试
4. 打开 URL → 等待 3-5 秒
5. 截图 #1 → 检查 Canvas 是否渲染
6. 检查 console 错误 → 记录

### 阶段 3：标题页测试
7. 截图 #2 → BootScene 完整渲染
8. 视觉分析标题页 → 记录问题
9. 检查按钮 hover 效果（如果自动化可模拟）

### 阶段 4：天赋选择测试
10. 点击"开始游戏" → 等待场景切换
11. 截图 #3 → 天赋选择界面
12. 分析卡片布局、文字可读性
13. 选择第 1 个天赋 → 截图 #4

### 阶段 5：游戏流程测试
14. 等待 GameScene 渲染 → 截图 #5
15. 分析对话框、角色、属性面板布局
16. 点击推进对话 → 观察打字效果
17. 截图 #6 → 选项出现
18. 选择第 1 个选项 → 截图 #7
19. 推进 3-5 个节点 → 每节点截图一张（#8-#12）
20. 观察场景切换、过渡动画
21. 检查历史对照卡片 → 截图 #13
22. 检查成就弹窗（如有触发）→ 截图 #14

### 阶段 6：结局页测试
23. 继续推进直到结局 → 或手动跳转
24. 截图 #15 → EndingScene 完整渲染
25. 分析结局标题、属性条动画、文字布局
26. 点击"再来一次" → 验证回到 BootScene

### 阶段 7：存档测试
27. 新游戏 → 做 3 个选择
28. 刷新页面 → 截图 #16
29. 检查"继续游戏"按钮
30. 点击"继续游戏" → 截图 #17

### 阶段 8：移动端模拟
31. 设置视口 640x360 → 截图 #18
32. 检查缩放适配、按钮触摸区域
33. 设置视口 360x640 → 截图 #19
34. 检查竖屏提示

### 阶段 9：问题汇总与分析
35. 汇总所有 console 错误、警告
36. 汇总所有视觉问题（布局、截断、重叠、配色）
37. 生成测试报告（问题列表 + 截图证据 + 建议修复）

---

## 五、交付物

| 交付物 | 说明 |
|--------|------|
| 测试报告 | 问题列表（分类：渲染/布局/逻辑/资源/性能） |
| 截图集 | 15-20 张关键节点截图 |
| Console 日志 | 所有错误和警告 |
| 修复建议 | 针对每个问题的具体修改建议 |

---

## 六、关键代码参考路径（用于问题定位）

| 功能 | 文件路径 |
|------|----------|
| 入口配置 | [main.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/main.js) |
| 全局配置 | [config.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/config.js) |
| 启动场景 | [BootScene.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/scenes/BootScene.js) |
| 游戏主场景 | [GameScene.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/scenes/GameScene.js) |
| 结局场景 | [EndingScene.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/scenes/EndingScene.js) |
| 像素渲染 | [PixelRenderer.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/PixelRenderer.js) |
| 对话系统 | [DialogSystem.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/DialogSystem.js) |
| 选项系统 | [ChoiceSystem.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/ChoiceSystem.js) |
| 属性系统 | [StatsSystem.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/StatsSystem.js) |
| 天赋系统 | [TalentSystem.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/TalentSystem.js) |
| 随机事件 | [RandomEventSystem.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/RandomEventSystem.js) |
| 音效系统 | [AudioSystem.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/AudioSystem.js) |
| 存档系统 | [SaveSystem.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/SaveSystem.js) |
| 过渡动画 | [Transition.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/systems/Transition.js) |
| 剧情数据 | [story.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/story.js) |
| 天赋数据 | [talents.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/talents.js) |
| 结局数据 | [endings.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/endings.js) |
| 效果引擎 | [effects.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/effects.js) |
| 阶段数据 | [stages.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/stages.js) |
| 随机事件数据 | [events-random.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/events-random.js) |
| 成就弹窗 | [AchievementPopup.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/ui/AchievementPopup.js) |
| 历史对照卡片 | [HistoryCard.js](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/ui/HistoryCard.js) |
| HTML 入口 | [index.html](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/index.html) |
| 资源目录 | [assets/characters/](file:///e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/assets/characters/) |
