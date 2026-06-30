const fs = require('fs');
const p = 'e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/story/10_act7.js';
let c = fs.readFileSync(p, 'utf8');
const endPattern = String.fromCharCode(10) + '};' + String.fromCharCode(10);
const lastIdx = c.lastIndexOf(endPattern);
if (lastIdx === -1) { console.error('No end pattern'); process.exit(1); }
const before = c.substring(0, lastIdx);
const newNodes = [
'',
'  act7_low_viewers: {',
'    act: ' + String.fromCharCode(39) + '第十七章' + String.fromCharCode(39) + ',',
'    actSub: ' + String.fromCharCode(39) + '测试直播 · 只有83个人看 2020.3' + String.fromCharCode(39) + ',',
'    sceneType: SCENE_TYPES.LIVESTREAM,',
'    character: ' + String.fromCharCode(39) + '老罗' + String.fromCharCode(39) + ',',
'    text: ' + String.fromCharCode(39) + '你坐在临时搭建的直播间里，灯光打得脸发烫。助手小声说： 罗老师，开播了。你看了一眼右上角——在线人数：83。其中有十几个是你让朋友来捧场的。你清了清嗓子，开始介绍第一款产品：一款蓝牙耳机。你讲了五分钟，弹幕只有两条——一条问这是老罗吗，另一条发了个...。你停下来，盯着屏幕，突然觉得嗓子有点干。83个人。你曾经在发布会现场面对过几万人，曾经一条微博被转发几万次。现在，83个人。你喝了一口水，继续讲下去。你告诉自己：这83个人里，也许有人会记住你说的某句话，也许有人会下单。也许。' + String.fromCharCode(39) + ',',
'    choices: [',
'      { label: 告诉自己：万人发布会也是从零开始的，83人不少了。, next: ' + String.fromCharCode(39) + 'act7_stream_daily' + String.fromCharCode(39) + ', effects: { pride: 1, pressure: -1 } },',
'      { label: 自嘲一句： + String.fromCharCode(39) + 83位朋友，我是老罗，今天咱们随便聊聊。 + String.fromCharCode(39) + , next: ' + String.fromCharCode(39) + 'act7_stream_daily' + String.fromCharCode(39) + ', effects: { pride: 0, reputation: 1 } },',
'      { label: 关掉直播，在车里坐了半小时才回家。, next: ' + String.fromCharCode(39) + 'act7_stream_daily' + String.fromCharCode(39) + ', effects: { pride: -1, pressure: 2 } }',
'    ],',
'    historyNote: ' + String.fromCharCode(39) + '历史上老罗首场正式直播前确实做过测试。2020年3月，他在抖音做了几场小规模测试直播，观看人数寥寥。为什么这件事重要：从万人发布会到83人直播间，这种落差本身就是一种归零。老罗后来回忆，最初几场直播他甚至不太会看弹幕，也不知道怎么和观众互动——一个曾经靠演讲征服观众的人，不得不从零学习一种全新的表达方式。' + String.fromCharCode(39) + ',',
'    progress: 97',
'  },'
].join(String.fromCharCode(10));
console.log('Script loaded, fragment length:', newNodes.length);
fs.writeFileSync(p, before + ',' + String.fromCharCode(10) + newNodes + String.fromCharCode(10) + endPattern, 'utf8');
console.log('Done');
