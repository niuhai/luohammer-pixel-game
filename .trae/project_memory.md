# Project Memory

## Lessons Learned

### R17 · 评委视角 UI 闭环（2026-07-23）

1. **界面要帮助决策，不只负责装饰**：成就、天赋、结局三类界面都应先明确“用户此刻要判断什么”，再安排标题、状态、证据和行动层级。
2. **交互语义是稳定性的组成部分**：可选择卡片使用原生 `button` + `aria-pressed`，可同时获得键盘、焦点与读屏行为，减少自制交互状态。
3. **资源加载必须单一所有权**：GameScene 的 fire-and-forget 与 EndingScene preload 同时加载 `bg-ending` 会形成竞态；跨场景资源由目标场景统一负责。
4. **移动端验收必须检查内容边界**：只看首屏截图不够，还要比对 `scrollHeight/clientHeight`、正文 bottom 与操作区 top，防止 sticky 行动区覆盖长文。
5. **删掉与正文重复的隐藏层**：天赋 tooltip 重复卡片全部内容，既制造遮挡又增加维护成本；移除后交互更直接，主业务包同步下降。
6. **VERIFY 要组合证据**：本轮固定使用 lint + unit + build + story + paths + effects + E2E + 1920/375 双视口走查，避免单一绿色信号掩盖体验回归。

### R18-R19 · GATE-R18 全量复核 + quick-exit 收口（2026-07-24）

1. **GATE 视角能挖到单轮 VERIFY 挖不到的 P1**：play_count 双数据源不同步——GameScene._incrementPlayCount 只写 localStorage 而 IntroScene 读 meta.getPlayCount()，导致二周目开场动画永不跳过。这种跨场景数据一致性问题必须用陌生工程师视角通读源码才能发现。
2. **localStorage 写入失败必须 toast 提示**：移动端 Safari 私密浏览模式配额为 0，所有 try/catch 静默吞错会让玩家进度无感知丢失。R19 评估后建议关键保存点检查 SaveSystem.save() 返回值。
3. **Transition 重入静默丢弃回调会卡黑屏**：if(this.active) return 防止重入时 onMidpoint 也被丢弃，玩家卡死。重入时必须 console.warn + 入队回调。
4. **_proceedToNode 在 transition.play 前必须补存档**：makeChoice save 一次后 checkThresholdTriggers/checkComboTriggers 会继续 applyEffects 修改 state，动画期间浏览器崩溃则变更丢失。
5. **quick-exit 门控需要 wealth 维度**：仅 pride 门控不够，策略 L 11 步就结局；R19 补 5 处 wealth 门控后策略 D 7→18 步、H 6→13 步，路径深度显著拉长。

### R20 · 发布一致性与 PWA 闭环（2026-07-23）

1. **Service Worker cache-first 是评委吃旧版本的元凶**：旧 SW 对所有同源请求 cache-first，已访问过的评委持续收到旧 index.html 即使新产物已上传。导航请求必须 network-first。
2. **Vite 内容哈希资源可安全 cache-first**：URL 变化即代表内容变化，Phaser 大包不必重复下载。
3. **固定文件名图片/manifest 用 stale-while-revalidate**：先秒开，后台更新，下次访问拿新版。
4. **SW 安装时读取构建后 index.html 动态发现 hash**：public/sw.js 不知道 Vite hash，安装时 fetch 当前 HTML 解析入口 JS/CSS 一并预缓存。
5. **必须 updateViaCache: none + registration.update()**：已有控制器更新后自动刷新一次，避免评委停留在旧版本。

### R21 · 音频生命周期与六阶段配乐闭环（2026-07-23）

1. **每个场景的 AudioSystem 必须订阅 shutdown 事件**：Phaser shutdown 不保证 destroy 触发，AudioSystem 构造时统一订阅 scene.events.on('shutdown')，提供幂等 destroy() 覆盖正常跳转/提前返回/异常兜底。
2. **speechSynthesis.onvoiceschanged 会被新实例覆盖**：必须用可独立注册/移除的监听器，避免场景实例互相覆盖。
3. **多音符 SFX 延迟任务必须进入实例级集合**：裸 setTimeout 在场景切换后仍播放上一场景尾音；执行后自动移除，销毁时统一取消。
4. **Blob URL 必须在销毁时统一 revokeObjectURL**：自定义配音的 `<audio>` ended 监听器与 Blob URL 不释放会持续占内存。
5. **AudioContext 跨场景共享，destroy 时不关闭**：浏览器对频繁创建/关闭 AudioContext 有限制，模块级共享避免触发。
6. **六阶段 BGM 必须有独立动机**：青年/教师/创业/至暗/还债/重生六阶段若共用 BGM，评委连续体验时听感完全相同、情绪辨识度不足。

### R22 · 决赛评委视角资源生命周期与 PWA 增强（2026-07-24）

1. **递归 setTimeout 必须实例化跟踪**：PixelRenderer._startHeartbeat 用 setTimeout 递归调度心跳振动，destroy 时未 clearTimeout 会导致场景销毁后仍有残余振动。教训：所有递归 setTimeout 必须把 timer ID 存到实例属性，destroy 时批量清理。
2. **打字机动画必须在 close 时取消**：AIReviewSystem._typewrite 用 setTimeout 递归写字符到 DOM，关闭 overlay 后 DOM 已分离，打字机仍在改写已删除的元素。教训：模块级 cancelled 标志，close() 触发后递归 step 立即 return。
3. **DialogSystem/ToastSystem 大量匿名 setTimeout 难追踪**：分散在多处的 setTimeout 不能在 destroy 时清理。教训：统一封装 `_trackedTimeout(fn, delay)` 方法 + `_pendingTimers` Set，destroy 时 `_clearPendingTimers` 批量 clearTimeout。
4. **DOM 元素引用必须 null 检查**：RandomEventSystem 构造时 getElementById 拿到的 _overlay/_titleEl 等可能在 index.html 结构变更后为 null，_showEvent 直接操作 null.style 会崩溃。教训：构造时拿到的 DOM 引用，使用前必须 null 检查。
5. **PWA manifest 必须有 maskable icon**：Android 自适应图标会裁剪 any purpose 图标，maskable icon 提供 safe-zone 防裁剪。教训：icon-512 同时声明 "any" + "maskable" 两个 purpose。
6. **OG 图必须预缓存**：社交分享预览图 og-image.png 在评委首次分享时白屏等待，加入 SW PRECACHE_ASSETS 秒开。
7. **R20/R21/R22 三轮联动收口"资源生命周期"维度**：R20 SW 缓存策略、R21 音频资源、R22 定时器+DOM+PWA，三轮共同把"资源从创建到销毁"的完整链路收口，新增第 14 个维度"资源生命周期"。

### GATE-R21 · 6 维度全量体检（2026-07-24）

1. **GATE 价值兑现**：GATE-2 陌生工程师视角发现了 R22 自身引入的 3 个 P1（typewriterCancelled 永久置真、SaveSystem.save() 返回值未检查、ToastSystem 跟踪未贯彻），单轮 VERIFY 无法发现这种"机制建好但没用"的次生问题。
2. **GATE-5 体验链路全 PASS**：browser-use agent 实机走核心路径，5/5 星全 PASS，评委第一印象"惊艳"。
3. **GATE-3 加权评分 9.13/10**：产品完整性 9.3 / 技术实现 9.0 / 实用性 9.0 / 创新性 9.2，连续 3 次 GATE 无下降。
4. **GATE-4 复赛帖一致性 12/13 通过**：唯一部分一致项是 AI 复盘功能（存在但 P1-1 bug），R23 修复后可达 13/13。
5. **GATE-6 收敛判定**：P0=0 连续 4 轮，修复率连续 4 轮 ≥100%，回归率连续 4 轮 = 0%，已收敛可冻结（条件性）。

### R23 · GATE-R21 P1 收口（2026-07-24）

1. **模块级标志必须在入口重置**：AIReviewSystem.typewriterCancelled 在 close() 中置 true 但从不重置，玩家二次打开复盘弹窗内容空白。教训：模块级 cancelled/disabled 标志必须在每次 open/start 入口处显式重置。
2. **机制建好但没用 = 缺陷**：SaveSystem.save() 早已返回 boolean，但 5 处调用方全部 `try { ... } catch(e) {}` 忽略返回值。教训：API 设计了返回值就必须在调用方检查，否则等于没设计。R23 抽 _safeSave(label) helper 统一处理，失败时 toast.error 提示玩家。
3. **跟踪机制必须贯彻到所有调用点**：R22 建立 ToastSystem._activeTimers Set 但只 track 了部分定时器，3 处裸 setTimeout 仍存在。教训：建立跟踪机制后必须 Grep 全文件确认所有 setTimeout 都已替换，否则机制形同虚设。
4. **零回归是质量稳定的硬指标**：R19-R23 连续 5 轮回归率 = 0%，lint 0/0 / vitest 321/321 / validate-story 0/0 / simulate-paths 13 策略 5 结局，这套验证组合能有效捕获回归。
5. **R23 完成后正式进入冻结期**：P0=0 连续 5 轮，P1=0 达成，加权评分 9.13/10，体验 5/5 星，可转入演示视频录制 + 复赛帖打磨 + 部署验证阶段。

### R24 · 突破收敛期·GATE-R21 残留 P2 清零（2026-07-24）

1. **"已收敛可冻结"不是终点，是下一次突破的起点**：用户提出"优化到极限"目标后，重新审视 GATE-R21 标记的 4 个"冻结期内不修"的 P2，发现其中隐藏 3 个 P0 级遗漏——_safeSave helper 在 R23 抽出后只贯彻了 2/5 处调用点，line 624（退出至标题）/line 2479（随机事件后）/line 2651（阈值连击后）仍用 `try { save.save(...) } catch(e) {}` 静默吞错。教训：抽 helper 后必须 Grep 全文件确认所有同模式调用点都已替换，否则"机制建好但没用"的缺陷会以 P0 形式回潮。
2. **TDZ 前向引用修复需要解耦依赖**：_closeSettlement 引用 countdownTimer、setInterval 回调引用 _closeSettlement，形成循环依赖。解法：让 _closeSettlement 改用 `this._settlementTimer`（实例属性）替代 `countdownTimer`（局部变量），解除依赖后 const 声明顺序可任意排列。教训：函数间互相引用时，优先用实例属性解耦，避免 TDZ。
3. **数据结构统一是降低维护成本的关键**：GameScene._pendingTimeouts 用 Array+indexOf/splice，DialogSystem 用 Set+add/delete。同样语义两套实现增加心智负担。R24 统一为 Set，与 R22 建立的 _activeTimers Set 风格一致。
4. **重入防御不能依赖"应该不会"**：PixelRenderer._startHeartbeat 递归调用本身无泄漏，但外部错误地两次调用时第一次的 timer1/timer2 引用被覆盖。教训：所有递归 setTimeout 入口必须先 clearTimeout 旧引用，即使"理论上不会重入"。
5. **EndingScene setTimeout 改 time.delayedCall 的边界**：line 128/577（淡出/进度条）可改为 `this.time.delayedCall` 由 `time.removeAllEvents()` 统一清理；但 line 1738（长按下载）的 `pressTimer` 需要在 mouseup/touchend 时 `clearTimeout`，delayedCall 返回 TimerEvent 不是 number，不能直接 clearTimeout。解法：保留 setTimeout + 加 `if (!this._shareCardEl) return` 场景存活检查。教训：改造时不能一刀切，需考虑 cancel 语义。

### R25 · GATE-R24 残留 P2 定时器跟踪贯彻（2026-07-24）

1. **定时器跟踪机制必须全代码库贯彻才算闭环**：R22 建立 _trackedTimeout + _pendingTimers Set 模式，R23 补全 ToastSystem，R24 统一 GameScene，R25 最终补全 DialogSystem 3 处 + StatsSystem 2 处。教训：建立跟踪机制后，必须 Grep 全代码库（`grep -rn "setTimeout" src/`）确认所有调用点都已替换或用实例属性跟踪，5 轮才彻底贯彻说明每轮都遗漏了边界。
2. **StatsSystem 缺 destroy 是系统性遗漏**：GameScene 清理时 `this.stats.el.classList.remove('visible'); this.stats = null;` 从不调用 destroy()，引导气泡的 2 个 setTimeout 在场景快速切换时孤立。教训：所有 system 类都应有 destroy() 方法，GameScene 清理时应统一调用。
3. **P2 微修不改分数但完善机制闭环**：R25 只修 5 处 P2 定时器跟踪，GATE 分数不会因此提升，但"资源生命周期"维度从"已建立机制"升级为"全代码库贯彻完毕"，是工程素养的体现。

## Next Scan Input

- P0：0
- P1：0
- P2：0
- **收敛状态**：R34 完成 R32-R34 连锁 P0 bug 修复（`<b>` 标签字面文本：打字机显示+TTS 朗读）+ R33 第四章金句密度补全。下一步：
  - R35 应触发 GATE 总体审查（R32+R33+R34 = 3 轮后），6 维度全量体检确认是否真正收敛
  - R32 发现 P0 bug 说明深度 SCAN 仍有价值，R31 价值审计"无 A/B 级改进"判定被推翻
  - 项目已连续 11 轮（R24-R34）无 P1 退化（R32/R34 是 P0 但已修复），GATE 加权 9.43/10 → 预期 9.5+（R32 P0 bug 修复 + R33 金句密度 + R34 TTS bug 修复）
  - 后续改进方向：演示视频录制（复赛硬性要求）、移动端 375x812 实机走查、结局页细节打磨

### R26 · 评委视角 P1·新手引导（2026-07-24）

1. **搜索 subagent 结论必须代码验证**：Worker C 报告 4 个 P1，实际验证后只有 1 个属实（新手引导），2 个已存在（结局图鉴/AI复盘168组合），1 个待验证（分享移动端）。教训：search subagent 基于代码片段推断，容易误报"缺失"，必须 Read 实际代码确认。
2. **新手引导要在"需要时"出现**：不是在标题页加"如何游玩"按钮（玩家不会点），而是在首次进入游戏 600ms 后弹出操作指引卡片，此时玩家正需要知道怎么操作。时机比内容更重要。
3. **引导卡片必须非阻塞**：pointer-events: none 确保不挡游戏交互，6s 自动消失+点击消失双通道，localStorage 一次性。评委二次访问不会再看。

### R27 · SW dev 模式绕行 + E2E 全量验证（2026-07-24）

1. **Service Worker 会拦截 Vite dev 模块的未 hash 请求**：sw.js 的 staleWhileRevalidate 策略会缓存 `/src/systems/Foo.js` 等 Vite dev 模块，导致 ERR_ABORTED 和游戏黑屏。修复：在 fetch handler 开头检查 URL 是否含 `/src/`、`/@vite/`、`/@fs/`、`?t=`、`?import`，命中即 return（不拦截不缓存）。生产构建不受影响（hash 资源走 cacheFirst）。
2. **CACHE_VERSION 必须随 SW 逻辑变更升级**：sw.js 修改 fetch 逻辑后，必须升级 CACHE_VERSION（v6→v7）让已部署用户的浏览器激活新 SW 并清除旧缓存。否则旧 SW 仍会用旧逻辑拦截请求。
3. **browser-use agent 不能可靠测试 Phaser 游戏**：Phaser 使用 requestAnimationFrame 驱动游戏循环，当浏览器标签页进入后台（如 agent 截图/evaluate 时），RAF 暂停，定时器不触发，导致 IntroScene 无法跳转到 GameScene，表现为"黑屏"。这不是游戏 bug，是测试方法局限。E2E（Playwright headless）不受此影响，11/11 全过。
4. **Vite 构建会自动拆分大 chunk**：当 story 数据量足够大时，Vite 自动将其拆分为独立 chunk（story-*.js 244kB + index-*.js 412kB），优化初始加载。无需手动配置 manualChunks。
5. **search subagent 再次大量误报**：两次 search agent 报告共 25 个"问题"，实际验证后 0 个属实。search agent 基于代码片段推断，容易将"不同 choice 的 effects"误报为"重复 key"，将"注释中的 getElementById"误报为"游戏循环中的 DOM 查询"。必须 Read 实际代码确认。

### R28 · 评委视角 A 级·三个高光时刻动效升级（2026-07-24）

1. **抽卡仪式感是评委 30 秒内必经的惊艳瞬间**：天赋卡片之前 `appendChild` 瞬间出现，对比卡牌游戏的"翻牌+stagger"差距明显。R28 加入 `@keyframes talentCardReveal` 翻牌入场（rotateY 85°→0° + translateY 24px→0 + scale 0.85→1 + brightness 1.8→1）+ stagger 100ms + 稀有度光晕呼吸（传说 2.4s 金光、稀有 3.2s 蓝光）+ 选中光波扫过（`talentSelectedSweep` 0.6s）+ 卡牌出现音效（每张卡短促三角波，传说/稀有多高音点缀）。`prefers-reduced-motion` 降级为纯淡入。教训：高光时刻的"仪式感"比"功能正确"更影响评委评分。
2. **标题页按钮 stagger 入场是第一印象加分项**：之前按钮瞬间堆叠出现，缺少高级感。R28 加 `@keyframes bootBtnIn`（translateY 14px→0 + scale 0.94→1 + brightness 1.4→1）+ JS 设置 `animation-delay` stagger 70ms。主按钮的 `bootBtnBreath` 呼吸灯延迟 0.5s 启动避免与入场冲突（多 animation 逗号分隔）。教训：`transition: all` 会与 `animation` 冲突，需把 transition 改为具体属性列表。
3. **6 亿数字"砸地"瞬间是杀手时刻的记忆锚点**：之前数字从 -120px 砸到 38% 后只是停留，缺少"砸地"冲击。R28 在落地时刻（100+400=500ms）触发四维冲击：①数字弹性反弹 scale 1→1.18→1（cubic-bezier 0.34,1.56,0.64,1 弹性曲线）②1 帧白闪 `flashScreen(0.08)` ③二次震动 `shake(5,220)` ④扩散红圈波纹环（20px→600px，opacity 1→0）。落地后 1.5s 淡出（总时长从 1.9s→2.3s）。清理逻辑同步更新，新增波纹环 DOM 清理。教训：杀手时刻的"落地瞬间"比"下落过程"更影响记忆。
4. **CSS 多 animation 链式启动用逗号分隔 + 延迟**：`animation: talentCardReveal 0.55s ... both, legendaryGlow 2.4s ... infinite 0.6s` 让入场动画先跑完，0.6s 后光晕呼吸接管。主按钮同理：`bootBtnIn 0.5s ... both, bootBtnBreath 3s ... infinite 0.5s`。教训：多个动画同时跑会互相干扰，用延迟错开。
5. **价值审计机制有效防止磨洋工**：R28 强制回答价值三问（评委可感知/不改会扣分/指向 9.5+），3 个任务全部 A 级。R26(A)+R27(C)+R28(A) 未触发熔断，连续找到 A 级改进说明项目仍有提升空间。

### R29 · 评委视角 B+·细节体验补强（2026-07-24）

1. **og:url 空值是社交分享的硬伤**：HTML 的 `og:url` 一直为空，导致社交平台抓取时无法正确归因。R29 填入部署 URL `https://niuhai.github.io/luohammer-pixel-game/`。教训：meta 标签审查不能只看"有没有"，还要看"对不对"。
2. **加载条无流光是"死气"信号**：评委首次加载时看到进度条只是宽度变化，缺少"活感"。R29 加 `::after` 伪元素流光动画（1.4s 循环 translateX -100%→100%），白光从左到右扫过。`prefers-reduced-motion` 降级为无动画。教训：加载等待是评委第一印象，流光比静态进度条更有"正在工作"的暗示。
3. **AI 复盘面板入场从 slide 升级为 scale+blur**：之前 12px slide up 太微弱，缺少"AI 降临"仪式感。R29 改为 `translateY(16px) scale(0.94) + blur(8px) + opacity:0` → `translateY(0) scale(1) + blur(0) + opacity:1`（0.45s cubic-bezier），加上 overlay 的 `backdrop-filter: blur(4px)` 让背景模糊，面板更聚焦。教训：cyan 配色 + blur 入场 = "AI/科技感"的视觉语言。
4. **分享卡入场动画是病毒传播的最后一公里**：之前分享卡 mask 瞬间出现，缺少"揭晓"仪式感。R29 给 mask + imgEl + tip 三层都加入场动画：mask fade in（0.3s）+ imgEl scale(0.9)→(1) + fade in（0.45s 延迟 0.1s）+ tip fade in（延迟 0.4s）。`requestAnimationFrame` 触发确保 transition 生效。教训：分享卡是评委/玩家截图传播的关键瞬间，"揭晓感"比"快速出现"更重要。
5. **R29 找不到 A 级改进是接近极限的信号**：R28 找到 3 个 A 级（天赋抽卡/标题按钮/6亿砸地），R29 深度扫描结局页/对话框/属性面板/随机事件/阶段结算/AI复盘/分享卡/加载条 8 个维度，仅找到 4 个 B+ 级。说明项目的"评委 10 分钟高光时刻"动效已基本覆盖完毕，后续改进边际效益递减。R30 应触发 GATE 总体审查确认是否真正收敛。

### R30 · 评委视角 B 级·failures 数值平衡优化（2026-07-24）

1. **failures 正负比是"翻身"体感的关键指标**：玩家失败路径只有 failures:+1（负面），没有 failures:-1（翻身反馈），导致 failures 单调增长，"真还传"缺乏数值支撑。R30 在 act4-act5 的 10 处失败路径加 failures:-1（坚持品质/抢救成果/主动应对/政府协调/人事决策×2/找回美学+务实/保守使用资金），正负比从 3.14 降至 2.46（超额 ≤2.5 目标）。教训：数值平衡不只是"可达性"，还要考虑"情绪节奏"——失败后的翻身反馈让玩家感到"跌倒了能站起来"。
2. **DOM 清理不能依赖颜色字符串匹配**：GameScene 6亿砸地震波环的清理逻辑用 `el.style.borderColor.includes('224,64,64')` 匹配，但浏览器可能将 rgba(224,64,64,0.8) 规范化为不同格式（如带空格）。R30 改用 CSS class（`ui-killer-moment-number`/`ui-killer-moment-ring`）+ `querySelectorAll` 清理，更可靠。教训：DOM 清理用 class 选择器比内联样式字符串匹配更健壮。

### R31 · setTimeout 跟踪状况核查（2026-07-24）

1. **价值审计三问是防止磨洋工的有效机制**：R31 对 ChoiceSystem/TalentSystem/AIReviewSystem 的 setTimeout 进行跟踪审计，强制回答价值三问（评委可感知？不改会扣分？指向 9.5+？），三问全否→C 级降级不修。ChoiceSystem 已完全跟踪（_transientTimers Set + _leaveTimer hide 清理）；TalentSystem/AIReviewSystem 均为短延迟一次性 DOM 操作风险极低。教训：不是所有"技术债"都值得修，价值审计三问能有效过滤"修了也不影响评委评分"的低价值改进。

### R32 · P0 bug 修复·`<b>` 标签字面文本（2026-07-24）

1. **`<b>` 标签在打字机中被当作字面字符是 P0 级 bug**：DialogSystem 打字机用 textContent 逐字显示，`<b>` 标签被当作字面字符显示为 `<b>...</b>`。_applyKeywordHighlight 转义 `<` `>` 后 `<b>` 变成 `&lt;b&gt;` 字面文本。评委如果看到对话框里出现 `<b>` 字面文本，会直接判定"不专业"。教训：富文本标签（`<b>`/`<i>`/`<strong>`）在打字机场景必须过滤，打字机只应该显示纯文本。
2. **_plainText 模式：打字机用纯文本，渲染用富文本**：R32 新增 `_plainText` 属性（去除 `<b></b>` 标签的纯文本），打字机逐字显示用 _plainText，_applyKeywordHighlight 和 hooks 用 fullText（含标签）。这样打字机不会显示标签字符，而最终渲染的 HTML 仍能高亮金句。教训：同一文本的"显示版"和"渲染版"分离，是处理富文本在打字机场景的标准模式。
3. **`<b>` 标签金色高亮是金句视觉强化的设计语言**：R32 新增 `.ui-dialog-text b { color: var(--color-gold); font-weight: 600; text-shadow: 0 0 4px rgba(240,192,64,0.4); }` CSS，让 `<b>` 标签包裹的情绪高光点以金色显示。与 .keyword-highlight/.ui-boot-guide-text b 设计语言一致。教训：金句高亮不只能靠 .keyword-highlight class，`<b>` 标签是更语义化的金句标记方式。

### R33 · 第四章金句密度补全（2026-07-24）

1. **金句密度不均是情绪曲线断裂的隐形原因**：R32 修复 `<b>` 标签高亮后，发现第四章（7_act4.js）有 0 处 `<b>` 标签，是唯一零金句章节。而其他章节（1_act0 21处/2_act1 20处/9_act6 20处/11_act8 26处）都有密集金句。第四章是"做手机"的核心章节（T1发布会/量产噩梦/iF金奖/王自如论战/供应链暴雷/300万抢救），没有金句高亮会让情绪曲线在最重要的章节断裂。R33 为 6 个关键节点补充金句高亮。教训：金句密度审查要按章节统计，不能只看总数。
2. **金句选择标准：情绪高光点 + 历史记忆点**：R33 选择的 6 处金句都是"情绪高光点"（良率线/万丈深渊/CEO的诅咒/输了人心/供应链绞索/尊严与执念），同时是"评委必走节点"（act4_a/act4_launch/act4_if/act4_wangziru/act4_b/act4_rescue）。教训：金句不是越多越好，要选在情绪转折点和历史记忆点。

### R34 · P0 bug 修复·TTS 朗读 `<b>` 标签字面文本（2026-07-24）

1. **`<b>` 标签修复有连锁效应：打字机→innerHTML→TTS**：R32 修复了打字机显示 `<b>` 字面文本的 bug，但 TTS 朗读的 onTextStart hook 仍传 fullText（含 `<b>` 标签）给 audio.speak()，TTS 引擎会朗读"小于b大于"字面文本。R34 改传 _plainText。教训：富文本标签的修复必须检查所有使用该文本的功能点（打字机/innerHTML 渲染/TTS 朗读/存档/分享卡），不能只修一个。
2. **R32-R34 连锁修复证明深度 SCAN 的价值**：R31 价值审计判定"无 A/B 级改进"（C 级），但 R32 深度 SCAN 立即发现 P0 级 `<b>` 标签 bug。这说明"价值审计三问"可能漏判——评委可感知的 bug（`<b>` 字面文本）被误判为"不可感知"。教训：价值审计三问是过滤低价值改进的好工具，但不能替代深度 SCAN 的代码审查。

### R35 · 第三章和第六章金句密度补全（2026-07-24）

1. **金句密度审查要覆盖所有章节，不能只修零金句章节**：R33 只修了第四章（7_act4.js 0处`<b>`标签），但 R35 发现第三章（6_act3.js 仅1处）和第六章（4_fridge.js 仅1处）也严重不足。第三章是"锤子科技创业"——与雷军会面/注册公司/唐岩投资/草台班子/十字路口名言/通宵赶代码，全是情绪高光点却只有1处高亮。第六章是"砸冰箱"——维权升级/策划砸冰箱/铁锤灵感/砸冰箱现场，也是情绪密集章节却只有1处高亮。教训：金句密度审查要按章节统计并设定阈值（如≥3处），不能只修零金句章节。
2. **`<b>` 标签应放在"情绪转折点"和"历史记忆点"**：R35 在 6_act3.js 选择的7处金句都是"情绪转折点"（手机不该只是跑分工具/在别人的棋盘上你永远只是棋子/Smartisan像一句宣言/有些话比900万更重/浪漫和灾难之间只隔粉笔灰/十字路口名言/这就是创业）。在 4_fridge.js 选择的4处金句都是"历史记忆点"（既然你们听不懂人话/法律解决纠纷锤子解决傲慢/如果有一天我做手机公司就叫锤子/法律解决纠纷砸解决傲慢）。教训：金句高亮的标准是"评委读到这里会停下来"的瞬间——要么是情绪冲击，要么是历史共鸣。
3. **search subagent 误报率高，必须代码验证**：R35 派出3个 search subagent，全部返回大量误报（声称 viewport meta 不完整/manifest 缺字段/html lang 缺失/og 标签缺失，实际全部已存在）。教训：search subagent 基于文件名和片段推断，不做完整读取，误报率极高。必须用 Read/Grep 直接验证。
