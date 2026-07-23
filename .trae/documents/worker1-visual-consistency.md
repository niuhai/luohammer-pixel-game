# 工作者 1：视觉一致性检查与修复

## 项目背景
这是一个以罗永浩人生经历为背景的 2D 像素风互动视觉小说游戏。
技术栈：Phaser 3.80 + Vite 5，纯 Canvas 渲染，画布 800×500。
设计风格：所有 UI 用代码绘制（fillRect），暗色底+金色强调色（#f0c040），复古像素风。
项目根目录：`e:\ownWorkPlace\罗的十字路口\luohammer-pixel-game`

## 当前问题
之前 4 个工作者并行修改了 UI 代码，可能存在以下问题：

1. **装饰角风格不统一**：DialogSystem、ChoiceSystem、AchievementPopup、HistoryCard、BootScene、EndingScene 都各自加了"L形金色装饰角"，但每个工作者实现方式可能不同（有的用 fillRect，有的用 beginPath/strokePath），尺寸也可能不一致（有的 4×4，有的 8×8）。

2. **字体声明不统一**：有的文件写 `'Press Start 2P', monospace`，有的写 `"Press Start 2P", monospace`，有的写 `FONTS.pixel`，有的硬编码。

3. **颜色硬编码**：部分文件可能直接写了 `0xf0c040` 而不是用 `COLORS.accent` 或 `UI_COLORS.cornerDecor`。

4. **角色绘制可能超出画布**：角色放大 2 倍后，某些姿态（angry 举手锤子、speaking 举手）可能超出 800×500 画布边界。

5. **新增场景（fridge_smash/talkshow/court）的前景元素可能遮挡角色**：前景元素画在角色之后，如果 z-order 不对，会盖住角色。

## 目标状态
1. 所有装饰角用同一种实现方式、同一种尺寸
2. 所有字体声明统一使用 config.js 导出的 FONTS 常量
3. 所有颜色使用 config.js 导出的 COLORS/UI_COLORS 常量
4. 角色在任何姿态下不超出画布
5. 前景元素不遮挡角色关键部位（头部、对话框）

## 你要修改的文件
逐一 Read 以下文件，检查并修复：
1. `src/systems/DialogSystem.js`
2. `src/systems/ChoiceSystem.js`
3. `src/systems/PixelRenderer.js`
4. `src/ui/AchievementPopup.js`
5. `src/ui/HistoryCard.js`
6. `src/scenes/BootScene.js`
7. `src/scenes/EndingScene.js`
8. `src/config.js`（确认 FONTS 和 UI_COLORS 导出正确）

## 具体要求

### 必须做到
1. **统一装饰角**：创建一个共享的绘制函数，所有文件调用同一个函数。在 `src/systems/PixelRenderer.js` 中添加：
   ```javascript
   static drawCornerDecor(g, x, y, w, h, color, size = 8) {
     // 左上
     g.fillStyle(color); g.fillRect(x, y, size, 2); g.fillRect(x, y, 2, size);
     // 右上
     g.fillStyle(color); g.fillRect(x + w - size, y, size, 2); g.fillRect(x + w - 2, y, 2, size);
     // 左下
     g.fillStyle(color); g.fillRect(x, y + h - 2, size, 2); g.fillRect(x, y + h - size, 2, size);
     // 右下
     g.fillStyle(color); g.fillRect(x + w - size, y + h - 2, size, 2); g.fillRect(x + w - 2, y + h - size, 2, size);
   }
   ```
   然后所有其他文件改为调用 `PixelRenderer.drawCornerDecor(g, x, y, w, h, color)`

2. **统一字体**：所有 `fontFamily` 改为使用 config.js 的 `FONTS.pixel` / `FONTS.body` / `FONTS.mono`

3. **统一颜色**：所有 `0xf0c040` 改为 `COLORS.accent` 或 `UI_COLORS.cornerDecor`

4. **角色边界检查**：在 `_drawChar` 方法中，确保所有 fillRect 的坐标在 0-800（X）和 0-500（Y）范围内。如果某个姿态的举手/举锤超出边界，调整 baseY 或缩小该部位。

5. **前景 z-order 检查**：确认 PixelRenderer 中前景元素的绘制在角色之后（代码顺序即绘制顺序），如果前景遮挡了角色头部，调整前景元素位置或透明度。

### 不能做
1. 不要修改 story.js
2. 不要修改 GameScene.js 的核心逻辑
3. 不要修改 config.js 的 COLORS/SCENE_TYPES（只确认导出正确）
4. 不要删除任何已有功能
5. 不要引入新的 npm 依赖

## 验证标准
1. `npm run build` 无报错
2. 所有装饰角视觉上风格一致（金色、L形、8×8）
3. 所有字体声明使用 FONTS 常量
4. 所有金色使用 COLORS.accent 或 UI_COLORS.cornerDecor
5. 角色在 8 种姿态下不超出画布
6. 前景不遮挡角色头部
