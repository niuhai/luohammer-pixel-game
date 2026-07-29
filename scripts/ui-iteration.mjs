/* eslint-env node */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const ITERATION_DIR = path.join(ROOT, '.iteration');
const UI_DIR = path.join(ITERATION_DIR, 'ui');
const STATE_PATH = path.join(ITERATION_DIR, 'state.yaml');
const BACKLOG_PATH = path.join(UI_DIR, 'backlog.json');
const CURRENT_PATH = path.join(UI_DIR, 'current.json');
const EVIDENCE_DIR = path.join(UI_DIR, 'evidence');
const RUNS_DIR = path.join(ITERATION_DIR, 'runs');

const LEVEL_RANK = Object.freeze({ L1: 1, L2: 2, L3: 3 });
const OUTCOMES = new Set(['IMPROVED', 'NEUTRAL', 'REGRESSED']);
const VALUES = new Set(['V0', 'V1', 'V2', 'V3']);
const EVIDENCE_GRADES = new Set(['E0', 'E1', 'E2']);
const GUARDRAIL_RESULTS = new Set(['PASS', 'FAIL']);
const DECISIONS = new Set(['CONTINUE', 'PIVOT', 'RE-FRAME', 'FREEZE', 'ROLLBACK']);
const CAPABILITY_STATES = /^(SEED|PROVEN|COMPOUNDING|NONE)[：:]\s*(\S[\s\S]*)$/i;
const CHECKS = Object.freeze({
  L1: [
    {
      name: 'eslint',
      cli: 'node_modules/eslint/bin/eslint.js',
      args: ['src', '--ext', '.js', '--max-warnings', '0']
    }
  ],
  L2: [
    {
      name: 'unit',
      cli: 'node_modules/vitest/vitest.mjs',
      args: ['run']
    },
    {
      name: 'build',
      cli: 'node_modules/vite/bin/vite.js',
      args: ['build']
    }
  ],
  L3: [
    {
      name: 'e2e',
      cli: 'node_modules/@playwright/test/cli.js',
      args: ['test', '--reporter=line', '--workers=1']
    }
  ]
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function parseIterationState(source) {
  const cycle = source.match(/^cycle:\s*(.+)$/m)?.[1]?.trim();
  const roundNext = source.match(/^round_next:\s*(R\d+)$/m)?.[1];
  if (!cycle || !roundNext) {
    throw new Error('state.yaml 缺少 cycle 或 round_next');
  }
  return { cycle, roundNext };
}

export function priorityScore(item) {
  const impact = Number(item.impact);
  const confidence = Number(item.confidence);
  const effort = Number(item.effort);
  if (![impact, confidence, effort].every(Number.isFinite) || effort <= 0) return -1;
  return (impact * confidence) / effort;
}

export function selectNextItem(items) {
  const done = new Set(items.filter(item => item.status === 'done').map(item => item.id));
  return items
    .filter(item => item.status === 'queued')
    .filter(item => (item.dependsOn || []).every(id => done.has(id)))
    .sort((left, right) => {
      const scoreDelta = priorityScore(right) - priorityScore(left);
      if (scoreDelta !== 0) return scoreDelta;
      if (Boolean(left.corePath) !== Boolean(right.corePath)) {
        return left.corePath ? -1 : 1;
      }
      return String(left.lastEvidenceAt || '').localeCompare(String(right.lastEvidenceAt || ''));
    })[0] || null;
}

export function incrementRound(round) {
  const match = /^R(\d+)$/.exec(round);
  if (!match) throw new Error(`无效轮次：${round}`);
  return `R${String(Number(match[1]) + 1).padStart(match[1].length, '0')}`;
}

export function verificationLevelMeets(actual, required) {
  return (LEVEL_RANK[actual] || 0) >= (LEVEL_RANK[required] || Number.POSITIVE_INFINITY);
}

export function parseVerificationCost(value) {
  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h)$/i.exec(String(value || '').trim());
  if (!match) {
    throw new Error('close 的 --verification-cost 必须使用 90s、6m 或 1.5h 格式');
  }
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600 }[match[2].toLowerCase()];
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('close 的 --verification-cost 必须大于 0');
  }
  return Math.round(amount * multiplier);
}

function requiredArg(args, name) {
  const value = getArg(args, name)?.trim();
  if (!value) throw new Error(`close 需要 --${name}=...`);
  return value;
}

function requireEnum(value, allowed, message) {
  if (!allowed.has(value)) throw new Error(message);
}

export function parseSettlementArgs(args) {
  const settlement = {
    outcome: requiredArg(args, 'outcome').toUpperCase(),
    value: requiredArg(args, 'value').toUpperCase(),
    evidenceGrade: requiredArg(args, 'evidence-grade').toUpperCase(),
    guardrails: requiredArg(args, 'guardrails').toUpperCase(),
    counterevidence: requiredArg(args, 'counterevidence'),
    capabilityDelta: requiredArg(args, 'capability-delta'),
    verificationCostSeconds: parseVerificationCost(requiredArg(args, 'verification-cost')),
    decision: requiredArg(args, 'decision').toUpperCase(),
    summary: requiredArg(args, 'summary')
  };

  requireEnum(
    settlement.outcome,
    OUTCOMES,
    'close 的 --outcome 必须是 IMPROVED|NEUTRAL|REGRESSED'
  );
  requireEnum(settlement.value, VALUES, 'close 的 --value 必须是 V0|V1|V2|V3');
  requireEnum(
    settlement.evidenceGrade,
    EVIDENCE_GRADES,
    'close 的 --evidence-grade 必须是 E0|E1|E2'
  );
  requireEnum(
    settlement.guardrails,
    GUARDRAIL_RESULTS,
    'close 的 --guardrails 必须是 PASS|FAIL'
  );
  requireEnum(
    settlement.decision,
    DECISIONS,
    'close 的 --decision 必须是 CONTINUE|PIVOT|RE-FRAME|FREEZE|ROLLBACK'
  );

  if (settlement.counterevidence.length < 8 ||
      /^(无|没有|none|n\/a|不适用|待补充)[。.!！]?$/i.test(settlement.counterevidence)) {
    throw new Error('close 的 --counterevidence 必须写出具体反证、限制或最大不确定性');
  }
  if (!CAPABILITY_STATES.test(settlement.capabilityDelta)) {
    throw new Error(
      'close 的 --capability-delta 必须使用 SEED/PROVEN/COMPOUNDING/NONE：具体说明'
    );
  }

  if (settlement.outcome === 'IMPROVED') {
    if (!['V1', 'V2', 'V3'].includes(settlement.value)) {
      throw new Error('IMPROVED 只能结算为 V1|V2|V3');
    }
    if (settlement.evidenceGrade === 'E0') {
      throw new Error('IMPROVED 至少需要 E1；E0 只能继续探测或结算为 NEUTRAL');
    }
    if (settlement.guardrails !== 'PASS') {
      throw new Error('IMPROVED 要求关键护栏 PASS');
    }
  }
  if (settlement.outcome === 'NEUTRAL') {
    if (!['V0', 'V1'].includes(settlement.value)) {
      throw new Error('NEUTRAL 只能结算为 V0|V1');
    }
    if (settlement.guardrails !== 'PASS') {
      throw new Error('关键护栏 FAIL 时必须结算为 REGRESSED');
    }
  }
  if (settlement.outcome === 'REGRESSED') {
    if (settlement.value !== 'V0') {
      throw new Error('REGRESSED 的净价值必须结算为 V0');
    }
    if (settlement.guardrails !== 'FAIL') {
      throw new Error('REGRESSED 要求明确记录关键护栏 FAIL');
    }
    if (!['PIVOT', 'RE-FRAME', 'ROLLBACK'].includes(settlement.decision)) {
      throw new Error('REGRESSED 的决策必须是 PIVOT|RE-FRAME|ROLLBACK');
    }
  }
  if (settlement.value === 'V3' && settlement.evidenceGrade !== 'E2') {
    throw new Error('V3 必须由 E2 证据支持');
  }
  if (settlement.decision === 'ROLLBACK' && settlement.outcome !== 'REGRESSED') {
    throw new Error('只有 REGRESSED 可以选择 ROLLBACK');
  }
  if (settlement.decision === 'FREEZE' && settlement.guardrails !== 'PASS') {
    throw new Error('FREEZE 前关键护栏必须 PASS');
  }

  return settlement;
}

function settlementBlock(settlement) {
  return `## 结算

- Outcome：${settlement.outcome}
- 价值结算：${settlement.value}
- 证据等级：${settlement.evidenceGrade}
- 关键护栏：${settlement.guardrails}
- 最强反证：${settlement.counterevidence}
- 能力变化：${settlement.capabilityDelta}
- 验证成本：${settlement.verificationCostSeconds}s
- 决策：${settlement.decision}
- 摘要：${settlement.summary}
- 自动化证据：${settlement.automationEvidence}
- 视觉证据：${settlement.visualEvidence.join('、')}
- 结算时间：${settlement.closedAt}
`;
}

export function settleRunRecord(source, settlement) {
  const normalized = typeof settlement === 'string'
    ? {
        outcome: settlement,
        value: 'PENDING',
        evidenceGrade: 'PENDING',
        guardrails: 'PENDING',
        counterevidence: 'PENDING',
        capabilityDelta: 'PENDING',
        verificationCostSeconds: 0,
        decision: 'PENDING',
        summary: 'PENDING',
        automationEvidence: 'PENDING',
        visualEvidence: ['PENDING'],
        closedAt: 'PENDING'
      }
    : settlement;
  const block = settlementBlock(normalized);
  const sectionPattern = /## 结算\r?\n[\s\S]*?(?=\r?\n## |\s*$)/;
  const closed = source.replace(/^- 状态：ACTIVE$/m, '- 状态：CLOSED');
  if (!sectionPattern.test(closed)) {
    throw new Error('运行记录缺少“## 结算”区块');
  }
  return closed.replace(sectionPattern, block.trimEnd());
}

function portableRelative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function loadState() {
  return parseIterationState(fs.readFileSync(STATE_PATH, 'utf8'));
}

function loadCurrent() {
  if (!fs.existsSync(CURRENT_PATH)) return null;
  return readJson(CURRENT_PATH);
}

function validateBacklog(backlog) {
  if (backlog.schemaVersion !== 1 || !Array.isArray(backlog.items)) {
    throw new Error('backlog.json schema 无效');
  }
  const ids = new Set();
  for (const item of backlog.items) {
    if (!item.id || ids.has(item.id)) throw new Error(`重复或缺失的任务 ID：${item.id}`);
    ids.add(item.id);
    if (!['queued', 'active', 'done', 'frozen'].includes(item.status)) {
      throw new Error(`${item.id} 的状态无效：${item.status}`);
    }
    if (priorityScore(item) < 0) throw new Error(`${item.id} 的优先级参数无效`);
  }
  return backlog;
}

function loadBacklog() {
  return validateBacklog(readJson(BACKLOG_PATH));
}

function getArg(args, name) {
  const prefix = `--${name}=`;
  const entry = args.find(arg => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function getGitSnapshot() {
  const hash = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  const status = spawnSync('git', ['status', '--short'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return {
    head: hash.status === 0 ? hash.stdout.trim() : 'unknown',
    dirtyEntries: status.status === 0
      ? status.stdout.split(/\r?\n/).filter(Boolean).length
      : null
  };
}

function printStatus() {
  const state = loadState();
  const backlog = loadBacklog();
  const current = loadCurrent();
  const active = backlog.items.find(item => item.status === 'active');
  const next = selectNextItem(backlog.items);

  console.log('前端持续优化循环');
  console.log(`周期：${state.cycle}`);
  console.log(`下一轮：${state.roundNext}`);
  if (current?.status === 'active' && active) {
    console.log(`进行中：${current.round} / ${active.id} / ${active.title}`);
    console.log(`最低验证：${active.minimumVerification || 'L2'}`);
  } else if (next) {
    console.log(`建议任务：${next.id} / ${next.title}`);
    console.log(`优先级：${priorityScore(next).toFixed(2)} / 最低验证：${next.minimumVerification || 'L2'}`);
    console.log(`假设：${next.hypothesis}`);
  } else {
    console.log('当前没有可执行的 queued UI 任务，需要补充观察证据或重新校准。');
  }
  const neutralRounds = Number(backlog.policy?.consecutiveNeutralRounds || 0);
  const neutralLimit = Number(backlog.policy?.neutralRoundsBeforeRecalibration || 3);
  if (neutralRounds >= neutralLimit) {
    console.log(`校准熔断：已连续 ${neutralRounds} 轮无可证实提升，请先补充观察证据并重排队列。`);
  }
  console.log(`队列：${backlog.items.filter(item => item.status === 'queued').length} queued / ` +
    `${backlog.items.filter(item => item.status === 'done').length} done / ` +
    `${backlog.items.filter(item => item.status === 'frozen').length} frozen`);
}

function createRoundTemplate(round, state, task, snapshot) {
  const requiredEvidence = (task.evidenceRequired || ['desktop_before_after', 'mobile_guardrail'])
    .map(item => `- [ ] ${item}`)
    .join('\n');
  return `# ${round} · ${task.title}

- 日期：${new Date().toISOString().slice(0, 10)}
- 状态：ACTIVE
- 任务：${task.id}
- 周期：${state.cycle}
- 起点：${snapshot.head}
- 起点工作区改动项：${snapshot.dirtyEntries ?? 'unknown'}

## Outcome Contract

- 可观察问题：待 OBSERVE 阶段补全。
- 用户结果假设：${task.hypothesis}
- 主验收：Chromium 1440×900。
- 移动护栏：Chromium 390×844、375×812。
- 最低自动化验证：${task.minimumVerification || 'L2'}。
- 回退：核心路径、可读性、焦点或移动端任一退化即回退本轮改动。

## 所需证据

${requiredEvidence}

## 实现

- 待记录。

## 验证

- 待记录。

## 结算

- Outcome：PENDING
- 价值结算：PENDING
- 证据等级：PENDING
- 关键护栏：PENDING
- 最强反证：PENDING
- 能力变化：PENDING
- 验证成本：PENDING
- 决策：PENDING
`;
}

function startRound() {
  const state = loadState();
  const backlog = loadBacklog();
  const current = loadCurrent();
  if (current?.status === 'active') {
    throw new Error(`已有进行中的 UI 轮次：${current.round} / ${current.taskId}`);
  }
  if (backlog.items.some(item => item.status === 'active')) {
    throw new Error('backlog 中已有 active 任务，请先结算');
  }
  const neutralRounds = Number(backlog.policy?.consecutiveNeutralRounds || 0);
  const neutralLimit = Number(backlog.policy?.neutralRoundsBeforeRecalibration || 3);
  if (neutralRounds >= neutralLimit) {
    throw new Error(`已连续 ${neutralRounds} 轮 NEUTRAL，请先重新观察并校准 backlog`);
  }

  const task = selectNextItem(backlog.items);
  if (!task) throw new Error('没有可启动的 queued UI 任务');

  const runPath = path.join(RUNS_DIR, `${state.roundNext}.md`);
  if (fs.existsSync(runPath)) {
    throw new Error(`${state.roundNext}.md 已存在，拒绝覆盖历史轮次`);
  }

  const snapshot = getGitSnapshot();
  task.status = 'active';
  task.startedAt = new Date().toISOString();
  backlog.updatedAt = new Date().toISOString().slice(0, 10);
  writeJson(BACKLOG_PATH, backlog);

  const record = {
    schemaVersion: 1,
    cycle: state.cycle,
    round: state.roundNext,
    taskId: task.id,
    status: 'active',
    startedAt: task.startedAt,
    baseline: snapshot
  };
  writeJson(CURRENT_PATH, record);
  fs.writeFileSync(runPath, createRoundTemplate(state.roundNext, state, task, snapshot), 'utf8');

  console.log(`已启动 ${state.roundNext}：${task.id} / ${task.title}`);
  console.log(`Outcome Contract：${portableRelative(runPath)}`);
}

function checksForLevel(level) {
  if (!LEVEL_RANK[level]) throw new Error(`未知验证级别：${level}`);
  return Object.entries(CHECKS)
    .filter(([checkLevel]) => LEVEL_RANK[checkLevel] <= LEVEL_RANK[level])
    .flatMap(([, checks]) => checks);
}

function verify(level) {
  const state = loadState();
  const current = loadCurrent();
  const round = current?.status === 'active' ? current.round : state.roundNext;
  const results = [];
  let passed = true;

  for (const check of checksForLevel(level)) {
    const startedAt = Date.now();
    console.log(`\n[UI VERIFY ${level}] ${check.name}`);
    const result = spawnSync(process.execPath, [path.join(ROOT, check.cli), ...check.args], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: true
    });
    const item = {
      name: check.name,
      command: [process.execPath, check.cli, ...check.args].join(' '),
      passed: result.status === 0,
      exitCode: result.status,
      durationMs: Date.now() - startedAt
    };
    results.push(item);
    if (!item.passed) {
      passed = false;
      break;
    }
  }

  const report = {
    schemaVersion: 1,
    round,
    level,
    passed,
    generatedAt: new Date().toISOString(),
    results
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const reportPath = current?.status === 'active'
    ? path.join(EVIDENCE_DIR, `${round}-verify.json`)
    : path.join(EVIDENCE_DIR, 'latest-verify.json');
  writeJson(reportPath, report);
  console.log(`\n验证结果：${passed ? 'PASS' : 'FAIL'} / ${portableRelative(reportPath)}`);
  if (!passed) process.exitCode = 1;
}

function closeRound(args) {
  const current = loadCurrent();
  if (!current || current.status !== 'active') throw new Error('没有进行中的 UI 轮次');

  const settlement = parseSettlementArgs(args);
  const { outcome } = settlement;
  const evidence = String(getArg(args, 'evidence') || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const missingEvidence = evidence.filter(item => !fs.existsSync(path.resolve(ROOT, item)));
  if (missingEvidence.length) {
    throw new Error(`视觉证据不存在：${missingEvidence.join(', ')}`);
  }

  const backlog = loadBacklog();
  const task = backlog.items.find(item => item.id === current.taskId);
  if (!task) throw new Error(`backlog 中找不到 ${current.taskId}`);
  const verifyPath = path.join(EVIDENCE_DIR, `${current.round}-verify.json`);
  const verifyReport = fs.existsSync(verifyPath) ? readJson(verifyPath) : null;

  if (!evidence.length) throw new Error('结算至少需要一个真实视觉证据路径');
  if (outcome === 'IMPROVED' || outcome === 'NEUTRAL') {
    if (!verifyReport?.passed) throw new Error(`${outcome} 需要通过的自动化验证报告`);
    if (!verificationLevelMeets(verifyReport.level, task.minimumVerification || 'L2')) {
      throw new Error(`验证级别 ${verifyReport.level} 低于任务要求 ${task.minimumVerification || 'L2'}`);
    }
  }

  const closedAt = new Date().toISOString();
  task.status = outcome === 'IMPROVED' ? 'done' : 'queued';
  task.lastOutcome = outcome;
  task.lastValue = settlement.value;
  task.lastEvidenceGrade = settlement.evidenceGrade;
  task.lastDecision = settlement.decision;
  task.lastEvidenceAt = closedAt.slice(0, 10);
  task.attempts = Number(task.attempts || 0) + 1;
  task.evidence = [...new Set([...(task.evidence || []), ...evidence])];
  task.lastSettlement = {
    outcome,
    value: settlement.value,
    evidenceGrade: settlement.evidenceGrade,
    guardrails: settlement.guardrails,
    counterevidence: settlement.counterevidence,
    capabilityDelta: settlement.capabilityDelta,
    verificationCostSeconds: settlement.verificationCostSeconds,
    decision: settlement.decision,
    closedAt
  };
  delete task.startedAt;
  backlog.policy.consecutiveNeutralRounds = outcome === 'NEUTRAL'
    ? Number(backlog.policy.consecutiveNeutralRounds || 0) + 1
    : 0;
  backlog.updatedAt = closedAt.slice(0, 10);
  writeJson(BACKLOG_PATH, backlog);

  const runPath = path.join(RUNS_DIR, `${current.round}.md`);
  const runSource = fs.readFileSync(runPath, 'utf8');
  const settlementRecord = {
    ...settlement,
    automationEvidence: verifyReport ? portableRelative(verifyPath) : '未生成',
    visualEvidence: evidence,
    closedAt
  };
  fs.writeFileSync(runPath, `${settleRunRecord(runSource, settlementRecord)}\n`, 'utf8');

  current.status = 'closed';
  current.outcome = outcome;
  current.value = settlement.value;
  current.evidenceGrade = settlement.evidenceGrade;
  current.guardrails = settlement.guardrails;
  current.counterevidence = settlement.counterevidence;
  current.capabilityDelta = settlement.capabilityDelta;
  current.verificationCostSeconds = settlement.verificationCostSeconds;
  current.decision = settlement.decision;
  current.summary = settlement.summary;
  current.evidence = evidence;
  current.closedAt = closedAt;
  writeJson(CURRENT_PATH, current);

  const stateSource = fs.readFileSync(STATE_PATH, 'utf8');
  const nextRound = incrementRound(current.round);
  fs.writeFileSync(
    STATE_PATH,
    stateSource.replace(/^round_next:\s*R\d+$/m, `round_next: ${nextRound}`),
    'utf8'
  );

  console.log(`已结算 ${current.round}：${outcome}`);
  console.log(`下一轮：${nextRound}`);
  const next = selectNextItem(backlog.items);
  if (next) console.log(`下一建议：${next.id} / ${next.title}`);
}

function printHelp() {
  console.log(`用法：
  node scripts/ui-iteration.mjs status
  node scripts/ui-iteration.mjs start
  node scripts/ui-iteration.mjs verify --level=L1|L2|L3
  node scripts/ui-iteration.mjs close --outcome=IMPROVED --value=V2 --evidence-grade=E1 --guardrails=PASS --counterevidence="尚无真实用户数据" --capability-delta="SEED：新增跨端可读性断言" --verification-cost=6m --decision=CONTINUE --summary="..." --evidence="path-a,path-b"`);
}

export function main(args = process.argv.slice(2)) {
  const command = args[0] || 'status';
  if (command === 'status') return printStatus();
  if (command === 'start') return startRound();
  if (command === 'verify') return verify(String(getArg(args, 'level') || 'L2').toUpperCase());
  if (command === 'close') return closeRound(args.slice(1));
  if (command === 'help' || command === '--help' || command === '-h') return printHelp();
  throw new Error(`未知命令：${command}`);
}

const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`UI iteration error: ${error.message}`);
    process.exitCode = 1;
  }
}
