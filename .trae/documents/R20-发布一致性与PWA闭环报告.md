# R20 · 发布一致性与 PWA 闭环报告

日期：2026-07-23

## SCAN

官方复赛指南要求软件作品具备可由评委直接访问、流程稳定、可反复操作的真实体验入口。
本轮将“仓库代码通过”与“评委实际拿到当前版本”拆成两个独立验收面。

只读检查现有 GitHub Pages：

| 项目 | 线上 | 当前本地构建 | 结论 |
|---|---|---|---|
| HTTP 状态 | 200 | 生产构建成功 | 入口存活 |
| HTML 大小 | 142,411 bytes | 167.34 kB | 内容不一致 |
| 业务入口 | `index-D26ZcqiY.js` | `index-DxxaLVRL.js` | 线上为旧构建 |
| Service Worker | `v4` | `v5-network-first` | 线上尚未获得本轮修复 |

同时发现旧 `sw.js` 对所有同源请求使用 cache-first，且缓存版本长期固定为 `v4`。
已经访问过作品的评委可能持续收到旧 `index.html`，即使新产物已经上传。

## IMPLEMENT

1. 导航请求改为 network-first；联网时绕开 HTTP 缓存取当前 HTML，离线时回退最近成功缓存。
2. Vite 内容哈希 JS/CSS 保持 cache-first，避免重复下载 Phaser 大包。
3. 固定文件名图片、manifest 改为 stale-while-revalidate。
4. Service Worker 安装时读取构建后的 `index.html`，动态发现并预缓存当前 hash 的业务入口和 Phaser chunk。
5. 注册时使用 `updateViaCache: none` 并主动执行 `registration.update()`；已有控制器更新后自动刷新一次。
6. 新增 `npm run verify:deployment`，比较本地 `dist` 与线上业务入口 hash、SW 版本，不一致即失败。
7. 修正 `DEPLOY.md` 中与实际 GitHub Pages 子路径冲突的 `base` 说明。

## VERIFY

| 通道 | 结果 |
|---|---|
| Service Worker 行为测试 | 5/5：首次应用壳、导航取新、离线回退、哈希缓存、固定资源后台更新 |
| Vitest | 13 files，304/304 tests passed |
| ESLint | 0 warning |
| JavaScript 语法 | `sw.js`、`verify-deployment.mjs` 均通过 `node --check` |
| validate-story | 214/214 可达，0 error / 0 warning |
| simulate-paths | 13 种策略全部终止 |
| validate-effects | 599 条 effects 扫描通过 |
| Vite build | 通过；业务入口 642.96 kB（gzip 336.94 kB） |
| 发布校验器自检 | 对本地生产站点正确识别 hash 与 `v5-network-first`，返回通过 |
| Edge 生产走查 | 首次安装缓存 7 项应用壳；停掉服务器后刷新，标题页完整启动、主按钮可见、控制台 0 error |

## SETTLE

- 本地 P0“旧缓存阻断新版”已修复。
- 线上体验入口仍是旧构建，必须在发布后再次运行 `npm run verify:deployment`，通过前不能声明复赛版本已经上线。
- 本轮未直接改写或推送 `gh-pages`，避免未经确认覆盖当前公开体验入口。
