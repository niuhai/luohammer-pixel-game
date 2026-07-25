/**
 * 一次性脚本：导出全部剧情节点 + 结局判定逻辑为 GPT 审查用的 Markdown。
 * 用法：node scripts/export-story-for-review.mjs
 * 输出：story-for-review.md
 */
import { STORY } from '../src/data/story.js';
import { ENDINGS } from '../src/data/endings.js';
import { writeFileSync } from 'fs';

// 按 progress 字段排序（没有则按 key），保证阅读顺序符合剧情推进
const nodes = Object.entries(STORY).map(([id, node]) => ({ id, ...node }));
nodes.sort((a, b) => {
  const pa = a.progress ?? 9999;
  const pb = b.progress ?? 9999;
  if (pa !== pb) return pa - pb;
  return a.id.localeCompare(b.id);
});

const lines = [];
lines.push('# 罗的十字路口 · 剧情全量审查材料');
lines.push('');
lines.push('> 本文件供 AI 审查员通读，目标是找出长程不一致、人物弧光断裂、伏笔未收、结局判定不成立等问题。');
lines.push('> 节点按剧情推进顺序（progress 字段）排序。每个节点包含：剧情文案、选项、选项指向、属性影响。');
lines.push('');
lines.push('---');
lines.push('');

// === Part 0: 罗永浩真实背景（让审查员理解历史原型，避免把真实事件误判为剧情漏洞）===
lines.push('## Part 0 · 罗永浩真实背景（审查前必读）');
lines.push('');
lines.push('> 本游戏基于真实公众人物罗永浩（1972年生于吉林延边）的人生经历改编。');
lines.push('> 审查时请以此背景为参照，判断剧情是否失真、人物语气是否符合原型、时间线是否错乱。');
lines.push('');
lines.push('### 真实人生时间线');
lines.push('');
lines.push('| 年份 | 事件 |');
lines.push('|------|------|');
lines.push('| 1972 | 生于吉林延边，父亲罗昌珍曾任和龙县县委书记 |');
lines.push('| 1989 | 高二辍学（因厌学+与教育体制冲突），此后摆摊、卖烤串、倒腾药材、去韩国打工 |');
lines.push('| 2000 | 自学英语，给俞敏洪写万字求职信，三次试讲后入职新东方 |');
lines.push('| 2001-2006 | 新东方英语教师，以"老罗语录"走红网络（MP3录音在校园传播） |');
lines.push('| 2006 | 从新东方辞职，创办牛博网（Bullogger）——一个聚合式博客平台 |');
lines.push('| 2008 | 牛博网因内容敏感被关停；开始酝酿做手机 |');
lines.push('| 2011 | 因西门子冰箱门关不严，在北京西门子总部砸冰箱维权，成为年度新闻事件 |');
lines.push('| 2012 | 创办锤子科技，发布 Smartisan OS；定下"用理想主义做手机"的基调 |');
lines.push('| 2014 | 发布首款手机 Smartisan T1，获 iF 设计金奖，但产能和销量均不达预期 |');
lines.push('| 2015 | 发布 T2，但公司资金链已开始紧张；与王自如在 Zealer 演播室公开辩论（"星巴克事件"原型） |');
lines.push('| 2016 | 发布 M1/M1L，以及概念产品 TNT 工作站（语音+触控交互革命） |');
lines.push('| 2018.5 | 鸟巢发布会，TNT 现场演示演砸——"安静！吵到我用 TNT 了"成年度 meme |');
lines.push('| 2018 下半年 | 锤子科技资金链彻底断裂，债务从约 2 亿膨胀到 6 亿；老罗个人签无限责任担保约 1.2 亿 |');
lines.push('| 2019 | 锤子科技被字节跳动收购核心团队；老罗本人被限制高消费（"老赖"） |');
lines.push('| 2020.4 | 老罗首场抖音直播带货，开启"真还传"——目标还清 6 亿债务 |');
lines.push('| 2020-2022 | 持续直播带货，偿还大部分债务；成为抖音头部带货主播之一 |');
lines.push('| 2022 | 创办"细红线"（Thin Red Line），进军 AR 领域 |');
lines.push('| 2023 | 细红线发布首款 AR 产品，但市场反响平淡 |');
lines.push('| 2024-2025 | 细红线战略调整，转向 AI 赛道（游戏剧情虚构到此为止） |');
lines.push('');
lines.push('### 人物性格特征（审查语气是否贴合原型）');
lines.push('');
lines.push('- **理想主义底色**：老罗反复强调"通过干干净净地赚钱让人相信干干净净地赚钱是可能的"，理想主义是他的人格内核');
lines.push('- **嘴硬与自嘲并存**：失败后从不认怂，但会用自嘲化解尴尬（"安静！吵到我用 TNT 了"即是典型）');
lines.push('- **演讲能力强**：被公认为"中国最会演讲的科技 CEO"，发布会是他的主场');
lines.push('- **反权威气质**：从砸冰箱到怼王自如，始终站在"挑战者"位置，不向权威低头');
lines.push('- **情绪外露**：公开发布会上哭过、笑过、骂过，不掩饰情绪');
lines.push('- **从狂妄到谦逊的弧光**：早期（牛博网-锤子前期）语气狂妄自信；破产后（真还传时期）明显谦逊，开始自嘲和反思');
lines.push('- **"真还传"的伦理意义**：他没有申请破产清算（本可合法赖掉个人担保的 1.2 亿），而是选择直播带货偿还全部债务——这在商界极为罕见，是他"理想主义"人格的最终证明');
lines.push('');
lines.push('### 审查时的人物语气参照');
lines.push('');
lines.push('| 阶段 | 语气特征 | 游戏对应章节 |');
lines.push('|------|---------|------------|');
lines.push('| 少年期（延边） | 叛逆、困惑、不甘平庸 | 序章-第1章 |');
lines.push('| 青年期（新东方） | 锋芒毕露、开始自信、理想主义萌芽 | 第2章-第3章 |');
lines.push('| 创业期（牛博网-锤子） | 狂妄自信、英雄主义、"改变世界" | 第4章-第5章 |');
lines.push('| 危机期（TNT-破产） | 嘴硬但开始动摇、自嘲增多、压力外溢 | 第6章 |');
lines.push('| 还债期（真还传） | 谦逊、务实、但内核仍是理想主义 | 第7章 |');
lines.push('| 重启期（AR-AI） | 谨慎、沉淀、不再轻易狂妄 | 第8-9章 |');
lines.push('');
lines.push('> **审查重点**：游戏文案的语气是否匹配上述弧光？是否存在"破产前就谦逊"或"还债期还狂妄"的违和？');
lines.push('');
lines.push('### 关键人物关系（审查剧情中人物互动是否合理）');
lines.push('');
lines.push('| 人物 | 与老罗关系 | 游戏中的角色 |');
lines.push('|------|-----------|------------|');
lines.push('| 罗昌珍 | 父亲，曾任和龙县县委书记 | 序章"父亲的教育方式"节点 |');
lines.push('| 俞敏洪 | 新东方创始人，老罗的伯乐 | 第2章"俞敏洪办公室"节点 |');
lines.push('| 朱萧木 | 锤子科技001号员工，后追随老罗做电子烟 | 游戏中简化为"核心团队成员" |');
lines.push('| 钱晨 | 锤子科技硬件合伙人，前摩托罗拉高管 | 游戏中简化为"硬件合伙人" |');
lines.push('| 王自如 | Zealer 创始人，2014与老罗公开辩论 | 第4章"王自如论战"节点 |');
lines.push('| 苗颖 | 锤子科技 CFO | 游戏中简化为"财务总监" |');
lines.push('| 罗永浩妻子 | 不愿曝光姓名，老罗称"她是我最后的退路" | 游戏中作为"家人"出现 |');
lines.push('| 字节跳动 | 2019收购锤子核心团队 | 第6章"字节收购"节点 |');
lines.push('');
lines.push('> **审查重点**：游戏中是否出现了不该出现的人物？人物关系是否与史实冲突？');
lines.push('');
lines.push('### 老罗标志性金句（审查文案是否有"老罗味"）');
lines.push('');
lines.push('以下是罗永浩公开说过的真实金句，游戏文案应与此风格一致——反讽、自嘲、突然的认真、理想主义底色：');
lines.push('');
lines.push('1. "彪悍的人生不需要解释"');
lines.push('2. "通过干干净净地赚钱让人相信干干净净地赚钱是可能的"');
lines.push('3. "不被嘲笑的梦想是不值得去实现的"');
lines.push('4. "永远年轻，永远热泪盈眶"');
lines.push('5. "我不是为了输赢，我就是认真"');
lines.push('6. "安静！吵到我用 TNT 了"（鸟巢翻车现场，用自嘲化解尴尬）');
lines.push('7. "通往牛逼的路上，风景差得让人只想说脏话，但创业者在意的是远方"');
lines.push('8. "在高端局里，你每次出牌都要考虑对方会不会觉得你是个傻子"');
lines.push('9. "我不是为了赢，我就是认真"');
lines.push('10. "你如果是一个问题青年，那你就去做问题青年该做的事"');
lines.push('');
lines.push('> **审查重点**：游戏文案是否有上述语感？是否过于书面化/翻译腔？是否缺少老罗标志性的"反讽+认真"切换？');
lines.push('');
lines.push('### 商业数据参照（审查数值是否离谱）');
lines.push('');
lines.push('| 项目 | 真实数据 |');
lines.push('|------|---------|');
lines.push('| 锤子科技估值峰值 | 约 26 亿人民币（2015年） |');
lines.push('| 鸟巢发布会成本 | 场地费+搭建+宣传超 3000 万 |');
lines.push('| 砸冰箱事件 | 砸了 3 台西门子冰箱 |');
lines.push('| 锤子科技总债务 | 约 6 亿（公司约5亿+个人担保约1.2亿） |');
lines.push('| 真还传首场直播 | 2020.4.1，观看超 4800 万，销售额超 1.1 亿 |');
lines.push('| 真还传累计还债 | 截至 2022 年约还清 4-5 亿，剩余继续偿还 |');
lines.push('| 锤子科技员工峰值 | 约 700-800 人 |');
lines.push('| 锤子裁员后 | 约 几十人 |');
lines.push('');
lines.push('> **审查重点**：游戏中的财富数值（wealth 属性）是否与上述量级匹配？6亿债务节点是否有足够的压迫感？');
lines.push('');
lines.push('### 争议事件与敏感边界');
lines.push('');
lines.push('- **砸冰箱事件（2011）**：维权正当但方式激进，游戏应呈现"暴力维权的伦理困境"而非单纯英雄主义');
lines.push('- **王自如辩论（2014）**：老罗在 Zealer 演播室当众"审问"王自如，被批"恃强凌弱"，游戏应呈现两面性');
lines.push('- **星巴克事件**：老罗曾公开吐槽星巴克中杯/大杯/超大杯命名，被批"矫情"——游戏用作"理想主义与现实的摩擦"隐喻');
lines.push('- **被限制高消费（2019）**：法律意义上的"老赖"，但老罗强调是"限制高消费"非"失信被执行人"——措辞需准确');
lines.push('- **真还传**：老罗选择还债而非破产清算，是道德选择而非法律义务——游戏应突出"主动选择"而非"被迫"');
lines.push('');
lines.push('### 老罗的公开反思（审查剧情是否有反思深度）');
lines.push('');
lines.push('老罗在多个采访中的自我反思，游戏剧情应呼应这些观点：');
lines.push('');
lines.push('1. **关于 TNT**："如果当时不演示，也许公司还能多撑半年"——承认决策失误');
lines.push('2. **关于理想主义**："我不是说理想主义不对，我是说理想主义要配合理性的方法论"——反思而非否定');
lines.push('3. **关于负债**："6 亿不是数字，是每天醒来都要面对的重量"——债务的体感而非抽象');
lines.push('4. **关于直播带货**："放下面子赚钱不丢人，死要面子才丢人"——从抗拒到接受的心路');
lines.push('5. **关于创业者**："创业最残忍的不是失败，是失败的时候你得亲手把那些相信你的人一个一个送走"——对裁员的内疚');
lines.push('6. **关于还债**："我不是英雄，我只是不想欠着别人的钱死掉"——还债的朴素动机');
lines.push('');
lines.push('> **审查重点**：游戏剧情是否只有"事件描述"而缺少"反思深度"？老罗的内心独白是否呼应了上述反思？');
lines.push('');
lines.push('### 游戏的虚构与真实边界');
lines.push('');
lines.push('- **真实事件**：砸冰箱、鸟巢 TNT 演砸、6 亿债务、真还传直播带货——这些是真实历史，游戏忠实还原');
lines.push('- **虚构部分**：玩家的选择会改变老罗的"结局"（现实中老罗仍在还债+创业，没有"最终结局"），游戏提供 35 种平行宇宙式结局');
lines.push('- **艺术加工**：部分对话和心理描写为虚构，但基于公开采访和自传材料合理推断');
lines.push('- **敏感边界**：涉及新东方、西门子、字节跳动等真实公司，剧情不应过度丑化或美化任何一方');
lines.push('');
lines.push('---');
lines.push('');

// === Part 1: 结局判定逻辑 ===
lines.push(`## Part 1 · ${ENDINGS.length} 种结局的判定条件（审查目标）`);
lines.push('');
lines.push('审查时请关注：玩家在前 14 章的选择路径，是否真的能自然导出这些结局？是否存在"某结局永远无法达成"或"某结局过于容易"的情况？');
lines.push('');
ENDINGS.forEach((e, idx) => {
  lines.push(`### ${idx + 1}. ${e.name}（id: ${e.id}，priority: ${e.priority}）`);
  lines.push('');
  lines.push('**副标题**：' + (e.subtitle || ''));
  lines.push('');
  lines.push('**描述**：' + (e.desc || ''));
  lines.push('');
  lines.push('**尊重点**：' + (e.respect || ''));
  lines.push('');
  lines.push('**触发条件**：');
  lines.push('```js');
  lines.push(`check(state, flags) {`);
  lines.push(`  ${e.check.toString()}`);
  lines.push(`}`);
  lines.push('```');
  lines.push('');
});

lines.push('---');
lines.push('');

// === Part 2: 全部剧情节点 ===
lines.push('## Part 2 · 全部剧情节点（按推进顺序）');
lines.push('');
lines.push(`共 ${nodes.length} 个节点。`);
lines.push('');

nodes.forEach((node, i) => {
  lines.push(`### [${i + 1}/${nodes.length}] ${node.id}`);
  lines.push('');
  if (node.act) lines.push(`- **章节**：${node.act}`);
  if (node.actSub) lines.push(`- **场景**：${node.actSub}`);
  if (node.sceneType) lines.push(`- **场景类型**：${node.sceneType}`);
  if (node.character) lines.push(`- **角色**：${node.character}`);
  if (node.mood) lines.push(`- **情绪**：${node.mood}`);
  lines.push('');

  lines.push('**剧情文案**：');
  lines.push('');
  const plainText = (node.text || '').replace(/<[^>]+>/g, '').trim();
  lines.push('> ' + plainText.split('\n').join('\n> '));
  lines.push('');

  if (node.choices && node.choices.length > 0) {
    lines.push('**选项**：');
    lines.push('');
    node.choices.forEach((c, ci) => {
      const label = (c.label || '').replace(/<[^>]+>/g, '').trim();
      lines.push(`${ci + 1}. 「${label}」`);
      lines.push(`   - 指向：\`${c.next || '（无）'}\``);
      if (c.effects) {
        const effStr = Object.entries(c.effects)
          .filter(([, v]) => v !== 0)
          .map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`)
          .join('，');
        if (effStr) lines.push(`   - 影响：${effStr}`);
      }
      if (c.requires) {
        const reqStr = Object.entries(c.requires)
          .map(([k, v]) => `${k}≥${v}`)
          .join('，');
        lines.push(`   - 需求：${reqStr}`);
      }
      if (c.check) {
        lines.push(`   - 检定：${c.check.attr} ≥ ${c.check.min}`);
        lines.push(`     - 成功→\`${c.check.successNext}\`：${c.check.successText || ''}`);
        lines.push(`     - 失败→\`${c.check.failNext}\`：${c.check.failText || ''}`);
        if (c.check.successEffects || c.check.failEffects) {
          const sEff = c.check.successEffects
            ? Object.entries(c.check.successEffects).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join('，')
            : '（无）';
          const fEff = c.check.failEffects
            ? Object.entries(c.check.failEffects).map(([k, v]) => `${k}${v > 0 ? '+' : ''}${v}`).join('，')
            : '（无）';
          lines.push(`     - 成功影响：${sEff}`);
          lines.push(`     - 失败影响：${fEff}`);
        }
      }
      if (c.achievement) {
        lines.push(`   - 成就：${c.achievement} ${c.icon || ''}`);
      }
    });
    lines.push('');
  }

  if (node.historyNote) {
    lines.push('**历史背景**：');
    lines.push('');
    lines.push('> ' + node.historyNote.split('\n').join('\n> '));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
});

// === Part 3: 审查问题清单 ===
lines.push('## Part 3 · 请重点审查以下问题');
lines.push('');
lines.push('### A. 长程一致性');
lines.push('- 老罗的人物语气从第 1 章到第 9 章是否有合理的成长弧光？（少年→青年→中年）');
lines.push('- 是否有"第 3 章说过的话，第 7 章自相矛盾"的情况？');
lines.push('- 角色立绘/场景类型与剧情是否匹配？（如：破产了却还在办公室场景）');
lines.push('');
lines.push('### B. 伏笔与回收');
lines.push('- 前期埋下的伏笔（人物、承诺、关键道具）后期是否都有回收？');
lines.push('- 是否有"提了一嘴就消失"的重要元素？');
lines.push('');
lines.push('### C. 结局可达性');
lines.push('- 35 种结局的判定条件，玩家是否能自然走到？');
lines.push('- 是否存在"某结局的属性阈值过高，前 14 章根本攒不够"的情况？');
lines.push('- 是否存在"两个结局判定重叠，玩家同时满足但只触发 priority 高的，导致另一个永远玩不到"？');
lines.push('');
lines.push('### D. 选择权重与体感');
lines.push('- 同一节点的多个选项，effects 是否有明显的"最优解"？（如果有，说明选择失去意义）');
lines.push('- 负面 effects 的选项是否有足够的叙事理由让玩家愿意选？（纯亏的选项玩家不会选）');
lines.push('- 是否有"四个选项 effects 几乎一样"的敷衍节点？');
lines.push('');
lines.push('### E. 史实与虚构的边界');
lines.push('- 罗永浩是真实公众人物，剧情是否过度丑化或美化？');
lines.push('- 历史事件的时间线是否有错乱？');
lines.push('');
lines.push('### F. 文学性（非必须，但影响评委体感）');
lines.push('- 哪些节点的文案明显比相邻节点弱？（标出节点 ID 即可，不需要重写）');
lines.push('- 哪些节点的"金句"过于套路化？（如"手在发抖""空气凝固"这类）');
lines.push('');

const out = lines.join('\n');
writeFileSync('story-for-review.md', out, 'utf-8');
console.log(`OK exported ${nodes.length} nodes + ${ENDINGS.length} endings to story-for-review.md`);
console.log(`size: ${(out.length / 1024).toFixed(1)} KB`);
console.log(`path: ${process.cwd()}/story-for-review.md`);
