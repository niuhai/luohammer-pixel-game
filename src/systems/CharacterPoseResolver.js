export const CHARACTER_POSES = Object.freeze([
  'standing',
  'speaking',
  'angry',
  'depressed',
  'happy',
  'livestream',
  'young',
  'sitting',
  'middle'
]);

const VALID_POSES = new Set(CHARACTER_POSES);

export const STAGE_POSE_GROUPS = Object.freeze({
  youth: Object.freeze(['young']),
  teacher: Object.freeze(['standing', 'speaking', 'sitting', 'angry', 'happy']),
  startup: Object.freeze(['standing', 'speaking', 'sitting', 'angry', 'happy']),
  dark: Object.freeze(['middle', 'depressed', 'livestream']),
  repay: Object.freeze(['middle', 'depressed', 'livestream']),
  reborn: Object.freeze(['middle', 'depressed', 'livestream'])
});

export const STAGE_DEFAULT_POSES = Object.freeze({
  youth: 'young',
  teacher: 'standing',
  startup: 'standing',
  dark: 'middle',
  repay: 'middle',
  reborn: 'middle'
});

/** 老罗 1972 年生，2016 年 44 岁起应使用 middle 中年立绘 */
export const MIDDLE_AGE_YEAR = 2016;

/**
 * 从 actSub 提取事件年份。取最后一个 4 位年份，
 * 避开「小米4价1999横空出世 · 市场冲击 2014」这类价格数字的误命中。
 */
export function extractNodeYear(actSub) {
  if (!actSub || typeof actSub !== 'string') return null;
  const matches = actSub.match(/(?:19|20)\d{2}/g);
  return matches ? parseInt(matches[matches.length - 1], 10) : null;
}

/**
 * 年份感知的立绘池阶段键：startup（2012-2018）跨了 40→46 岁，
 * 阶段内 ≥2016 的节点按中年立绘池（dark 组：middle/depressed/livestream）解析。
 */
export function resolvePoseStageKey(stageId, year) {
  if (stageId === 'startup' && year != null && year >= MIDDLE_AGE_YEAR) return 'dark';
  return stageId;
}

/**
 * Restrict a requested emotion/pose to the character's current age group.
 * When that emotion has no age-matched sprite, retain the age-matched scene
 * pose or fall back to the stage's neutral sprite.
 */
export function resolveStageAwarePose(stageId, requestedPose, scenePose = 'standing') {
  const requested = VALID_POSES.has(requestedPose) ? requestedPose : null;
  const scene = VALID_POSES.has(scenePose) ? scenePose : 'standing';
  const allowed = STAGE_POSE_GROUPS[stageId];

  if (!allowed) return requested || scene;
  if (requested && allowed.includes(requested)) return requested;
  if (allowed.includes(scene)) return scene;
  return STAGE_DEFAULT_POSES[stageId] || scene;
}
