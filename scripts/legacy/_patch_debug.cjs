// 临时补丁脚本：为 GameScene.js 集成 DebugLogger
// 用 Node 直接做字符串替换，规避 Edit 工具在该文件上的匹配问题
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'scenes', 'GameScene.js');
let src = fs.readFileSync(file, 'utf8');
const before = src;

const replacements = [];

function replaceOnce(label, find, insert, where = 'after') {
  if (src.indexOf(find) === -1) {
    throw new Error(`[PATCH] 找不到锚点: ${label}\n  锚点: ${JSON.stringify(find).slice(0, 120)}`);
  }
  if (where === 'after') {
    src = src.replace(find, find + insert);
  } else if (where === 'before') {
    src = src.replace(find, insert + find);
  } else if (where === 'replace') {
    src = src.replace(find, insert);
  }
  replacements.push(label);
}

// 1. 添加 DebugLogger import（在 skillTree import 之后）
replaceOnce(
  'import DebugLogger',
  "import { SKILL_TREES, calculateExpGain } from '../data/skillTree.js';",
  "\nimport { DebugLogger } from '../systems/DebugLogger.js';"
);

// 2. 在 create() 中初始化 DebugLogger（在 randomEventSystem 之后）
replaceOnce(
  'init debug logger',
  '    this.randomEventSystem = new RandomEventSystem(this);\n',
  '    this.randomEventSystem = new RandomEventSystem(this);\n    this.debug = new DebugLogger();\n'
);

// 3. makeChoice 中记录选择：捕获 stateBefore 并在 applyEffects 后记录
replaceOnce(
  'logChoice in makeChoice',
  `    // 使用效果引擎应用属性变化
    const effects = choice.effects || {};
    const { state: newState, changes } = applyEffects(this.state, effects);
    this.state = newState;`,
  `    // 使用效果引擎应用属性变化
    const effects = choice.effects || {};
    const stateBefore = this.state;
    const { state: newState, changes } = applyEffects(this.state, effects);
    this.state = newState;
    try { this.debug.logChoice(this.state.currentNode, choice.label, effects, stateBefore, this.state); } catch(e) {}`
);

// 4. _performCheck 中记录检定（免费重试分支）
replaceOnce(
  'logCheck free retry',
  `        const nextNode = check.successNext;
        this._proceedToNode(choice, nextNode, currentNode);
      });
      return;
    }`,
  `        const nextNode = check.successNext;
        try { this.debug.logCheck(check.attr, check.min, rawAttrValue + checkBonus, true, nextNode); } catch(e) {}
        this._proceedToNode(choice, nextNode, currentNode);
      });
      return;
    }`
);

// 5. _performCheck 中记录检定（正常分支，动画回调内）
replaceOnce(
  'logCheck normal',
  `      // 跳转到对应节点
      const nextNode = passed ? check.successNext : check.failNext;
      this._proceedToNode(choice, nextNode, currentNode);
    });
  }`,
  `      // 跳转到对应节点
      const nextNode = passed ? check.successNext : check.failNext;
      try { this.debug.logCheck(check.attr, check.min, attrValue, passed, nextNode); } catch(e) {}
      this._proceedToNode(choice, nextNode, currentNode);
    });
  }`
);

// 6. _proceedAfterChoice 中记录联动事件
replaceOnce(
  'logComboTrigger',
  `    const comboTrigger = checkComboTriggers(this.state);
    if (comboTrigger) {
      try { toast.warning(comboTrigger.message, 4000); } catch(e) {}`,
  `    const comboTrigger = checkComboTriggers(this.state);
    if (comboTrigger) {
      try { this.debug.logComboTrigger(comboTrigger.id, comboTrigger.message); } catch(e) {}
      try { toast.warning(comboTrigger.message, 4000); } catch(e) {}`
);

// 7. 随机事件回调中记录随机事件
replaceOnce(
  'logRandomEvent',
  `        (effects, flag, eventId) => {
          // 随机事件音效
          try { this.audio.playRandomEvent(); } catch(e) {}`,
  `        (effects, flag, eventId) => {
          try { this.debug.logRandomEvent(eventId, stage ? stage.id : null); } catch(e) {}
          // 随机事件音效
          try { this.audio.playRandomEvent(); } catch(e) {}`
);

// 8. _showStageSettlement 中记录阶段结算（在方法开头之后）
replaceOnce(
  'logStageSettlement',
  `  _showStageSettlement(stage, onComplete) {
    this.state.triggeredEvents.add(\`stage_entry_\${stage.id}\`);`,
  `  _showStageSettlement(stage, onComplete) {
    try { this.debug.logStageSettlement(stage.id, this.state); } catch(e) {}
    this.state.triggeredEvents.add(\`stage_entry_\${stage.id}\`);`
);

// 9. showEnding 中记录结局（在 scene.start 之前）
replaceOnce(
  'logEnding',
  `    this.scene.start('EndingScene', { state: this.state, ending: endingKey });
  }`,
  `    try { this.debug.logEnding(endingKey, this.state); } catch(e) {}
    this.scene.start('EndingScene', { state: this.state, ending: endingKey });
  }`
);

// 10. 在 create() 末尾暴露 window.__luohammerDebug（在 loadNode 之前、新游戏分支之前）
replaceOnce(
  'expose window debug',
  `    this.stats.update(this.state);

    // 新游戏：先显示天赋选择`,
  `    this.stats.update(this.state);

    // 暴露调试接口到控制台
    if (this.debug && this.debug.isEnabled()) {
      window.__luohammerDebug = {
        logger: this.debug,
        exportLogs: () => this.debug.downloadLogs(),
        getSummary: () => this.debug.getSummary(),
        printSummary: () => console.table(this.debug.getSummary()),
        state: () => this.state
      };
      console.log('[Debug] 调试模式已启用。可用命令：\\n  __luohammerDebug.printSummary()\\n  __luohammerDebug.exportLogs()\\n  __luohammerDebug.state()');
    }

    // 新游戏：先显示天赋选择`
);

if (src === before) {
  throw new Error('[PATCH] 未发生任何替换');
}

fs.writeFileSync(file, src, 'utf8');
console.log('[PATCH] GameScene.js 修改完成，共执行 ' + replacements.length + ' 处替换：');
replacements.forEach((r, i) => console.log('  ' + (i + 1) + '. ' + r));
