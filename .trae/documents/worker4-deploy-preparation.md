# 工作者 4：部署准备与最终构建验证

## 项目背景
这是一个以罗永浩人生经历为背景的 2D 像素风互动视觉小说游戏。
技术栈：Phaser 3.80 + Vite 5，纯 Canvas 渲染，画布 800×500。
目标：部署为 H5 网页，国内用户可通过微信/浏览器访问。
部署平台：Cloudflare Pages（首选）或 Vercel。
项目根目录：`e:\ownWorkPlace\罗的十字路口\luohammer-pixel-game`

## 当前问题

1. **构建产物未验证**：之前多次并行修改后，虽然 `npm run build` 通过了，但没有完整验证 dist/ 产物是否能在静态服务器上正常运行。

2. **缺少 og-image.png**：index.html 中引用了 `./og-image.png` 作为微信分享缩略图，但这个文件不存在。微信分享时会显示空白或默认图标。

3. **vite.config.js 可能需要优化**：当前配置很基础，没有做代码分割、压缩优化等。

4. **缺少部署配置文件**：没有 Cloudflare Pages 的 `_redirects` 或 `_headers` 文件，可能导致 SPA 路由问题和缓存策略不当。

5. **PWA 图标可能缺失**：manifest.json 引用了 icon-192.png 和 icon-512.png，需要确认它们存在且正确。

6. **.gitignore 可能不完整**：需要确认 dist/ 和 node_modules/ 被正确排除。

## 目标状态
1. `npm run build` 产物完整可用，在静态服务器上正常运行
2. og-image.png 存在且尺寸正确（1200×630，微信推荐尺寸）
3. vite.config.js 有合理的构建优化
4. Cloudflare Pages 部署配置就绪
5. PWA 图标存在且正确
6. .gitignore 完整

## 你要修改/创建的文件
1. `vite.config.js` — 构建优化
2. `public/og-image.png` — 微信分享缩略图（用脚本生成）
3. `public/_redirects` — Cloudflare Pages 路由配置
4. `public/_headers` — Cloudflare Pages 缓存策略
5. `.gitignore` — 确认完整性
6. `DEPLOY.md` — 部署指南

## 具体要求

### 1. vite.config.js 构建优化
Read 当前文件，然后更新为：
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    // 代码分割：将 phaser 单独打包
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    },
    // 压缩选项
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,  // 保留 console，方便调试
        drop_debugger: true
      }
    },
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 1000
  }
});
```

### 2. 生成 og-image.png
创建脚本 `generate-og-image.html` 在项目根目录，用 Canvas 绘制 1200×630 的分享图：
- 背景：深色（#0a0a0a）
- 主标题："真还传"（大字，金色 #f0c040，像素风）
- 副标题："创业模拟器"（中字，白色）
- 底部小字："以罗永浩人生经历为背景的像素风互动游戏"
- 左侧：像素风老罗头像（黑框眼镜）
- 右侧：像素风手机屏幕截图示意

用浏览器打开后右键保存为 `public/og-image.png`。

如果无法生成实际 PNG 文件，则创建一个 1×1 的占位 PNG 并在 DEPLOY.md 中说明需要替换。

### 3. Cloudflare Pages 配置
创建 `public/_redirects`：
```
/* /index.html 200
```

创建 `public/_headers`：
```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/sw.js
  Cache-Control: public, max-age=0, must-revalidate

/manifest.json
  Cache-Control: public, max-age=3600
```

### 4. 确认 PWA 图标
检查 `public/icon-192.png` 和 `public/icon-512.png` 是否存在。如果不存在，用之前创建的 `generate-icons.html` 生成。

### 5. 确认 .gitignore
Read `.gitignore`，确认包含：
```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
Thumbs.db
```

### 6. 创建 DEPLOY.md
```markdown
# 部署指南

## Cloudflare Pages（推荐）

### 方式一：连接 GitHub 仓库
1. 将项目推送到 GitHub
2. 登录 Cloudflare Dashboard → Pages → Create a project
3. 连接 GitHub 仓库
4. 构建设置：
   - 构建命令：`npm run build`
   - 输出目录：`dist`
   - Node.js 版本：18
5. 点击部署

### 方式二：直接上传
1. 本地构建：`npm run build`
2. 登录 Cloudflare Dashboard → Pages → Create a project → Direct Upload
3. 上传 `dist/` 目录

## Vercel

### 方式一：连接 GitHub 仓库
1. 将项目推送到 GitHub
2. 登录 Vercel → New Project → Import Git Repository
3. 构建设置：
   - Framework Preset：Vite
   - 构建命令：`npm run build`
   - 输出目录：`dist`
4. 点击部署

### 方式二：CLI
```bash
npm i -g vercel
cd luohammer-pixel-game
vercel --prod
```

## 自定义域名
部署后在平台设置中添加自定义域名，配置 DNS 解析。

## 微信分享配置
微信分享需要配置 JS-SDK 或使用微信开放标签。当前使用 og 标签方式，
在微信内打开链接时会自动抓取 og:title、og:description、og:image。
确保 og:image 的 URL 是完整的 HTTPS 地址。

## 更新部署
每次修改代码后：
1. `npm run build`
2. 如果连接了 GitHub，push 后自动部署
3. 如果是直接上传，重新上传 dist/ 目录
```

### 7. 最终构建验证
1. 运行 `npm run build`
2. 检查 `dist/` 目录内容：
   - index.html 存在
   - assets/ 目录下有 JS 文件
   - manifest.json 存在
   - sw.js 存在
   - icon-192.png 存在
   - icon-512.png 存在
   - og-image.png 存在
   - _redirects 存在
   - _headers 存在
3. 运行 `npx serve dist` 启动本地服务器
4. 浏览器打开 http://localhost:3000 验证游戏可运行

### 不能做
1. 不要修改 src/ 下的任何源码文件
2. 不要修改 story.js
3. 不要修改 package.json 的 dependencies
4. 不要执行 git commit 或 git push
5. 不要安装新的 npm 依赖（terser 是 Vite 内置的）

## 验证标准
1. `npm run build` 无报错
2. `dist/` 目录包含所有必要文件
3. `npx serve dist` 后游戏可正常运行
4. DEPLOY.md 内容完整，覆盖 Cloudflare Pages 和 Vercel 两种部署方式
5. _redirects 和 _headers 配置正确
6. og-image.png 存在
