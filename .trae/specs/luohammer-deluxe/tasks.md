# Tasks

- [ ] Task 1: 打字机逐字显示 + 跳过机制
  - [ ] SubTask 1.1: 实现打字机引擎（setInterval 逐字追加，25ms/字，HTML 标签识别保护）
  - [ ] SubTask 1.2: 打字期间禁用选项按钮（灰色不可点）
  - [ ] SubTask 1.3: 点击故事面板立即完成打字 + 解锁按钮
  - [ ] SubTask 1.4: 打字完成后延迟 300ms 淡入历史对照卡

- [ ] Task 2: CRT 转场动画
  - [ ] SubTask 2.1: 实现 CRT 关机效果（白色闪烁 100ms + 黑屏 200ms）
  - [ ] SubTask 2.2: 实现 CRT 开机效果（亮度渐变 + 水平扫描线展开，300ms）
  - [ ] SubTask 2.3: 将转场集成到 makeChoice 流程中（串行：转场 → 渲染 → 打字机）

- [ ] Task 3: 8-bit 音效系统
  - [ ] SubTask 3.1: 封装 AudioContext + 方波/三角波合成函数
  - [ ] SubTask 3.2: 实现选择确认音效（440→880Hz 滑音，80ms）
  - [ ] SubTask 3.3: 实现成就解锁音效（C5-E5-G5 三音阶，180ms）
  - [ ] SubTask 3.4: 实现结局音效（C4-E4-G4-C5 琶音，600ms）
  - [ ] SubTask 3.5: 右上角音效开关按钮 + localStorage 持久化

- [ ] Task 4: 决策回顾面板（结局展示）
  - [ ] SubTask 4.1: 追踪每次选择的记录数组（节点名 + 选项文本 + 历史选择 + 是否一致）
  - [ ] SubTask 4.2: 结局画面下方渲染决策回顾表格
  - [ ] SubTask 4.3: 一致/不一致标记（绿 ✓ / 红 ✗）+ 一致率统计
  - [ ] SubTask 4.4: ASCII-art 风格决策路径图

- [ ] Task 5: Canvas 分享卡生成
  - [ ] SubTask 5.1: 分享卡布局设计（800×500 Canvas：结局标题 + 属性条形图 + 金句 + 占位区）
  - [ ] SubTask 5.2: Canvas 渲染函数 + 导出 PNG blob
  - [ ] SubTask 5.3: "生成分享卡"按钮 + <img> 显示（支持右键另存）

- [ ] Task 6: localStorage 存档 + 粒子背景
  - [ ] SubTask 6.1: 每次选择后自动存档到 localStorage
  - [ ] SubTask 6.2: 页面加载时检测存档 → 弹出"继续/新游戏"提示
  - [ ] SubTask 6.3: Canvas 背景粒子系统（30个 2×2 金色像素粒子漂浮）
  - [ ] SubTask 6.4: 重启时清除旧存档

- [ ] Task 7: 隐藏成就系统
  - [ ] SubTask 7.1: 4 个隐藏成就条件判定（平行宇宙/老罗附体/速通玩家/再来亿次）
  - [ ] SubTask 7.2: 隐藏成就特殊动画（金色闪烁边框 + 特殊音效）

- [ ] Task 8: 整体集成测试 + 回归验证基础版所有功能

# Task Dependencies
- Task 2 依赖 Task 1（转场后启动打字机）
- Task 4 依赖 Task 2（决策记录在 makeChoice 中采集）
- Task 3, 5, 6, 7 可并行开发
- Task 8 依赖 Task 1-7 全部完成