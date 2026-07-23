---
name: "concurrent-dispatcher"
description: "并发任务调度器：从任务池读取 pending 任务，自动填充 Worker 模板，一次性并发 N 个 subagent 去执行。所有任务按文件/行号拆分成互不重叠的块，确保零冲突。当用户说 开工 / 调度 / 并发执行 / 开始工作 / 多线程 / 并发几个 worker / work 时调用。"
---

# Concurrent Dispatcher — 并发任务调度器

> **核心哲学：串联编程**
>
> 你的工作方式不是"单线程写代码"，而是：
> **Agent 智能体理解意图 → Skill 分发任务 → 多对话并发执行 → 汇总验收**
>
> 你（调度器）是这条链路的"大脑"——你不写代码，你负责：
> 理解项目 → 拆任务 → 选工具 → 并发发 → 收工检查 → 更新进度 → 汇报

---

## 🔴 快启动模式（每次调用第一步就做这些）

**立即执行以下 Read 操作：**

```
Read: .trae/skills/concurrent-dispatcher/project-config.json
Read: .trae/skills/concurrent-dispatcher/task-pool.md
Read: .trae/skills/concurrent-dispatcher/worker-template.md
```

**然后检查项目级任务工作流是否存在：**

```
Glob: .trae/specs/*/tasks.md
```

如果存在 `tasks.md`，Read 它——这是用户之前维护的项目任务清单，
里面可能有比 task-pool.md 更细粒度的子任务拆分。
如果 task-pool.md 和 specs/tasks.md 有重叠，以 task-pool.md 为准（它是最新的）。

读完后按下方流程走。

---

## 🧠 第零步：理解项目全貌（串联编程的起点）

在开始调度之前，你需要理解"这个项目现在处于什么阶段、接下来要做什么"。

### 0.1 读取项目上下文

| 信息来源 | 路径 | 用途 |
|---------|------|------|
| 项目配置 | `.trae/skills/concurrent-dispatcher/project-config.json` | 项目根目录、技术栈、当前阶段 |
| 任务池 | `.trae/skills/concurrent-dispatcher/task-pool.md` | 当前待做的任务清单 |
| Worker 模板 | `.trae/skills/concurrent-dispatcher/worker-template.md` | 给每个 Worker 的固定 prompt |
| 项目 Spec | `.trae/specs/*/spec.md` | 项目的需求规格（Why/What/Impact） |
| 项目任务 | `.trae/specs/*/tasks.md` | 更细粒度的子任务清单（可能比 task-pool 更详细） |
| 项目检查表 | `.trae/specs/*/checklist.md` | 验收检查项 |
| 完善计划 | `docs/plans/2026-06-12-game-completion-plan.md` | 版本规划总览 |
| Worker 指南 | `.trae/documents/worker-prompt-guide.md` | 写 Worker prompt 的最佳实践 |

### 0.2 判断当前阶段

根据 task-pool.md 中的任务状态，判断项目处于哪个阶段：

- **所有任务 pending** → 项目刚开始，需要一轮全量并发
- **部分 done、部分 pending** → 项目进行中，继续推进剩余任务
- **所有任务 done** → 当前阶段完成，询问用户是否要追加下一阶段的任务

### 0.3 如果 task-pool.md 为空或需要更新

如果用户说"帮我规划下一阶段的任务"或 task-pool.md 中所有任务已完成：

1. 读取 `docs/plans/` 下的计划文件，了解下一阶段要做什么
2. 读取 `.trae/specs/*/tasks.md`，看有没有未勾选的子任务
3. 把下一阶段的任务按"互不冲突"原则拆分，追加到 task-pool.md
4. 向用户确认后再开始调度

---

## 📋 第一步：解析任务池

从 `task-pool.md` 中提取所有 `status: pending` 的任务。对每个任务提取：

| 字段 | 说明 | 从 task-pool.md 的何处提取 |
|------|------|---------------------------|
| `task_id` | 如 "T1"、"T2" | 每个 `### Tx` 的标题 |
| `status` | pending/done/in_progress | 每个任务下的 "**状态**：" 行 |
| `files_to_edit` | 要修改的文件列表 | "**操作文件**：" 行 |
| `modification_scope` | 修改范围描述（行号/节点名） | "**修改范围**：" 行 |
| `task_type` | 任务类型 | "**任务类型**：" 行 |
| `focus_area` | 润色/工作重点 | "**润色重点**" 或 "**工作重点**" 行 |
| `accept_criteria` | 验收标准（1-4 条） | "**验收标准**" 下的 4 条 |
| `forbidden` | 禁止事项 | "**严格禁止**：" 行 |
| `dependency` | 依赖哪些任务必须先 done | "**依赖**：" 行 |

**关键检查 — 冲突检测：**

对所有 pending 任务做两两比较：
- 如果两个任务的 `files_to_edit` 指向**同一个文件的同一行号范围** → 冲突，本轮只能选一个
- 如果两个任务改**同一个文件的不同行号范围**（如 T1 改 7-195 行、T2 改 196-427 行）→ **不冲突，可以并发**
- 如果两个任务改**完全不同的文件** → **不冲突，可以并发**
- 冲突时，优先选编号小的那个执行，另一个留到下轮

---

## 👥 第二步：确认并发数

向用户问一句话（仅此一句，不要长篇大论）：

```
当前任务池有 X 个 pending 任务（T1, T2, ...）。并发几个 Worker？（默认 Y 个，最多 8 个同时跑）
```

> 默认值 `Y` = `project-config.json` 的 `default_concurrency`。
> 如果用户只说了具体数字（如 "5"），直接用那个数字，不要反问其他问题。
> 如果用户没指定，用默认值。

---

## 📝 第三步：填充模板 — 为每个任务生成完整 Worker Prompt

从 `task-pool.md` 的 pending 任务中，按编号从小到大挑 N 个（N = 第二步的并发数）。

对每个任务，读取 `worker-template.md`，把里面所有 `{变量}` 替换成实际值。

**变量填充对照表：**

| `worker-template.md` 中的变量 | 替换成什么 |
|-----------------------------|-----------|
| `{TASK_ID}` | 从 task-pool 提取的任务编号，如 "T1" |
| `{ROLE}` | `task_type` 的值，如 "文案润色编辑" |
| `{TASK_TYPE}` | 同上 |
| `{FOCUS_AREA}` | `focus_area` 的值 |
| `{PROJECT_ROOT}` | `project-config.json` 的 `root_path` |
| `{FILES_TO_EDIT}` | `files_to_edit` 的值，拼接成绝对路径 |
| `{FILE_PATH}` | 同上（通常只有一个文件） |
| `{LINE_START}` | 从 `modification_scope` 解析：如果写着"第 7-195 行"，LINE_START=7；如果是"文件级修改无行号"，写"不适用" |
| `{LINE_END}` | 同上 |
| `{NODE_IDS}` | 从 `modification_scope` 解析的节点列表，如 "intro, act0_dad, act0_school..." |
| `{FORBIDDEN_BEFORE}` | 有行号时 = LINE_START - 1；无行号时 = "文件级修改，不适用行号边界" |
| `{FORBIDDEN_AFTER}` | 有行号时 = LINE_END + 1；无行号时 = "文件级修改，不适用行号边界" |
| `{PRINCIPLE_1}` | 从 "工作原则" 或 "润色重点" 拆出的第 1 条 |
| `{PRINCIPLE_2}` | 第 2 条 |
| `{PRINCIPLE_3}` | 第 3 条 |
| `{PRINCIPLE_4}` | 第 4 条（如果只有 3 条，把第 3 条拆两句或写"不要引入语法错误"） |
| `{ACCEPT_1}` | 从 "验收标准" 提取的第 1 条 |
| `{ACCEPT_2}` | 第 2 条 |
| `{ACCEPT_3}` | 第 3 条 |
| `{ACCEPT_4}` | 第 4 条 |

**填充完后，** 运行 `worker-template.md` 末尾的"自检清单"，确认：
- [ ] 所有 `{变量}` 都已替换（模板里不再有任何 `{` 开头的大写占位符）
- [ ] 行号范围和其他并发任务不重叠
- [ ] 任务描述完整：有"做什么"、"为什么"、"怎么做"、"不能做什么"
- [ ] 有"其他 Worker 并行"的说明
- [ ] 返回格式已明确

---

## 🚀 第四步：并发启动 N 个 Subagent（核心！）

**这是本 Skill 的核心动作——也是"串联编程"中"多对话并发"的关键环节。**

用 `general_purpose_task` 工具，**一次性并行调用 N 次**。

每个 subagent 的参数严格按以下格式填写：

| 参数 | 值 |
|------|---|
| `description` | 简短描述，**必须包含任务编号**，如 `T1: 润色 story.js 第 7-195 行` |
| `query` | 第三步填好的**完整 Worker Prompt**（worker-template.md 的全部内容，变量已替换） |
| `response_language` | `"chinese"` |

⚠️ **你自己不要再读任何代码文件做任何修改。** 所有实际修改由 subagent 完成。
⚠️ **必须是并发调用** — 在同一次 tool_call 里放 N 个 general_purpose_task。

---

## ✅ 第五步：收工检查

所有 subagent 返回后，你需要做：

### 5.1 文件健康检查
对被修改的每个文件做一次快速语法校验：

```
Read: [被修改的文件路径]（只看开头 import 和末尾 export）
```

如果某个文件明显缺了 import / export，**立即修复**（只补缺失的骨架语句，不改内容）。

### 5.2 运行校验脚本（如果 T8/校验类任务被执行）

如果本轮有"脚本开发"或"校验"类任务被执行：

```
在项目根目录运行: node scripts/validate-story.cjs
或者: node scripts/validate-effects.cjs
```

读输出，确认 0 errors。

### 5.3 更新 task-pool.md

把本轮执行的 N 个任务的 `status` 从 `pending` 改为 `done`。

如果某个 subagent 报告"部分完成"，标注为 `in_progress` 并简要说明剩余工作。

### 5.4 同步更新 specs/tasks.md（如果存在）

如果 `.trae/specs/*/tasks.md` 中有对应的子任务，也把它们勾选为 `[x]`。
保持两套任务清单的一致性。

---

## 📢 第六步：向用户汇总报告

按以下固定格式报告：

```
### ✅ 本轮完成

- **T1** — [简要描述，1 句话]
- **T2** — [简要描述，1 句话]
- ...

### 📊 任务池剩余

- pending: X 个（T3, T4, ...）
- done: X 个（T1, T2, ...）
- in_progress: X 个

### 🔍 质量检查

- 所有被修改文件语法正常：✅ 通过
- 校验脚本（如执行了）：✅ 0 errors / ❌ 有 N 个 errors，已处理
- 节点 ID / next 指向未被修改：✅ 确认

### 🎯 下一步建议

- 下轮可以继续调度剩下的 pending 任务
- 或者先做 [某个高优先级的项目改进]
```

---

## 🔧 任务池维护规则

每次完成一轮调度后，你必须：

1. 把已完成的任务 status 从 `pending` → `done`
2. 把部分完成的标记为 `in_progress`，并写下"剩余工作"
3. 如果项目进入新阶段（例如 v0.3 → v0.4），可以在 task-pool.md 末尾追加新阶段的任务
4. 新增任务时，确保：
   - 编号延续（T9, T10...）
   - 修改范围和现有任务不重叠
   - 有明确的验收标准和禁止事项
5. 同步更新 `.trae/specs/*/tasks.md` 中的勾选状态

---

## 🧭 串联编程：你的完整工作方法论

这个 Skill 不只是一个"并发调度器"——它体现了你的完整工作方法论：

```
┌─────────────────────────────────────────────────────┐
│                  串联编程 (Chained Programming)       │
│                                                      │
│  1. Agent 智能体                                     │
│     → 理解用户意图                                    │
│     → 判断任务类型                                    │
│     → 读取项目上下文（specs/tasks/checklist）          │
│                                                      │
│  2. Skill 分发                                       │
│     → concurrent-dispatcher：并发任务调度              │
│     → code-writing-expert：代码修改                    │
│     → requirements-analyst：需求分析                   │
│     → brainstorming：方案设计                         │
│     → 其他 Skill：按需路由                            │
│                                                      │
│  3. 多对话并发                                       │
│     → N 个 subagent 同时执行不同任务                   │
│     → 每个改不同文件/行号范围，零冲突                   │
│     → 先完成的先返回，不等待其他人                      │
│                                                      │
│  4. 汇总验收                                        │
│     → 检查文件完整性                                  │
│     → 运行校验脚本                                    │
│     → 更新任务状态                                    │
│     → 向用户报告                                      │
│                                                      │
│  5. 迭代推进                                        │
│     → 用户说"继续"→ 找下一个 pending 任务              │
│     → 当前阶段完成 → 规划下一阶段                      │
│     → 项目持续快速迭代                                │
└─────────────────────────────────────────────────────┘
```

**核心理念：**
- **Token 无限 = 并发无限**：不要让 Worker 空转等待，谁先完成谁就接下一个任务
- **任务拆分 = 零冲突**：按文件/行号拆分，每个 Worker 各管各的，合并零成本
- **Agent 是大脑，Skill 是工具，多对话是手脚**：三者配合才能最大化效率
- **项目级记忆**：specs/tasks.md + task-pool.md + checklist.md 构成项目的"长期记忆"，每次调度都读取和更新

---

## 🏁 完整执行速查（每次调用都按这个顺序做）

```
Step 0: Read 项目上下文（project-config + task-pool + worker-template + specs/tasks）
Step 1: 解析 pending 任务，做冲突检测
Step 2: 问用户并发数（或用默认值）
Step 3: 为每个任务填充模板，生成 N 份完整 Worker Prompt
Step 4: 并发调用 N 个 general_purpose_task 工具
Step 5: 收工检查 + 更新 task-pool.md + 同步 specs/tasks.md
Step 6: 向用户报告
```

**执行到 Step 4 时，你必须在一次 tool_call 里并发放 N 个 general_purpose_task。** 这是本 Skill 能否"最大化多线程能力"的关键。
