const fs = require('fs');
const p = 'e:/ownWorkPlace/罗的十字路口/luohammer-pixel-game/src/data/stages.js';
let c = fs.readFileSync(p, 'utf8');
let changed = 0;
const youth_old =  act0_korea_life ] ;
const youth_new =  act0_korea_life act0_grandma act0_mother act0_neighbor act0_confusion act0_reading act0_identity ] ;
if (c.includes(youth_old)) { c = c.replace(youth_old, youth_new); changed++; console.log('Youth: added 6 nodes'); } else { console.log('Youth: anchor NOT found'); }
const dark_old =  act7_restrict ] ;
const dark_new =  act7_restrict act6_phone_call act6_old_friend act6_restriction_notice act6_daughter act6_supplier_oldwang act6_mirror ] ;
if (c.includes(dark_old)) { c = c.replace(dark_old, dark_new); changed++; console.log('Dark: added 6 nodes'); } else { console.log('Dark: anchor NOT found'); }
const repay_old =  act7_retire ] ;
const repay_new =  act7_retire act7_low_viewers act7_quality_issue act7_first_100m act7_reunion act7_warm_moment act7_health ] ;
if (c.includes(repay_old)) { c = c.replace(repay_old, repay_new); changed++; console.log('Repay: added 6 nodes'); } else { console.log('Repay: anchor NOT found'); }
if (changed > 0) { fs.writeFileSync(p, c, 'utf8'); console.log('Written. Changes:', changed); } else { console.log('No changes made.'); }
