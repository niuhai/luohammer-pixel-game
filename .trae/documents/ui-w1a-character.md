# W1-a：角色绘制优化

## 项目背景
这是一个以罗永浩人生经历为背景的 2D 像素风互动视觉小说游戏。
技术栈：Phaser 3.80 + Vite 5，纯 Canvas 渲染（graphics.fillRect）。
画布尺寸：800×500。
项目根目录：`e:\ownWorkPlace\罗的十字路口\luohammer-pixel-game`

## 当前问题
角色太小（约12px宽），没有黑框眼镜等老罗特征，在800×500画布上几乎看不清。

## 参考图（必须看）
- `assets/characters/luo-standing.png` — 正面站立
- `assets/characters/luo-speaking.png` — 演讲举手
- `assets/characters/luo-angry.png` — 愤怒举锤
- `assets/characters/luo-depressed.png` — 沮丧低头
- `assets/characters/luo-livestream.png` — 直播指镜头
- `assets/characters/luo-young.png` — 年轻版蓝衬衫
- `assets/characters/luo-sitting.png` — 坐姿
- `assets/characters/luo-middle.png` — 中年版

视觉规范：`.trae/documents/visual-design-spec.md`

## 你要修改的文件
`src/systems/PixelRenderer.js` — 只修改 `_drawChar(g, pose)` 这一个方法

## 具体要求

### 角色放大
- 从当前约 12px 宽 → **24-32px 宽**（占画布宽度 3-4%）
- 高度从约 40px → **60-70px 高**（占画布高度 12-14%）
- baseY 调整到 **300**（脚底位置）

### 黑框眼镜（最关键！必须清晰可见）
参考 `luo-standing.png`：
- 镜框：2px 粗深色矩形（#1A1A1A），左右各一个
- 镜片：深色半透明（#2A2A4E）
- 反光点：每个镜片内 2×2 白色像素点（#FFFFFF）
- 鼻梁：2px 连接线横跨两镜框之间
- 镜腿：两侧各一条短线向下延伸

### 脸部特征（参考图）
- 圆脸微胖：头部宽 24-28px，高 20-22px
- 寸头：头顶 4-8px 深色区域，两侧露出耳朵（肤色 4×4 方块）
- 嘴巴：根据姿态变化（微笑/张嘴/抿嘴）
- 下巴：圆润

### 身体特征
- 黑衬衫（参考图中是有领子的）：上半身深色 #1A1A1A
- 领口：V 形缺口（2px 深）
- 裤子：下半身 #2A2A3E
- 鞋子：#0A0A0A
- 轮廓线：头部和身体外圈加 2px #0A0A0A 深色轮廓

### 8 种姿态（每种对应一张参考图）

| pose | 参考图 | 关键差异 |
|---|---|---|
| standing | luo-standing.png | 双手自然下垂 |
| sitting | luo-sitting.png | 加椅子（简单矩形），身体缩短 |
| speaking | luo-speaking.png | 右手高举过肩 |
| angry | luo-angry.png | 双手握拳或举锤，眉毛下压 |
| depressed | luo-depressed.png | 头部下移4px，肩膀垮塌 |
| livestream | luo-livestream.png | 一只手指向前方 |
| young | luo-young.png | 更瘦（宽-4px），蓝衬衫 #2A3A5A |
| middle | luo-middle.png | 更胖（宽+4px） |

### 代码结构要求
```javascript
_drawChar(g, pose) {
  const cx = 400;        // 角色中心X
  const baseY = 300;      // 角色脚底Y
  
  // 颜色定义
  const skin = 0xF0C8A0;
  const hair = 0x1A1A1A;
  // ... 其他颜色
  
  // 绘制顺序：身体→腿部→手臂→头部（头部最后画在最上层）
  
  if (pose === 'standing') {
    // 绘制 standing 姿态
    this._drawBodyStanding(g, cx, baseY);
    this._drawArmsStanding(g, cx, baseY);
    this._drawHead(g, cx, baseY - bodyHeight);
  } else if (pose === 'speaking') {
    // ...
  }
  // ... 8种姿态
}
```

### 像素网格
- 所有 fillRect 的宽高必须是 **4 的倍数**
- 文件顶部定义 `const G = 4;`
- 坐标也尽量对齐到 G 的倍数

### 不能做
1. 不要修改 drawScene 方法
2. 不要修改 drawClassroom / drawLecture 等任何场景方法
3. 不要修改 config.js
4. 不要修改 GameScene.js
5. 不要使用图片资源（保持纯 fillRect）

## 验证标准
1. `npm run build` 无报错
2. 8种姿态都能看到黑框眼镜
3. 角色不超出画布边界（X: 0-800, Y: 0-500）
4. 所有 fillRect 尺寸是 4 的倍数
5. 角色和参考图风格一致（圆脸、寸头、黑衬衫、黑框眼镜）
