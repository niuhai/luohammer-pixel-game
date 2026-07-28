# 前端持续优化循环

这套机制把前端优化接入项目现有的 `.iteration` 状态机。目标不是无限改样式，
而是持续产出可验证的体验增量，同时避免风格漂移、移动端退化和测试全绿但画面变差。

## 单轮状态机

`PREFLIGHT → OBSERVE → PRIORITIZE → CONTRACT → IMPLEMENT → VERIFY → SETTLE → NEXT`

### 1. PREFLIGHT

- 读取 `.iteration/state.yaml`、本文件和 `.iteration/ui/backlog.json`。
- 执行 `npm run iterate:ui`，确认下一轮编号、冻结区和最高优先级任务。
- 检查工作区，保留用户与其他轮次的未提交修改。

### 2. OBSERVE

- 浏览真实页面，而不是仅阅读 CSS。
- 桌面主验收：Chromium 1440×900。
- 手机护栏：Chromium 390×844、375×812。
- 动效任务必须覆盖开始帧、中间帧和完成帧。
- 记录问题出现在哪个用户动作、哪个视口、造成什么理解或操作成本。

### 3. PRIORITIZE

队列按以下分数排序：

`priority = impact × confidence ÷ effort`

- `impact`：对核心十分钟体验的影响，1–5。
- `confidence`：现有证据支持程度，1–5。
- `effort`：完成实现和验证的相对成本，1–5。
- 同分时优先核心路径，其次优先证据更新更旧的区域。
- `frozen` 项目不进入排序，除非用户证据明确重新开放。

### 4. CONTRACT

每轮只允许一个主任务和最多两个支撑任务，并在 `runs/Rxxx.md` 写明：

- 当前可观察问题；
- 用户结果假设；
- 不改变什么；
- 桌面与移动端验收条件；
- 回退条件；
- 所需证据。

### 5. IMPLEMENT

- 优先改交互结构、状态反馈和信息层级，再做纯装饰。
- 复用现有设计语言、token、组件与探针。
- 不用换风格掩盖可读性或流程问题。
- 动画必须有稳定终态，并兼容 `prefers-reduced-motion`。

### 6. VERIFY

验证分三级：

| 级别 | 命令 | 使用时机 |
|---|---|---|
| L1 | `npm run iterate:ui:verify:quick` | 机制、文案或低风险样式检查 |
| L2 | `npm run iterate:ui:verify` | 每一轮最低结算门槛 |
| L3 | `npm run iterate:ui:verify:full` | 流程、焦点、响应式或跨屏幕变化 |

L2 包含 lint、全量 unit 和 production build。L3 额外包含 Playwright E2E。
自动化通过只能证明护栏稳定，不能代替视觉前后对照。

### 7. SETTLE

只有满足以下条件才能标记 `IMPROVED`：

- Outcome Contract 的用户结果已在真实页面中出现；
- 至少一组桌面前后证据和一组手机护栏证据；
- 自动化验证达到该任务要求的最低级别；
- 没有已知更严重的回归；
- 结果、证据路径和遗留问题写入 `runs/Rxxx.md`。

否则结算为：

- `NEUTRAL`：护栏稳定，但没有足够证据证明体验提升；
- `REGRESSED`：任一核心护栏退化，必须回退或进入修复轮；
- `BLOCKED`：只有外部条件反复阻止推进时使用。

### 8. NEXT

- 更新 `.iteration/ui/backlog.json` 的状态和证据时间。
- 更新 `.iteration/state.yaml` 的 `round_next`。
- `npm run iterate:ui` 必须能立即给出下一项可执行任务。
- 连续三轮 `NEUTRAL` 时停止扩大改动，重新观察和校准优先级。

## 固定护栏

- 不覆盖用户未提交修改。
- 序章 FREEZE 未解除前不主动改动。
- 桌面提升不得牺牲 390×844 与 375×812 的完整可操作性。
- 点击目标不小于 44×44 CSS px；键盘焦点和语义状态不得退化。
- 不以动画时长、代码量或测试数量代替用户结果。
- 历史截图只读，新证据放入新的轮次目录。

## 命令入口

```text
npm run iterate:ui
npm run iterate:ui:start
npm run iterate:ui:verify
npm run iterate:ui:verify:full
node scripts/ui-iteration.mjs close --outcome=IMPROVED --summary="..." --evidence="path-a,path-b"
```

`start` 会创建当前轮次合同并激活队列任务。`close` 需要通过的验证证据和
真实视觉证据；成功后会结算当前任务、推进轮次并释放下一项任务。
若当前环境的 npm 包装器不可用，可直接使用
`node scripts/ui-iteration.mjs <status|start|verify|close>`。
