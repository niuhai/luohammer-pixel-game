# 部署指南 · 真还传

本文档介绍如何将「真还传 · 创业模拟器」部署到互联网。

## 本地构建验证

### 1. 安装依赖
```bash
npm install
```

### 2. 生产构建
```bash
npm run build
```

构建产物输出到 `dist/` 目录。包含：
- `index.html` - 入口 HTML
- `assets/` - 打包后的 JS/CSS（Phaser 单独分块）
- `icon-192.png` / `icon-512.png` - PWA 图标
- `og-image.png` - 微信/社交分享缩略图 (1200x630)
- `manifest.json` - PWA 清单
- `sw.js` - Service Worker
- `_headers` - 缓存策略配置
- `_redirects` - SPA 路由回退配置

### 3. 本地预览
```bash
npx serve dist
```

然后在浏览器访问 `http://localhost:3000`。

---

## 部署方案一：Cloudflare Pages（推荐）

### 方式 A：连接 Git 仓库（自动部署）

1. 将项目推送到 GitHub/GitLab
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages → "Create a project"
3. 选择 "Connect to Git"，授权并选择项目仓库
4. 构建设置：
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js version**: 18 或更高
5. 点击 "Save and Deploy"
6. 每次 git push 到 main 分支会自动触发部署

### 方式 B：直接上传（手动）

1. 本地构建：`npm run build`
2. 登录 Cloudflare Dashboard → Pages → "Create a project" → "Direct Upload"
3. 拖拽上传 `dist/` 目录
4. 填写项目名称 → "Deploy"

### 方式 C：Wrangler CLI 部署

```bash
npm run build
npx wrangler pages deploy dist --project-name=luohammer
```

首次部署会提示登录 Cloudflare 账号并选择项目，后续直接执行上述命令即可更新。

### 配置自定义域名
1. Pages 项目 → "Custom domains" → "Set up a custom domain"
2. 填写域名（如 `zhenhuan.example.com`）
3. 按提示在 DNS 服务商添加 CNAME 记录
4. 等待 Cloudflare 自动配置 HTTPS

---

## 部署方案二：Vercel

### 方式 A：连接 Git 仓库

```bash
# 1. 将代码推送到 GitHub/GitLab
# 2. 登录 vercel.com → New Project
# 3. 选择仓库 → Import
# 4. Framework Preset: Vite
# 5. Build Command: npm run build
# 6. Output Directory: dist
# 7. Deploy
```

### 方式 B：CLI 部署
```bash
npm install -g vercel
cd luohammer-pixel-game
vercel           # 首次部署（预览环境）
vercel --prod    # 部署到生产环境
```

---

## 部署方案三：Netlify

### 方式 A：直接拖拽
1. 构建：`npm run build`
2. 打开 https://app.netlify.com/drop
3. 拖拽 `dist/` 目录到页面
4. 完成！

### 方式 B：Netlify CLI
```bash
npm install -g netlify-cli
netlify deploy --dir=dist --prod
```

---

## 部署方案四：静态托管（GitHub Pages / 任意 Nginx）

### GitHub Pages

```bash
npm run build
# 将 dist/ 推送到 gh-pages 分支
# 或使用第三方工具如 gh-pages npm 包
```

注意：本游戏使用站点根路径部署（vite.config.js 中 `base: '/'`），
如需部署到子路径，请将 `base` 改为对应子路径（如 `'/luohammer/'`）并重新构建。

### Nginx 配置示例

```nginx
server {
    listen 443 ssl;
    server_name zhenhuan.example.com;

    root /var/www/zhenhuan/dist;
    index index.html;

    # 基础安全头
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" always;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源强缓存（文件名包含内容哈希）
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 不缓存
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Service Worker 不缓存
    location = /sw.js {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Manifest 短缓存 1 小时
    location = /manifest.json {
        add_header Cache-Control "public, max-age=3600, must-revalidate";
    }
}
```

---

## 微信分享优化

当前项目已配置好 Open Graph 标签（见 `index.html`）：
- `og:title`: 真还传 · 创业模拟器
- `og:description`: 以罗远人生经历为背景的像素风互动游戏...
- `og:image`: `./og-image.png`（1200x630 像素风分享图）

### 在微信内分享注意事项

1. **域名必须备案**：微信内分享需要使用已备案的国内域名
2. **图片可访问**：确保 `og-image.png` 能被微信的爬虫抓取
3. **完整的图片 URL**：如果 `index.html` 中的相对路径在某些环境下失效，
   可以改成绝对路径：`https://your-domain.com/og-image.png`

---

## PWA 配置说明

项目配置了基础的 PWA 支持：

| 文件 | 用途 |
|------|------|
| `public/manifest.json` | PWA 清单，定义应用名称、图标、启动方式 |
| `public/sw.js` | Service Worker，支持离线访问 |
| `public/icon-192.png` | 192x192 应用图标 |
| `public/icon-512.png` | 512x512 应用图标 |

用户在支持的浏览器中可「添加到主屏幕」，之后可离线游玩。

---

## 构建优化说明（vite.config.js）

当前配置的优化项：

```javascript
{
  base: '/',                          // 站点根路径部署
  build: {
    target: 'es2015',                 // 兼容较低版本浏览器
    minify: 'terser',                 // 使用 terser 深度压缩
    terserOptions: {
      compress: {
        drop_console: true,           // 生产环境移除所有 console.log
        drop_debugger: true           // 移除 debugger 语句
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']          // 将 Phaser 独立打包，便于缓存
        }
      }
    },
    chunkSizeWarningLimit: 2000       // 2000KB 警告阈值（Phaser 独立 chunk 约 1.5MB）
  }
}
```

## 静态托管头文件说明

生产构建会将 `public/` 下的以下文件原样复制到 `dist/`，供静态托管平台使用：

| 文件 | 作用 |
|------|------|
| `_headers` | 安全响应头 + 缓存策略（Cloudflare Pages / 部分平台原生支持） |
| `_redirects` | SPA 路由回退：`/* /index.html 200` |

`_headers` 核心规则：

- 所有响应附加基础安全头：`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy`。
- `*.html` 与 `sw.js` 不缓存，保证新版本立即生效。
- `/assets/*` 长期缓存一年（资源文件名已包含内容哈希）。
- `manifest.json` 短缓存 1 小时。

对于 Nginx 等自定义服务器，请对照上方的 [Nginx 配置示例](#nginx-配置示例) 设置等效的安全头和缓存策略。

---

## 常见问题

### Q: 构建后 JS 单文件太大？
A: 已通过 `manualChunks: { phaser: ['phaser'] }` 将 Phaser 单独打包。Phaser 本身约 700KB（压缩后 ~200KB），对于像素风游戏这是可接受的。

### Q: 部署后刷新 404？
A: SPA 需要配置路由回退。Cloudflare Pages 的 `_redirects` 文件已包含 `/* /index.html 200`。其他部署方案请参考上方对应配置。

### Q: 微信分享卡片空白？
A: 检查：1) 域名是否备案；2) `og-image.png` 是否可访问；3) 图片 URL 是否为完整 HTTPS 地址（某些平台需要绝对路径）。

### Q: 如何重新生成分享图？
A: 运行 `node scripts/generate-og-image.cjs`，脚本会自动绘制并写入 `public/og-image.png`。

---

## 下一步建议

- [ ] 配置自定义域名
- [ ] 配置 Google Analytics / 百度统计（可选）
- [ ] 在真机上测试微信分享效果
- [ ] 验证 PWA 离线安装功能
