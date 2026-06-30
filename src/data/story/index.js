import { NODES as intro } from './0_intro.js';
import { NODES as act0 } from './1_act0.js';
import { NODES as act1 } from './2_act1.js';
import { NODES as act2 } from './3_act2.js';
import { NODES as act_fridge } from './4_fridge.js';
import { NODES as act_fang } from './5_fang.js';
import { NODES as act3 } from './6_act3.js';
import { NODES as act4 } from './7_act4.js';
import { NODES as act5 } from './8_act5.js';
import { NODES as act6 } from './9_act6.js';
import { NODES as act7 } from './10_act7.js';
import { NODES as act8 } from './11_act8.js';
import { NODES as act9 } from './12_act9.js';
import { NODES as endings_nodes } from './13_endings_nodes.js';
import { ENDINGS } from './14_endings.js';
import { CHAR_INFO } from './15_charinfo.js';

export const STORY = {
  ...intro,
  ...act0,
  ...act1,
  ...act2,
  ...act_fridge,
  ...act_fang,
  ...act3,
  ...act4,
  ...act5,
  ...act6,
  ...act7,
  ...act8,
  ...act9,
  ...endings_nodes
};

export { ENDINGS, CHAR_INFO };
