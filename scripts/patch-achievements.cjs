const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'ui', 'AchievementPopup.js');
let text = fs.readFileSync(file, 'utf8');

// 普通成就定义：key -> { name, icon, desc }
const NORMAL_ACHIEVEMENTS = {
  rebel_youth:       { name: '叛逆少年', icon: '🎸', desc: '在序章选择从延边二中退学，走上叛逆之路。' },
  street_uni:        { name: '社会大学', icon: '🏃', desc: '高中退学后选择混社会，把街头当作真正的课堂。' },
  stall_guerrilla:   { name: '地摊游击队', icon: '🏃', desc: '摆地摊被城管驱赶后，换个地方继续和城管打游击。' },
  skewer_master:     { name: '烤串大师', icon: '🍢', desc: '在延边夜市把烤串练成一门手艺，相信干啥都能成。' },
  ten_k_letter:      { name: '万字求职信', icon: '✉️', desc: '破釜沉舟只投新东方，用万字求职信打动俞敏洪。' },
  three_tries:       { name: '三试不退', icon: '🔥', desc: '新东方试讲两次失败后，仍坚持争取第三次机会。' },
  born_lecturer:     { name: '天生讲师', icon: '🎤', desc: '通过新东方试讲，正式成为GRE讲师。' },
  quote_guru:        { name: '语录教父', icon: '💬', desc: '把课堂段子打磨成招牌语录，成为“老罗语录”源头。' },
  education_light:   { name: '教育之光', icon: '📖', desc: '在新东方时期选择投身教育改革。' },
  last_lesson:       { name: '最后一课', icon: '🎓', desc: '辞去新东方工作，向讲台和学生告别。' },
  idealist:          { name: '理想主义者', icon: '🔥', desc: '离开新东方后创办牛博网，投身理想主义写作平台。' },
  no_compromise:     { name: '不妥协', icon: '⚔️', desc: '牛博网面临压力时拒绝删帖，守住内容底线。' },
  copywriter_god:    { name: '文案之神', icon: '📝', desc: '在牛博网写下西门子冰箱维权檄文，一战封神。' },
  rights_fighter:    { name: '维权斗士', icon: '🔨', desc: '决定向西门子维权，为消费者讨要说法。' },
  rational_rights:   { name: '理性维权者', icon: '⚖️', desc: '选择走法律途径，起诉西门子。' },
  smash_fridge:      { name: '砸冰箱', icon: '🔨', desc: '在西门子总部当众砸冰箱，把维权变成公共事件。' },
  hammer_inspire:    { name: '锤子灵感', icon: '🔨', desc: '从砸冰箱的锤子中获得灵感，决定用它命名手机品牌。' },
  iron_hammer:       { name: '铁锤罗', icon: '🔨', desc: '组织更大规模的砸冰箱活动，把维权推向高潮。' },
  hammer_born:       { name: '锤子诞生', icon: '🔨', desc: '正式宣布公司名为“锤子科技”。' },
  just_do_it:        { name: '不要怂就是干', icon: '🚀', desc: '决定自己创业做手机，900万也敢注册公司。' },
  makeshift_team:    { name: '草台班子', icon: '🎪', desc: '带着英语老师和设计师，硬着头皮组队做手机。' },
  crossroad:         { name: '十字路口', icon: '✚', desc: '在“科技与人文”的十字路口，选择两者都要。' },
  product_proof:     { name: '产品力证明', icon: '💡', desc: '拿到融资后全力投入Smartisan T1研发。' },
  gongsun_hao:       { name: '公孙浩', icon: '👴', desc: '坚持T1售价不低于2500，死撑高端定位。' },
  if_gold:           { name: 'iF金奖', icon: '🏆', desc: '借iF设计金奖之势为产品和品牌造势。' },
  never_compromise:  { name: '永不妥协', icon: '💎', desc: '宁可公司倒闭，也不发布不够完美的产品。' },
  supply_chain_killer:{ name: '供应链杀手', icon: '💣', desc: '因供应链问题与富士康决裂，另寻出路。' },
  t2_rescue:         { name: 'T2抢救', icon: '📦', desc: '在T2艰难上市后，坚持让它留在牌桌上。' },
  iron_ceo:          { name: '铁腕CEO', icon: '👔', desc: '进行人事换血，引入能打硬仗的新鲜血液。' },
  endure_humiliation:{ name: '忍辱负重', icon: '🎭', desc: '为了生存向现实低头，承受外界的嘲讽。' },
  capital_power:     { name: '资本的力量', icon: '💼', desc: '接受成都10亿投资，用资本为公司续命。' },
  anti_fake:         { name: '打假打假者', icon: '📋', desc: '实名举报方舟子，公开对峙“打假者”。' },
  fight_to_end:      { name: '死磕到底', icon: '⚖️', desc: '对方舟子索赔案追查到底，不肯和解。' },
  last_stand:        { name: '背水一战', icon: '🏟️', desc: '在鸟巢发布会上押注TNT，孤注一掷。' },
  quiet:             { name: '安静！', icon: '🤫', desc: 'TNT演示现场要求观众“安静”，造就名场面。' },
  real_man:          { name: '真·汉子', icon: '💪', desc: '面对6亿债务选择不破产，个人扛下还款责任。' },
  industry_curse:    { name: '行业冥灯', icon: '💀', desc: '连续在多个风口踩雷，被调侃为“行业冥灯”。' },
  let_go_pride:      { name: '放下身段', icon: '🚗', desc: '签约抖音直播带货，弯下腰卖货还债。' },
  make_friend:       { name: '交个朋友', icon: '🤝', desc: '认真做带货主播，成立“交个朋友”直播间。' },
  word_power:        { name: '文字的力量', icon: '📝', desc: '选择把人生经历写成一本书。' },
  first_payment:     { name: '第一笔', icon: '💰', desc: '直播带货还清第一笔大额债务。' },
  traffic_king:      { name: '流量之王', icon: '📱', desc: '在短视频与直播时代成为顶级流量。' },
  talkshow_king:     { name: '脱口秀之王', icon: '🎤', desc: '在脱口秀舞台上大放异彩，回归表达者本色。' },
  true_repay:        { name: '真还传', icon: '💰', desc: '通过直播等方式开始偿还巨额债务。' },
  true_repay_final:  { name: '真还传·终章', icon: '📖', desc: '还清全部债务，完成“真还传”。' },
  last_idealist:     { name: '最后的理想主义者', icon: '🌟', desc: '在创业末期仍坚持理想主义底色。' },
  hermit:            { name: '归隐山林', icon: '🏔️', desc: '选择退出江湖，去大理隐居。' },
  ai_prophet:        { name: 'AI先知', icon: '🤖', desc: '在AI浪潮中继续押注科技未来。' },
  pass_torch:        { name: '薪火相传', icon: '🕯️', desc: '从创业者转型为创业导师，帮助年轻人少走弯路。' },
  podcast_king:      { name: '播客之王', icon: '🎙️', desc: '坚持做播客，把表达变成新阵地。' },
  let_go_obsession:  { name: '放下执念', icon: '🕊️', desc: '选择AI软件+播客+稳步前进，不再孤注一掷。' },
  never_give_up:     { name: '永不言弃', icon: '🔥', desc: '决定最后再做一次硬件，重新冲锋。' },
  reconcile:         { name: '与世界和解', icon: '🕊️', desc: '选择放下对抗，以平和心态结束这一章。' },
  // 补充之前缺失的触发项
  debt_free:         { name: '无债一身轻', icon: '💰', desc: '扛下6亿债务后终于还清，信用重生。' },
  comeback_king:     { name: '东山再起', icon: '👑', desc: '在低谷后重新创业，试图王者归来。' },
  idealist_forever:  { name: '永远的理想主义者', icon: '⭐', desc: '无论成败，始终未改理想主义底色。' },
  pragmatist:        { name: '现实主义者', icon: '🧠', desc: '在关键节点选择最务实、最理性的出路。' },
  // 新增：对应结局分支中遗漏的成就
  digital_blogger:   { name: '数码博主', icon: '📱', desc: '选择成为数码博主，用嘴继续战斗。' },
  monk_name:         { name: '法号志恒', icon: '🧘', desc: '看破红尘，选择出家修行。' },
  luo_returns:       { name: '罗老师回来了', icon: '🔙', desc: '集齐砸冰箱、真还传、天生骄傲等标志后选择回归。' },
  luo_foundation:    { name: '罗老师基金会', icon: '💡', desc: '选择投身公益，用影响力资助贫困学生。' }
};

const startMarker = 'export const ALL_ACHIEVEMENTS = {';
const endMarker = '  // 隐藏成就';
const startIdx = text.indexOf(startMarker);
const endIdx = text.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers');
  process.exit(1);
}

let normalBlock = 'export const ALL_ACHIEVEMENTS = {\n';
normalBlock += '  // 普通成就（来自 story choices）\n';
for (const [key, def] of Object.entries(NORMAL_ACHIEVEMENTS)) {
  normalBlock += `  ${key.padEnd(18)}: { name: '${def.name}', icon: '${def.icon}', desc: '${def.desc}' },\n`;
}
normalBlock += '  // 隐藏成就\n';

const newText = text.slice(0, startIdx) + normalBlock + text.slice(endIdx + endMarker.length);
fs.writeFileSync(file, newText);
console.log('Patched', Object.keys(NORMAL_ACHIEVEMENTS).length, 'normal achievements with desc.');
