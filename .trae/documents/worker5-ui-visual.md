# W5 UI视觉打磨 — 工作者任务文档

## 1. 任务目标

打磨游戏UI视觉效果，为各系统添加动画和交互反馈，提升游戏的沉浸感和品质感。

---

## 2. 可修改的文件列表

| 文件 | 说明 |
|------|------|
| `src/scenes/BootScene.js` | 标题界面 |
| `src/scenes/EndingScene.js` | 结局界面 |
| `src/systems/DialogSystem.js` | 对话框系统 |
| `src/systems/ChoiceSystem.js` | 选项系统 |
| `src/systems/StatsSystem.js` | 属性面板 |
| `src/systems/TalentSystem.js` | 天赋抽取系统 |
| `src/systems/RandomEventSystem.js` | 随机事件系统 |

---

## 3. 不可修改的文件列表

- `src/data/` 目录下所有文件（`story.js`, `events-random.js`, `talents.js`, `endings.js`, `effects.js`, `stages.js`）
- `src/scenes/GameScene.js` — 游戏主逻辑
- `src/config.js` — 全局配置
- `src/systems/PixelRenderer.js` — 渲染引擎
- `src/systems/AudioSystem.js` — 音效系统
- `src/systems/SaveSystem.js` — 存档系统
- `src/systems/Transition.js` — 过渡动画
- `src/main.js` — 入口文件

---

## 4. 具体要求和验收标准

### 4.1 BootScene — 标题界面打磨

#### 当前状态
- 标题有简单的 alpha 闪烁动画
- 角色立绘静态显示
- 按钮 hover 有边框变化和按下位移

#### 打磨要求

1. **标题动画更流畅**：
   - 标题文字从上方滑入（当前无入场动画）
   - 标题闪烁改为更柔和的呼吸效果（alpha 0.85→1.0，duration 2000ms）
   - 标题下方加一条金色光线从左到右扫过的动画（shine effect）

2. **角色立绘位置微调**：
   - 角色立绘从左侧滑入（x: -200 → 200，duration 800ms，ease: Back.Out）
   - 立绘增加微弱的上下浮动（y: ±3px，duration 3000ms，yoyo，repeat）

3. **按钮 hover 效果增强**：
   - hover 时按钮整体微微放大（scale: 1→1.05，duration 150ms）
   - hover 时四角装饰闪烁（alpha: 0.3→1→0.3，duration 600ms）
   - 按下时增加轻微缩放效果（scale: 1→0.95，duration 100ms）

#### 验收标准
- [ ] 标题有入场滑入动画
- [ ] 标题闪烁更柔和（呼吸效果）
- [ ] 角色立绘有入场动画和微浮动
- [ ] 按钮 hover 有缩放效果
- [ ] 按钮 hover 时角装饰闪烁
- [ ] 不破坏现有按钮点击逻辑

### 4.2 DialogSystem — 对话框系统打磨

#### 当前状态
- 打字机效果固定30ms/字
- 文字直接出现，无动画
- 点击跳过打字机效果

#### 打磨要求

1. **打字机效果速度可调**：
   - 新增 `typingSpeed` 属性，默认30ms，可通过 `setTypingSpeed(ms)` 调整
   - 标点符号后自动停顿：句号/问号/感叹号停顿200ms，逗号停顿100ms
   - 段落换行停顿300ms

2. **文字出现时有轻微缩放动画**：
   - 每个新字符出现时，整段文字有微弱的 scale 脉冲（1.0→1.01→1.0，duration 100ms）
   - 这个效果要非常微妙，不能影响阅读

3. **对话框入场动画**：
   - 对话框从底部滑入（y: +50 → 0，duration 300ms，ease: Back.Out）
   - 角色名字从左侧淡入（alpha: 0→1，x: -10→0，duration 200ms）

#### 验收标准
- [ ] 打字机速度可调
- [ ] 标点符号有自动停顿
- [ ] 文字出现有微弱缩放脉冲
- [ ] 对话框有入场滑入动画
- [ ] 角色名字有淡入动画
- [ ] 不破坏现有 show/hide/skipTyping 逻辑

### 4.3 ChoiceSystem — 选项系统打磨

#### 当前状态
- 选项有滑入动画（从下方滑入）
- hover 时背景变亮、边框变金色
- 按下时有透明度变化

#### 打磨要求

1. **选项 hover 时金色边框闪烁**：
   - hover 时边框 alpha 在 0.5→1.0 之间循环（duration 600ms，yoyo）
   - 四角 L 形装饰同步闪烁

2. **选中时有确认动画**：
   - 点击选项后，选中项放大脉冲（scale: 1→1.05→1.0，duration 200ms）
   - 未选中项淡出（alpha: 1→0.3，duration 300ms）
   - 选中项边框变为实线金色（不再闪烁）
   - 确认动画持续500ms后触发 onChoice 回调

3. **选项入场动画增强**：
   - 选项从左侧依次滑入（x: -30→0，duration 400ms，delay: i*120ms，ease: Back.Out）
   - 每个选项入场时有微弱的发光效果（alpha: 0→0.3→0，duration 500ms）

#### 验收标准
- [ ] hover 时边框和角装饰闪烁
- [ ] 选中时有放大脉冲
- [ ] 未选中项淡出
- [ ] 选中后延迟触发回调（确认动画完成后再执行）
- [ ] 选项入场从左侧滑入
- [ ] 不破坏现有键盘快捷键逻辑

### 4.4 StatsSystem — 属性面板打磨

#### 当前状态
- 属性条有 tween 动画（宽度变化）
- 属性值文字直接更新
- 隐藏属性可切换显示

#### 打磨要求

1. **属性变化时有浮动数字效果**：
   - 当属性变化时，在属性条上方浮出一个数字（如 "+2" 或 "-1"）
   - 数字从属性条位置向上浮动（y: -30），同时淡出（alpha: 1→0）
   - 正面变化用绿色（0x40C040），负面变化用红色（0xE04040）
   - 数字字体：14px，FONTS.pixel，duration 1000ms

2. **属性条填充动画增强**：
   - 填充条从左到右有一个"光波"效果（填充条右侧有一个高亮区域，alpha 0.5，宽度4px，随填充移动）
   - 低值（≤2）时条闪烁警告（alpha: 1→0.7→1，duration 800ms，repeat 3次）

3. **属性值变化时的数字滚动**：
   - 数值文字从旧值滚动到新值（如 5→7，显示 5→6→7）
   - 滚动速度 200ms/步

#### 验收标准
- [ ] 属性变化有浮动数字效果
- [ ] 浮动数字颜色区分正负
- [ ] 填充条有光波效果
- [ ] 低值属性条闪烁警告
- [ ] 数值文字有滚动效果
- [ ] 不破坏现有 update 和隐藏属性逻辑

### 4.5 TalentSystem — 天赋抽取系统打磨

#### 当前状态
- 卡片有入场动画（alpha + y）
- hover 时边框变亮
- 点击后整个容器淡出

#### 打磨要求

1. **卡片翻转动画**：
   - 卡片初始背面朝上（显示 "?" 和稀有度颜色）
   - 入场后0.5秒，3张卡片依次翻转（scaleX: 1→0→1，正面内容在scaleX=0时切换）
   - 翻转间隔200ms，翻转动画duration 400ms

2. **选中时其他卡片淡出**：
   - 点击选中一张卡片后：
     - 选中卡片放大（scale: 1→1.1→1.0，duration 300ms）
     - 选中卡片边框变为实线金色
     - 其他2张卡片淡出并向两侧滑出（alpha: 1→0，x: ±100，duration 500ms）
   - 确认动画持续800ms后触发 onSelect 回调

3. **稀有度光效**：
   - legendary 卡片有持续的金色光晕（alpha: 0.1→0.3→0.1，duration 2000ms）
   - rare 卡片有微弱的蓝色光晕（alpha: 0.05→0.15→0.05，duration 2500ms）

#### 验收标准
- [ ] 卡片有翻转动画（背面→正面）
- [ ] 3张卡片依次翻转
- [ ] 选中时其他卡片淡出+滑出
- [ ] 选中卡片有放大脉冲
- [ ] legendary 卡片有金色光晕
- [ ] rare 卡片有蓝色光晕
- [ ] 不破坏现有 show/hide 逻辑

### 4.6 RandomEventSystem — 随机事件系统打磨

#### 当前状态
- 事件卡片有淡入动画
- 选项按钮有 hover 效果
- 选择后整个容器淡出

#### 打磨要求

1. **闪电图标闪烁动画**：
   - "⚡ 随机事件" 标签中的闪电图标持续闪烁
   - 实现方式：闪电 emoji 旁边的装饰图形闪烁（alpha: 0.3→1→0.3，duration 800ms）
   - 或者在卡片顶部加一条闪电形状的金色光线动画

2. **卡片入场动画增强**：
   - 卡片从中心缩放进入（scale: 0.8→1.0，alpha: 0→1，duration 400ms，ease: Back.Out）
   - 卡片边框有"通电"效果：金色光线从顶部沿边框顺时针走一圈（duration 600ms）

3. **选项 hover 效果增强**：
   - hover 时选项左侧出现一个闪烁的箭头指示器（▶，alpha: 0.5→1→0.5）
   - hover 时选项文字微微右移（x: +5px，duration 150ms）

4. **选择确认动画**：
   - 选中选项后，卡片向选中方向倾斜（rotation: ±0.05），然后整体缩小消失（scale: 1→0.8，alpha: 1→0）

#### 验收标准
- [ ] 闪电图标/装饰有闪烁动画
- [ ] 卡片有缩放入场动画
- [ ] 卡片边框有通电效果
- [ ] hover 时有箭头指示器
- [ ] hover 时文字微右移
- [ ] 选择后有倾斜+缩小消失动画
- [ ] 不破坏现有 tryTrigger/_showEvent/_selectChoice 逻辑

### 4.7 EndingScene — 结局界面打磨

#### 当前状态
- 结局标题从上方滑入
- 属性条有填充动画
- 成就列表逐个淡入

#### 打磨要求

1. **结局名称逐字显示**：
   - 结局标题逐字出现（类似打字机效果，每个字间隔100ms）
   - 每个字出现时有微弱的缩放脉冲（scale: 1.2→1.0，duration 150ms）
   - 逐字显示完成后，金色光晕出现

2. **属性条填充动画增强**：
   - 填充条从0开始填充，填充过程中有"能量波"效果（填充前沿有一个高亮区域）
   - 填充完成时有一个"满格闪烁"效果（alpha: 1→0.5→1，duration 300ms，repeat 2次）
   - 数值文字在填充完成后弹出显示（scale: 0→1.2→1.0，duration 300ms）

3. **结局描述淡入**：
   - desc 文字逐行淡入（每行 delay 200ms）
   - quote 文字从下方滑入（y: +20→0，alpha: 0→1，duration 500ms）

4. **整体节奏控制**：
   - 标题逐字显示：0-1500ms
   - 描述淡入：1500-2500ms
   - 属性条填充：2500-4500ms
   - quote 滑入：4500-5000ms
   - 成就展开：5000ms+
   - 按钮出现：6000ms+

#### 验收标准
- [ ] 结局标题逐字显示
- [ ] 每个字有缩放脉冲
- [ ] 属性条有能量波效果
- [ ] 属性条填充完成有闪烁
- [ ] 数值文字弹出显示
- [ ] 描述逐行淡入
- [ ] quote 从下方滑入
- [ ] 整体节奏合理（不超过7秒全部显示完）
- [ ] 不破坏现有分享和重玩逻辑

---

## 5. 数据结构参考

### 5.1 Phaser 3 Tween API 参考

本项目使用 Phaser 3.80，tween API 如下：

```javascript
// 基本 tween
this.tweens.add({
  targets: gameObject,
  alpha: { from: 0, to: 1 },     // 淡入
  x: { from: -100, to: 200 },    // 滑入
  scaleX: { from: 0, to: 1 },    // 缩放
  duration: 300,                   // 持续时间 ms
  delay: 100,                      // 延迟 ms
  ease: 'Back.Out',               // 缓动函数
  yoyo: true,                      // 往返
  repeat: -1,                      // 无限重复
  onUpdate: () => {},              // 每帧回调
  onComplete: () => {},            // 完成回调
  onRepeat: () => {},              // 重复回调
});

// 常用缓动函数
// 'Linear', 'Quad.easeIn/Out', 'Cubic.easeIn/Out',
// 'Back.easeIn/Out', 'Bounce.easeIn/Out',
// 'Sine.easeInOut', 'Power2'
```

### 5.2 项目色板（来自 config.js）

```javascript
export const COLORS = {
  bg: 0x0A0A0A,        // 近纯黑
  panel: 0x12122A,      // 深蓝黑
  accent: 0xF0C040,     // 金色（强调）
  text: 0xE8D5A3,       // 暖白
  textDim: 0x8A7A5A,    // 暗金
  danger: 0xE04040,     // 红色
  success: 0x40C040,    // 绿色
  border: 0x2a2a4e,     // 边框
};

export const UI_COLORS = {
  cornerDecor: 0xF0C040, // 角装饰金色
};
```

### 5.3 项目字体（来自 config.js）

```javascript
export const FONTS = {
  pixel: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
  body: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
  mono: '"Courier New", monospace',
};
```

### 5.4 Depth 层级规范

| depth | 内容 |
|-------|------|
| 0 | 背景精灵/背景graphics |
| 50 | 角色精灵 |
| 100 | 前景特效(粒子/闪光) |
| 200 | 对话框容器 |
| 300 | 选项按钮容器 |
| 400 | HUD(属性面板/章节/进度条/音量) |
| 450 | 随机事件容器 |
| 500 | 天赋选择容器 |
| 1000 | 过渡遮罩 |

### 5.5 画布尺寸

```javascript
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 500;
```

### 5.6 PixelRenderer 工具方法

```javascript
// 颜色转换
PixelRenderer.toCSS(0xF0C040) // → '#f0c040'

// 四角 L 形装饰
PixelRenderer.drawCornerDecor(graphics, x, y, width, height, color, size, thickness)
```

---

## 6. 项目灵魂

> **选择没有对错，只有不同的人生。**

### UI设计原则

1. **暗色沉浸** — 近纯黑背景+金色强调，营造"命运抉择"的氛围
2. **像素风极简** — 不是复古8-bit，而是用像素语言表达现代感
3. **动画服务于叙事** — 动画不是花哨的装饰，而是增强情感体验的工具
4. **反馈即尊重** — 每个选择都有视觉反馈，让玩家感受到"选择有重量"
5. **克制而非堆砌** — 动画要微妙，不能喧宾夺主

### 动画设计原则

- **入场动画**：所有UI元素都应有入场动画，但不能太慢（总时长不超过1秒）
- **反馈动画**：交互反馈要即时（hover 150ms内，click 300ms内）
- **情感动画**：关键剧情节点可以有更长的动画（如结局逐字显示）
- **循环动画**：呼吸效果、闪烁等循环动画要微妙（alpha变化不超过0.3）
- **性能优先**：同时运行的tween不超过20个，避免卡顿
