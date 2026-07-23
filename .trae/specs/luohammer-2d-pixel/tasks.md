# Tasks

- [ ] Task 1: 项目初始化 — 创建 Phaser 3 + Vite 项目骨架
  - [ ] SubTask 1.1: 创建 `luohammer-pixel-game/` 目录，初始化 package.json（phaser 3 + vite）
  - [ ] SubTask 1.2: 创建 vite.config.js + index.html 入口
  - [ ] SubTask 1.3: 创建 src/main.js — Phaser Game 实例 + 场景注册
  - [ ] SubTask 1.4: 创建 src/config.js — 游戏常量（分辨率 800×500、像素缩放、色板）
  - [ ] SubTask 1.5: `npm install` 验证项目可启动

- [ ] Task 2: 剧情数据迁移 — 从 HTML 版提取为 JS 模块
  - [ ] SubTask 2.1: 创建 src/data/story.js — 将所有 29 个节点数据格式化为结构化对象
  - [ ] SubTask 2.2: 每个节点包含：sceneType（场景类型）、character（角色名）、text、choices、effects、historyNote、progress
  - [ ] SubTask 2.3: 定义 9 种场景类型枚举：classroom / lecture / office / stage / livestream / lab / podcast / street / ending

- [ ] Task 3: 程序化像素场景渲染系统
  - [ ] SubTask 3.1: 创建 src/systems/PixelRenderer.js
  - [ ] SubTask 3.2: 实现 9 种场景的程序化绘制函数（每个场景用 Phaser Graphics API 画像素背景）
  - [ ] SubTask 3.3: 实现像素角色立绘绘制（简单人形：头+身体+手臂，3种姿态）
  - [ ] SubTask 3.4: 场景切换时清除旧 Graphics 并绘制新场景

- [ ] Task 4: 对话框系统 + 打字机效果
  - [ ] SubTask 4.1: 创建 src/systems/DialogSystem.js
  - [ ] SubTask 4.2: 底部半透明对话框（像素风边框 + 角色名 + 文本区）
  - [ ] SubTask 4.3: 打字机逐字显示（30ms/字），支持 HTML 标签（<b>、</p><p>）
  - [ ] SubTask 4.4: 点击/空格跳过打字 → 立即显示全文

- [ ] Task 5: 选择界面系统
  - [ ] SubTask 5.1: 创建 src/systems/ChoiceSystem.js
  - [ ] SubTask 5.2: 两个选择按钮（像素风边框 + 悬停高亮 + A/B标记）
  - [ ] SubTask 5.3: 选择后触发：属性更新 + 历史对照展示 + 转场 + 下一场景

- [ ] Task 6: 属性面板系统
  - [ ] SubTask 6.1: 创建 src/systems/StatsSystem.js
  - [ ] SubTask 6.2: 右上角四维属性条（理想/财富/名声/翻车），像素风进度条
  - [ ] SubTask 6.3: 属性变化时播放动画（条形图增长/缩短）

- [ ] Task 7: 像素转场动画
  - [ ] SubTask 7.1: 创建 src/systems/Transition.js
  - [ ] SubTask 7.2: 实现像素块逐列覆盖（右→左，500ms）
  - [ ] SubTask 7.3: 实现像素块逐列揭示（左→右，500ms）

- [ ] Task 8: 8-bit 音效系统
  - [ ] SubTask 8.1: 创建 src/systems/AudioSystem.js
  - [ ] SubTask 8.2: 程序化生成 AudioBuffer（选择音效/成就音效/转场音效/结局音效）
  - [ ] SubTask 8.3: 音效开关（localStorage 持久化）

- [ ] Task 9: 历史对照卡片 + 成就弹窗
  - [ ] SubTask 9.1: 创建 src/ui/HistoryCard.js — 金色边框卡片，展示"历史上老罗选择了"
  - [ ] SubTask 9.2: 创建 src/ui/AchievementPopup.js — 成就弹窗（右上角滑入/滑出）

- [ ] Task 10: 存档系统
  - [ ] SubTask 10.1: 创建 src/systems/SaveSystem.js
  - [ ] SubTask 10.2: 每次选择后自动保存到 localStorage
  - [ ] SubTask 10.3: 启动时检测存档 → 弹出"继续/新游戏"

- [ ] Task 11: 主游戏场景（GameScene）— 整合所有系统
  - [ ] SubTask 11.1: 创建 src/scenes/GameScene.js
  - [ ] SubTask 11.2: create() 中初始化所有系统（PixelRenderer + Dialog + Choice + Stats + Transition + Audio + Save）
  - [ ] SubTask 11.3: loadNode(nodeId) 方法：渲染场景 → 显示文本 → 展示选项
  - [ ] SubTask 11.4: makeChoice(choiceIndex) 方法：应用效果 → 展示历史对照 → 转场 → 加载下一节点
  - [ ] SubTask 11.5: 结局检测 → 切换到 EndingScene

- [ ] Task 12: 结局场景（EndingScene）
  - [ ] SubTask 12.1: 创建 src/scenes/EndingScene.js
  - [ ] SubTask 12.2: 像素风结局画面（全屏背景 + 结局标题 + 属性总结 + 金句）
  - [ ] SubTask 12.3: "再来一次"按钮 → 重置状态 → 回到 BootScene

- [ ] Task 13: BootScene — 启动+存档检测
  - [ ] SubTask 13.1: 创建 src/scenes/BootScene.js
  - [ ] SubTask 13.2: 显示游戏标题画面（像素风 "真还传" logo）
  - [ ] SubTask 13.3: 检测 localStorage 存档 → 弹出"继续/新游戏"
  - [ ] SubTask 13.4: 点击开始 → 切换到 GameScene

- [ ] Task 14: 整体联调 + 回归测试

# Task Dependencies
- Task 2 (剧情数据) 必须先完成，Task 11 依赖它
- Task 3-10 可并行开发（各系统独立）
- Task 11 依赖 Task 3-10 全部完成
- Task 12, 13 依赖 Task 11
- Task 14 依赖 Task 11-13
