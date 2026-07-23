import { rect } from '../primitives.js';
import { COLORS } from '../../../config.js';

export function drawCharacter(g, pose = 'standing') {
  const skin = COLORS.character?.skin || 0xf0c8a0;
  const hair = COLORS.character?.hair || 0x1a1a1a;
  const glasses = COLORS.character?.glasses || 0x1a1a1a;
  const glassesLens = COLORS.character?.glassesLens || 0x2a2a4e;
  let shirt = COLORS.character?.shirt || 0x1a1a1a;
  const pants = COLORS.character?.pants || 0x2a2a3e;
  const shoes = COLORS.character?.shoes || 0x0a0a0a;
  const outline = 0x0a0a0a;

  if (pose === 'young') shirt = 0x2a4a8a;

  // 1.5x scale: 所有尺寸乘以 1.5
  const S = 1.5;
  const cx = 400;
  const baseY = 440;
  const frame = Date.now() * 0.006;
  const isTalking = (pose === 'speaking' || pose === 'livestream');
  const bounce = isTalking ? Math.sin(frame * 0.3) * 3 : 0;

  let bodyLean = 0, headTilt = 0, shoulderDrop = 0;
  let bodyShorten = 0, legBend = 0, bodyWiden = 0;

  switch (pose) {
    case 'speaking': bodyLean = 6; break;
    case 'angry': bodyLean = 12; headTilt = 4; break;
    case 'depressed': headTilt = 12; shoulderDrop = 9; bodyShorten = 12; legBend = 6; break;
    case 'sitting': bodyShorten = 18; legBend = 18; break;
    case 'livestream': bodyLean = 3; break;
    case 'young': bodyWiden = -6; break;
    case 'middle': bodyWiden = 6; break;
  }

  const HW = Math.round(48 * S), HH = Math.round(48 * S);
  const BW = Math.round((54 + bodyWiden) * S), BH = Math.round((60 - bodyShorten) * S);
  const LW = Math.round(18 * S), LH = Math.max(12, Math.round((24 - Math.floor(legBend / 2)) * S));
  const SW = Math.round(18 * S), SH = Math.round(9 * S);
  const cy = baseY - bounce;

  // 椅子
  rect(g, cx - 36, cy - 6, 72, 66, 0x4a3a2a);
  rect(g, cx - 36, cy - 6, 72, 6, 0x3a2a1a);

  // 腿
  const legY = cy - LH - SH;
  rect(g, cx - LW - 3 + bodyLean, legY, LW, LH + legBend, pants);
  rect(g, cx + 3 + bodyLean, legY, LW, LH + legBend, pants);
  rect(g, cx - LW - 3 + bodyLean, legY, LW, 3, outline);
  rect(g, cx + 3 + bodyLean, legY, LW, 3, outline);

  // 鞋
  rect(g, cx - LW - 6 + bodyLean, cy - SH, SW, SH, shoes);
  rect(g, cx + bodyLean, cy - SH, SW, SH, shoes);

  // 身体（微胖：更宽）
  const bodyX = cx - BW / 2 + bodyLean;
  const bodyY = legY - BH;
  rect(g, bodyX, bodyY, BW, BH, shirt);
  rect(g, bodyX, bodyY, BW, 3, outline);
  rect(g, bodyX, bodyY, 3, BH, outline);
  rect(g, bodyX + BW - 3, bodyY, 3, BH, outline);

  // V领/翻领
  rect(g, cx - 12 + bodyLean, bodyY, 24, 12, 0x0a0a0a);
  rect(g, cx - 9 + bodyLean, bodyY + 3, 6, 12, shirt === 0x2a4a8a ? 0x1a3a6a : 0x2a2a2a);
  rect(g, cx + 3 + bodyLean, bodyY + 3, 6, 12, shirt === 0x2a4a8a ? 0x1a3a6a : 0x2a2a2a);

  // 纽扣
  rect(g, cx - 3 + bodyLean, bodyY + 21, 6, 6, 0x3a3a3a);
  rect(g, cx - 3 + bodyLean, bodyY + 36, 6, 6, 0x3a3a3a);

  // 领带（罗远标志性红领带）
  rect(g, cx - 6 + bodyLean, bodyY + 6, 12, 36, 0x8a1a1a);
  rect(g, cx - 3 + bodyLean, bodyY + 9, 6, 30, 0x6a0a0a);

  // 手臂
  const armY = bodyY + 6 + shoulderDrop;
  const armW = Math.round(15 * S), armH = Math.round(42 * S);

  switch (pose) {
    case 'speaking':
      rect(g, bodyX + BW + 3, armY - 42, armW, armH + 30, skin);
      rect(g, bodyX + BW + 6, armY - 72, 9, 36, skin);
      rect(g, bodyX + BW + 3, armY - 42, armW, 3, outline);
      rect(g, bodyX + BW + 3, armY - 78, 15, 12, skin);
      rect(g, bodyX + BW, armY - 72, 6, 9, skin);
      rect(g, bodyX + BW + 15, armY - 72, 6, 9, skin);
      rect(g, bodyX - armW - 3, armY + 6, armW, armH, skin);
      rect(g, bodyX - armW - 3, armY + 6, armW, 3, outline);
      break;
    case 'angry':
      rect(g, bodyX + BW + 3, armY - 36, armW, armH + 12, skin);
      rect(g, bodyX + BW + 6, armY - 60, 9, 30, skin);
      rect(g, bodyX - armW - 3, armY - 30, armW, armH, skin);
      rect(g, bodyX - armW, armY - 54, 9, 27, skin);
      // 锤子
      rect(g, bodyX + BW + 9, armY - 96, 6, 42, 0x4a3a2a);
      rect(g, bodyX + BW - 3, armY - 108, 24, 18, 0x6a6a6a);
      rect(g, bodyX + BW, armY - 105, 18, 12, 0x8a8a8a);
      break;
    case 'depressed':
      rect(g, bodyX - armW - 3, armY + 12, armW, armH + 6, skin);
      rect(g, bodyX + BW + 3, armY + 12, armW, armH + 6, skin);
      rect(g, bodyX - armW - 3, armY + 12, armW, 3, outline);
      rect(g, bodyX + BW + 3, armY + 12, armW, 3, outline);
      break;
    case 'sitting':
      rect(g, bodyX - armW - 3, armY + 12, armW, 24, skin);
      rect(g, bodyX + BW + 3, armY + 12, armW, 24, skin);
      rect(g, bodyX - armW - 3, armY + 12, armW, 3, outline);
      rect(g, bodyX + BW + 3, armY + 12, armW, 3, outline);
      break;
    case 'livestream':
      rect(g, bodyX - armW - 6, armY, armW, armH, skin);
      rect(g, bodyX + BW + 6, armY - 6, armW, armH, skin);
      rect(g, bodyX - armW - 9, armY + 36, 18, 9, skin);
      rect(g, bodyX + BW - 3, armY + 30, 18, 9, skin);
      rect(g, bodyX - armW - 12, armY + 39, 6, 12, skin);
      rect(g, bodyX + BW + 21, armY + 33, 6, 12, skin);
      break;
    default:
      rect(g, bodyX - armW - 3, armY + 3, armW, armH, skin);
      rect(g, bodyX + BW + 3, armY + 3, armW, armH, skin);
      rect(g, bodyX - armW - 3, armY + 3, armW, 3, outline);
      rect(g, bodyX + BW + 3, armY + 3, armW, 3, outline);
      break;
  }

  // ===== 头部（1.5x + 更圆更胖 = 罗远特征） =====
  const headX = cx - HW / 2 + bodyLean;
  const headY = bodyY - HH + 6 + headTilt;

  // 圆脸（更宽的椭圆，罗远是圆脸微胖）
  rect(g, headX, headY + 6, HW, HH - 6, skin);
  rect(g, headX + 6, headY, HW - 12, HH, skin);
  // 耳朵（更宽的脸需要更明显的耳朵）
  rect(g, headX - 3, headY + 18, 9, 18, skin);
  rect(g, headX + HW - 6, headY + 18, 9, 18, skin);
  // 下巴（更宽）
  rect(g, headX + 12, headY + HH - 6, 24, 9, skin);

  // 头部轮廓
  rect(g, headX, headY + 6, HW, 3, outline);
  rect(g, headX, headY + 6, 3, HH - 6, outline);
  rect(g, headX + HW - 3, headY + 6, 3, HH - 6, outline);
  rect(g, headX + 6, headY + HH - 3, HW - 12, 3, outline);

  // 寸头（罗远标志性：极短、微秃）
  rect(g, headX + 6, headY - 6, HW - 12, 18, hair);
  rect(g, headX + 12, headY - 12, HW - 24, 12, hair);
  rect(g, headX + 9, headY, HW - 18, 9, hair);
  rect(g, headX - 3, headY + 6, 12, 24, hair);
  rect(g, headX + HW - 9, headY + 6, 12, 24, hair);
  // 秃顶区域（中年特征：头顶露出皮肤色）
  rect(g, headX + 15, headY - 3, HW - 30, 6, skin);
  rect(g, headX + 18, headY - 6, HW - 36, 6, skin);

  if (pose === 'young') {
    rect(g, headX + 3, headY - 9, HW - 6, 15, hair);
    rect(g, headX, headY - 3, HW, 9, hair);
  }
  if (pose === 'middle') {
    rect(g, headX + 15, headY - 6, 18, 9, skin);
  }

  // ===== 黑框眼镜（罗远最核心识别特征！放大加粗） =====
  const glassY = headY + 15;
  const glassW = 24, glassH = 15;
  // 左镜框
  rect(g, headX - 3, glassY, glassW, glassH, glasses);
  // 右镜框
  rect(g, headX + HW - glassW + 3, glassY, glassW, glassH, glasses);
  // 鼻梁
  rect(g, headX + HW / 2 - 3, glassY + 6, 6, 3, glasses);
  // 镜片
  rect(g, headX, glassY + 3, glassW - 6, glassH - 6, glassesLens);
  rect(g, headX + HW - glassW + 6, glassY + 3, glassW - 6, glassH - 6, glassesLens);
  // 镜片反光
  rect(g, headX + 3, glassY + 5, 6, 3, 0xffffff);
  rect(g, headX + HW - glassW + 9, glassY + 5, 6, 3, 0xffffff);
  // 镜腿
  rect(g, headX - 6, glassY + 3, 6, 3, glasses);
  rect(g, headX + HW, glassY + 3, 6, 3, glasses);

  // 眉毛
  g.fillStyle(hair, 1);
  if (pose === 'angry') {
    g.fillRect(headX + 3, glassY - 8, 15, 3);
    g.fillRect(headX + HW - 18, glassY - 8, 15, 3);
  } else if (pose === 'depressed') {
    g.fillRect(headX + 3, glassY - 6, 12, 3);
    g.fillRect(headX + HW - 15, glassY - 6, 12, 3);
  } else {
    g.fillRect(headX + 3, glassY - 8, 15, 3);
    g.fillRect(headX + HW - 18, glassY - 8, 15, 3);
  }

  // 眼睛
  g.fillStyle(0x1a1a1a, 1);
  if (pose === 'depressed') {
    g.fillRect(headX + 6, glassY + 5, 6, 2);
    g.fillRect(headX + HW - 12, glassY + 5, 6, 2);
  } else {
    g.fillRect(headX + 6, glassY + 5, 5, 4);
    g.fillRect(headX + HW - 11, glassY + 5, 5, 4);
  }

  // 嘴巴
  g.fillStyle(0x8a1a1a, 1);
  const mouthY = headY + 35;
  if (isTalking) {
    const mouthOpen = Math.sin(frame * 0.5) > 0 ? 8 : 3;
    const extra = (pose === 'speaking') ? 3 : 0;
    g.fillRect(cx - 6 + bodyLean, mouthY, 12, mouthOpen + extra);
  } else if (pose === 'angry') {
    g.fillRect(cx - 8 + bodyLean, mouthY, 16, 6);
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 5 + bodyLean, mouthY + 2, 9, 2);
  } else if (pose === 'depressed') {
    g.fillRect(cx - 5 + bodyLean, mouthY + 3, 9, 3);
  } else if (pose === 'livestream') {
    g.fillRect(cx - 5 + bodyLean, mouthY, 9, 3);
    g.fillRect(cx - 3 + bodyLean, mouthY + 3, 6, 3);
  } else {
    g.fillRect(cx - 6 + bodyLean, mouthY, 12, 3);
  }

  // 抑郁姿态的汗滴
  if (pose === 'depressed') {
    g.fillStyle(0xf0c040, 1);
    g.fillRect(headX + HW + 6, headY - 6, 6, 18);
    g.fillRect(headX + HW + 8, headY - 9, 3, 6);
    g.fillStyle(outline, 1);
    g.fillRect(headX + HW + 3, headY - 12, 12, 3);
    g.fillRect(headX + HW + 3, headY - 12, 3, 24);
    g.fillRect(headX + HW + 12, headY - 12, 3, 24);
    g.fillRect(headX + HW + 3, headY + 9, 12, 3);
  }
}
