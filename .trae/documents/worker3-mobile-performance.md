# 工作者 3：移动端体验与性能优化

## 项目背景
这是一个以罗永浩人生经历为背景的 2D 像素风互动视觉小说游戏。
技术栈：Phaser 3.80 + Vite 5，纯 Canvas 渲染，画布 800×500。
目标部署为 H5 网页，主要用户通过手机微信/浏览器访问。
项目根目录：`e:\ownWorkPlace\罗的十字路口\luohammer-pixel-game`

## 当前问题

1. **手机上按钮太小**：选项按钮和"开始游戏"按钮在手机屏幕上点击区域不够大。800×500 画布在手机横屏下实际渲染尺寸约 360×225px（按手机宽度 360dp 估算），按钮文字可能只有 6-7px 实际显示大小，手指很难点中。

2. **触摸事件没有反馈**：按钮没有 touch 反馈，玩家点击后不知道是否点中了，可能重复点击。

3. **竖屏体验差**：虽然有竖屏提示，但提示内容太简陋（只有文字），且没有提供"继续竖屏玩"的选项。

4. **Service Worker 缓存策略不够好**：当前 sw.js 在 install 时缓存了 HTML 和 manifest，但 JS/CSS 等动态资源没有缓存，离线时无法完整运行。

5. **字体加载可能阻塞**：Press Start 2P 和 Noto Sans SC 从 CDN 加载，如果网络慢，游戏可能先显示为系统字体再闪烁切换。

6. **Canvas 渲染性能**：70 个剧情节点意味着大量 fillRect 调用，在低端手机上可能出现掉帧。

## 目标状态
1. 所有可点击元素在手机上的触摸区域 ≥ 44×44px（Apple HIG 标准）
2. 触摸有视觉反馈（按下变暗/缩放）
3. 竖屏提示更友好，提供"继续游玩"选项
4. Service Worker 缓存所有资源，离线可玩
5. 字体加载不阻塞游戏启动
6. 低端手机上帧率 ≥ 30fps

## 你要修改的文件
1. `src/systems/ChoiceSystem.js` — 加大按钮触摸区域
2. `src/scenes/BootScene.js` — 加大按钮触摸区域 + 触摸反馈
3. `index.html` — 竖屏提示优化 + 字体加载策略
4. `public/sw.js` — 缓存策略优化
5. `src/main.js` — 性能优化（只读检查，必要时微调）

## 具体要求

### 1. ChoiceSystem.js — 按钮触摸优化
- 每个选项按钮的 hitArea 扩大到至少 44px 高度（当前可能只有 20-30px）
- 在按钮 container 上加 `setInteractive({ useHandCursor: true })`
- 加触摸反馈：pointerdown 时 container alpha=0.7，pointerup 恢复 1.0
- 选项文字 fontSize 从 13px 改为 14px（手机上更清晰）

### 2. BootScene.js — 按钮触摸优化
- "开始游戏"和"继续游戏"按钮的 hitArea 扩大到至少 44×44px
- 加触摸反馈：pointerdown 时 container scale=0.95，pointerup 恢复 1.0
- 按钮文字 fontSize 从 10px 改为 11px

### 3. index.html — 竖屏提示 + 字体优化

竖屏提示改为：
```html
<div id="rotate-hint">
  <div class="icon">📱↔️</div>
  <div class="title">横屏体验更佳</div>
  <div class="text">请旋转手机至横屏模式</div>
  <button id="rotate-continue" onclick="document.getElementById('rotate-hint').style.display='none'">
    继续竖屏游玩
  </button>
</div>
```
加对应 CSS：
```css
#rotate-hint .title { font-size: 18px; color: #f0c040; margin-bottom: 10px; font-family: 'Noto Sans SC', monospace; }
#rotate-hint button { 
  margin-top: 20px; padding: 10px 24px; background: #f0c040; color: #0a0a0a; 
  border: none; font-family: 'Noto Sans SC', monospace; font-size: 14px; cursor: pointer;
}
```

字体加载优化：在 link 标签加 `media="print" onload="this.media='all'"`，实现非阻塞加载：
```html
<link href="https://fonts.loli.net/css2?family=Press+Start+2P&family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
```

### 4. sw.js — 缓存策略优化
改为缓存所有 GET 请求的资源（stale-while-revalidate 策略）：
```javascript
const CACHE_NAME = 'luohammer-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './index.html', './manifest.json']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
```

### 5. 性能优化检查
- Read main.js，确认 Phaser 配置中 `antialias: false`（像素风不需要抗锯齿）
- 确认 `pixelArt: true` 在 game config 中
- 如果没有，添加：
  ```javascript
  antialias: false,
  pixelArt: true,
  roundPixels: true
  ```

### 不能做
1. 不要修改 story.js
2. 不要修改 PixelRenderer.js（另一个工作者在检查）
3. 不要修改 config.js
4. 不要改变画布尺寸（保持 800×500）
5. 不要引入新的 npm 依赖

## 验证标准
1. `npm run build` 无报错
2. 手机 Chrome DevTools 模拟器中，按钮触摸区域 ≥ 44px
3. 触摸按钮有视觉反馈
4. 竖屏提示有"继续游玩"按钮
5. 字体加载不阻塞页面渲染
6. Service Worker 缓存所有资源，离线可访问
