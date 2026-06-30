// 修复脚本：修正 makeChoice 与 create() 中的重复代码
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'scenes', 'GameScene.js');
let src = fs.readFileSync(file, 'utf8');

// === 修复 1：makeChoice 中的重复声明 ===
const badMakeChoice = `    // 使用效果引擎应用属性变化
    const effects = choice.effects || {};
    const { state: newState, changes } = applyEffects(this.state, effects);
    this.state = newState;    // 使用效果引擎应用属性变化
    const effects = choice.effects || {};
    const stateBefore = this.state;
    const { state: newState, changes } = applyEffects(this.state, effects);
    this.state = newState;
    try { this.debug.logChoice(this.state.currentNode, choice.label, effects, stateBefore, this.state); } catch(e) {}`;

const goodMakeChoice = `    // 使用效果引擎应用属性变化
    const effects = choice.effects || {};
    const stateBefore = this.state;
    const { state: newState, changes } = applyEffects(this.state, effects);
    this.state = newState;
    try { this.debug.logChoice(this.state.currentNode, choice.label, effects, stateBefore, this.state); } catch(e) {}`;

if (src.indexOf(badMakeChoice) === -1) {
  throw new Error('[FIX] 未找到 makeChoice 错误代码块');
}
src = src.replace(badMakeChoice, goodMakeChoice);
console.log('[FIX] makeChoice 重复声明已修正');

// === 修复 2：create() 中的注释重复 ===
const badCreate = `    this.stats.update(this.state);

    // 新游戏：先显示天赋选择    this.stats.update(this.state);

    // 暴露调试接口到控制台`;

const goodCreate = `    this.stats.update(this.state);

    // 暴露调试接口到控制台`;

if (src.indexOf(badCreate) === -1) {
  throw new Error('[FIX] 未找到 create() 错误代码块');
}
src = src.replace(badCreate, goodCreate);
console.log('[FIX] create() 注释重复已修正');

fs.writeFileSync(file, src, 'utf8');
console.log('[FIX] 全部修正完成');
