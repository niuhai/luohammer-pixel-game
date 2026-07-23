# 真还传 · 2D像素风视觉小说 Spec

## Why
用户需要一个完整的2D像素风项目——用Phaser.js引擎制作第一人称视觉小说，让玩家在像素画场景中做选择，体验罗永浩的人生十字路口。当前只有纯文本HTML版本，需要升级为有像素场景、角色立绘、动画转场的完整游戏。

## What Changes
- 新建完整 Phaser.js 项目于 `/workspace/luohammer-pixel-game/`
- 使用 npm + Vite 构建，Phaser 3 作为游戏引擎
- 像素风场景用 Canvas 程序化生成（无需外部图片资源）
- 所有剧情文案复用现有 `luohammer-simulator/index.html` 中已打磨的内容
- 第一人称视角：玩家看到场景+NPC，做出选择推进剧情

## Impact
- Affected specs: `luohammer-crossroads`, `luohammer-deluxe`（文案复用）
- Affected code: 新项目 `/workspace/luohammer-pixel-game/`

---

## ADDED Requirements

### Requirement: Phaser.js 项目架构
游戏 SHALL 基于 Phaser 3 + Vite 构建，项目结构清晰可维护。

#### Scenario: 项目启动
- **WHEN** 开发者运行 `npm install && npm run dev`
- **THEN** Vite 启动开发服务器，浏览器打开即可看到游戏
- **AND** 支持热更新（修改代码后自动刷新）

#### Scenario: 项目构建
- **WHEN** 开发者运行 `npm run build`
- **THEN** 输出可部署的静态文件到 `dist/` 目录

### Requirement: 程序化像素场景生成
游戏 SHALL 使用 Phaser Graphics API 程序化生成所有像素风场景，不依赖外部图片文件。

#### Scenario: 场景渲染
- **WHEN** 进入新剧情节点
- **THEN** 根据场景类型（教室/办公室/鸟巢/直播间等）程序化绘制像素背景
- **AND** 包含场景关键元素（如教室有黑板和课桌，鸟巢有巨型屏幕和观众）
- **AND** 所有图形使用像素风格（无抗锯齿，整数坐标，色板限制）

#### Scenario: 场景类型覆盖
- **GIVEN** 9种场景类型
- **WHEN** 游戏运行
- **THEN** 可渲染以下场景：延边教室、新东方讲台、牛博网办公室、老罗英语教室、锤子办公室、鸟巢发布会、直播间、AR实验室、播客录音棚

### Requirement: 像素角色立绘
游戏 SHALL 显示像素风角色立绘，在场景右侧或中央展示。

#### Scenario: 角色展示
- **WHEN** 剧情文本展示
- **THEN** 场景中显示当前对话角色的像素立绘
- **AND** 角色立绘使用程序化绘制（矩形/像素块组合成人形）
- **AND** 不同场景角色有不同姿态（站姿/坐姿/演讲姿态）

### Requirement: 第一人称视觉小说UI
游戏 SHALL 提供视觉小说风格的UI层。

#### Scenario: 对话框
- **WHEN** 剧情文本展示
- **THEN** 屏幕下方显示半透明对话框
- **AND** 对话框包含：角色名称、逐字显示的文本、打字机光标
- **AND** 点击/按空格推进文本

#### Scenario: 选择界面
- **WHEN** 到达选择节点
- **THEN** 对话框上方弹出两个选择按钮
- **AND** 按钮有像素风边框和悬停效果
- **AND** 选择后播放转场动画

#### Scenario: 属性面板
- **WHEN** 游戏进行中
- **THEN** 屏幕右上角显示四维属性条（理想/财富/名声/翻车）
- **AND** 属性变化时有动画效果

### Requirement: 像素风转场动画
场景切换 SHALL 使用像素风转场效果。

#### Scenario: 场景切换
- **WHEN** 玩家做出选择
- **THEN** 屏幕以像素块从右向左逐列覆盖（约500ms）
- **THEN** 新场景从左向右逐列揭示（约500ms）
- **AND** 转场期间播放8-bit音效

### Requirement: 8-bit音效系统
游戏 SHALL 使用 Phaser 内置 Web Audio 支持播放音效。

#### Scenario: 音效播放
- **WHEN** 玩家交互（点击选择/成就解锁/场景切换）
- **THEN** 播放对应的8-bit音效
- **AND** 音效使用程序化生成的AudioBuffer（无外部音频文件）

### Requirement: 历史对照卡片
选择后 SHALL 展示历史对照信息。

#### Scenario: 历史对照展示
- **WHEN** 玩家做出选择后
- **THEN** 在对话框区域展示"📜 历史上老罗选择了：XXX"
- **AND** 以金色边框高亮显示
- **AND** 点击继续后进入下一场景

### Requirement: 结局画面
游戏结局 SHALL 展示完整的结局画面。

#### Scenario: 结局展示
- **WHEN** 游戏到达结局
- **THEN** 显示像素风结局画面（全屏像素画+结局标题+属性总结+老罗金句）
- **AND** 提供"再来一次"按钮

### Requirement: 进度保存
游戏 SHALL 使用 localStorage 保存进度。

#### Scenario: 自动存档
- **WHEN** 玩家做出选择
- **THEN** 自动保存当前节点和属性到 localStorage

#### Scenario: 读档
- **WHEN** 玩家重新打开游戏
- **THEN** 检测存档并提示是否继续

---

## MODIFIED Requirements

### Requirement: 剧情数据（从HTML版迁移）
剧情节点数据 SHALL 从现有 `luohammer-simulator/index.html` 中提取，格式化为 Phaser 场景可消费的 JSON 结构。每个节点包含：场景类型、角色、文本、选项、属性效果、历史对照。

---

## 项目文件结构

```
luohammer-pixel-game/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.js              # Phaser 入口
│   ├── config.js             # 游戏配置
│   ├── scenes/
│   │   ├── BootScene.js      # 启动+资源生成
│   │   ├── GameScene.js      # 主游戏场景
│   │   └── EndingScene.js    # 结局场景
│   ├── data/
│   │   └── story.js          # 剧情数据（从HTML版迁移）
│   ├── systems/
│   │   ├── PixelRenderer.js  # 程序化像素场景生成
│   │   ├── DialogSystem.js   # 对话框+打字机
│   │   ├── ChoiceSystem.js   # 选择界面
│   │   ├── StatsSystem.js    # 属性面板
│   │   ├── Transition.js     # 像素转场
│   │   ├── AudioSystem.js    # 8-bit音效
│   │   └── SaveSystem.js     # 存档系统
│   └── ui/
│       ├── HistoryCard.js    # 历史对照卡片
│       └── AchievementPopup.js # 成就弹窗
```
