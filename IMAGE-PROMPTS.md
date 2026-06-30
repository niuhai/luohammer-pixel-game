# 图片生成提示词

## 风格锚点

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game, cinematic moody lighting, clean pixel art style, highly detailed, masterpiece quality
```

## 通用负面提示词

```
text, watermark, logo, signature, frame, border, blurry, low quality, distorted, deformed, extra fingers, missing fingers, bad hands, six fingers, bad anatomy, multiple people, crowd, busy background, gradient background, 3D render, realistic photo, oil painting, watercolor, anime, manga, chibi, SD3 style, smooth shading, anti-aliased
```

---

## 角色立绘（2048×3072 竖版，纯黑背景 #000000，金琥珀边缘光 #F0C040）

### luo-character-reference（角色基准参考图，先生成这张）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character reference sheet. A Chinese man in his early 30s, full body standing portrait facing forward, neutral pose, arms at sides. Short black hair with natural side part. Square-round black frame glasses (iconic). Slim build, average shoulder width. Wearing a dark charcoal black turtleneck shirt, dark jeans, black leather shoes. Five fingers on each hand, slender hands. Pure black background (#000000). Golden amber rim lighting (#F0C040) on left and right edges outlining the silhouette. Cinematic moody lighting, clean pixel art style, highly detailed, masterpiece quality. Full body from head to toe, centered composition. The man has a calm, confident, slightly idealistic expression. This is the reference image for character consistency.
```
Negative: `text, watermark, logo, signature, frame, blurry, low quality, distorted, deformed, extra fingers, missing fingers, bad hands, six fingers, bad anatomy, multiple people, busy background, gradient background, 3D render, realistic photo, oil painting, anime, manga, chibi, smooth shading`

### luo-young（少年15岁）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A young Chinese boy around 15 years old in 1980s China, full body standing portrait facing forward, arms crossed over chest, feet planted firmly apart. Thin face with baby fat, jawline slightly pointed. Short messy black hair. Square-round black frame glasses (slightly too big for his face). Stubborn rebellious expression, brows furrowed, mouth corners down, angry at the world. Wearing a worn dark brown 1980s style jacket with visible wear marks, light grey old t-shirt underneath, dark old pants, worn-out sneakers. Slim small build, narrow shoulders. Pure black background (#000000). Golden amber rim lighting (#F0C040) on edges. Cinematic moody lighting, clean pixel art style, highly detailed. Full body from head to toe, centered. 1980s Yanbian China era feel, poor but defiant.
```
Negative: 通用负面 + `adult, mature face, modern clothing, smile, happy`

### luo-standing（站立·青年）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A confident Chinese man in his early 30s, full body standing portrait facing forward, hands in pants pockets, relaxed confident pose, weight evenly distributed. Short black hair with natural side part. Square-round black frame glasses. Mature face with clear jawline, slight nasolabial folds. Slim build, straight shoulders. Wearing a dark charcoal black turtleneck shirt, dark jeans, black leather shoes. Five fingers visible, slender hands. Pure black background (#000000). Golden amber rim lighting (#F0C040) outlining silhouette. Cinematic moody lighting, clean pixel art style, highly detailed. Determined and idealistic expression, slight confident smile. Full body from head to toe, centered.
```
Negative: 通用负面 + `child, old, overweight, sad, angry`

### luo-speaking（演讲·青年）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A Chinese man in his early 30s giving a passionate speech, full body standing portrait facing forward, one hand raised gesturing openly with palm up, the other hand at side holding notes. Short black hair with natural side part. Square-round black frame glasses. Mouth open mid-speech, eyes shining with conviction, eyebrows raised with enthusiasm. Wearing a dark charcoal black turtleneck shirt, dark jeans, black leather shoes. Slim build, straight shoulders, slight forward lean. Pure black background (#000000). Golden amber rim lighting (#F0C040) with extra warm glow on face and raised hand. Cinematic moody lighting, clean pixel art style, highly detailed. Charismatic teacher expression, mid-speech energy. Full body from head to toe, centered.
```
Negative: 通用负面 + `closed mouth, silent, sitting, child`

### luo-angry（愤怒·青年）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A Chinese man in his early 30s with furious angry expression, full body standing portrait facing forward, aggressive stance with feet apart, one clenched fist raised at chest level, the other hand clenched at side. Short black hair with natural side part. Square-round black frame glasses. Furrowed brows, glaring eyes, gritted teeth, face slightly red. Wearing a dark charcoal black turtleneck shirt, dark jeans, black leather shoes. Slim build, tense shoulders raised. Pure black background (#000000). Dramatic lighting: red (#E04040) and golden amber (#F0C040) mixed, harsh shadows on face. Cinematic moody lighting, clean pixel art style, highly detailed. Furious defiant expression, like about to smash something. Full body from head to toe, centered.
```
Negative: 通用负面 + `smile, calm, relaxed, sitting, child`

### luo-depressed（沮丧·青年）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A Chinese man in his early 30s looking utterly defeated, full body standing portrait facing forward, head slightly down, shoulders slumped forward, arms hanging limp at sides. Short black hair with natural side part, slightly disheveled. Square-round black frame glasses. Eyes downcast with dark circles underneath, exhausted expression, mouth slightly open, pale face. Wearing a rumpled dark charcoal black turtleneck shirt (wrinkled), dark jeans, scuffed black leather shoes. Slim build but posture collapsed. Pure black background (#000000). Cold blue-grey dim lighting with faint golden amber (#F0C040) accent only on edges. Cinematic moody lighting, clean pixel art style, highly detailed. Exhausted, hopeless expression. Full body from head to toe, centered.
```
Negative: 通用负面 + `smile, confident, energetic, standing straight, child`

### luo-happy（开心·青年）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A Chinese man in his early 30s with genuine triumphant joy, full body standing portrait facing forward, both hands raised above head in victory gesture, fists clenched in triumph. Short black hair with natural side part. Square-round black frame glasses. Eyes crinkled with joy, wide genuine smile showing teeth, head tilted slightly back. Wearing a dark charcoal black turtleneck shirt, dark jeans, black leather shoes. Slim build, expansive celebratory posture. Pure black background (#000000). Warm golden amber glowing lighting (#F0C040) radiating from behind, like sunrise. Cinematic moody lighting, clean pixel art style, highly detailed. Victorious ecstatic expression. Full body from head to toe, centered.
```
Negative: 通用负面 + `sad, angry, depressed, sitting, child`

### luo-livestream（直播·35-40岁）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A Chinese man around 35-40 years old in livestream setting, full body standing portrait facing forward toward camera, one hand holding a small product box, the other hand gesturing presentation. Short black hair with natural side part. Square-round black frame glasses. Wearing black over-ear headphones around neck, dark grey hoodie half-zipped open showing dark t-shirt underneath, jeans, sneakers. Slightly rounder face than 30s but not overweight. Energetic salesman expression, mouth mid-speech, eyes engaged. Pure black background (#000000). Ring light glow on face, golden amber (#F0C040) accent lighting. Cinematic moody lighting, clean pixel art style, highly detailed. Full body from head to toe, centered.
```
Negative: 通用负面 + `turtleneck, formal, suit, child, teenager`

### luo-sitting（坐姿·青年）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A Chinese man in his early 30s sitting on a simple wooden chair, full body portrait visible from head to knees. Short black hair with natural side part. Square-round black frame glasses. Relaxed sitting posture, one hand resting on knee, the other arm draped over chair back. Calm composed expression with slight gentle smile. Wearing a dark charcoal black turtleneck shirt, dark jeans. Black leather shoes visible. Slim build, upright but relaxed posture. Pure black background (#000000). Golden amber rim lighting (#F0C040) on edges. Cinematic moody lighting, clean pixel art style, highly detailed. Suitable for classroom, office, podcast scenes. Full body sitting pose, centered.
```
Negative: 通用负面 + `standing, walking, child, old, overweight`

### luo-middle（中年40岁）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game character. A Chinese man in his early 40s, full body standing portrait facing forward, hands in pockets, confident but weathered posture. Round face with visible double chin, eye bags and deep nasolabial folds. Receding hairline with thinning hair on top, short black hair on sides. Square-round black frame glasses. Subtle crow's feet around eyes. Slightly overweight build, thicker waist, broader shoulders than youth. Wearing a dark navy blue business shirt with a red tie (#8A1A1A), dark trousers, black leather shoes. Pure black background (#000000). Golden amber rim lighting (#F0C040). Cinematic moody lighting, clean pixel art style, highly detailed. Shows the toll of years of entrepreneurship. Full body from head to toe, centered.
```
Negative: 通用负面 + `young, slim, turtleneck, hoodie, teenager, child`

---

## 场景图（2560×1440 横版，无人物，底部1/4留空给UI）

### scene-classroom（教室）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. An empty 1990s Chinese classroom interior, rows of wooden desks with scratches and ink stains, green chalkboard with faded Chinese characters barely visible, dim fluorescent tube lighting buzzing overhead. Afternoon golden amber light (#F0C040) streaming through dusty windows creating light beams. Scattered chalk dust in air. Empty chairs, one textbook left open on a desk. Nostalgic, melancholic atmosphere of forgotten youth. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, composition leaves bottom quarter empty for UI overlay.
```
Negative: 通用负面 + `people, person, character, modern, bright, cheerful`

### scene-court（法庭）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. An empty courtroom interior, elevated wooden judge bench center back, empty witness stand, Chinese national emblem on wall behind bench. Rows of empty wooden gallery seats. Cold overhead lighting casting harsh dramatic shadows. Golden amber light (#F0C040) from high narrow windows creating blade-like light shafts. Wooden floor with worn finish. Tense, oppressive atmosphere of judgment. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, judge, modern, bright, outdoor`

### scene-ending（结局通用·路）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A long empty road stretching to distant horizon at sunset, cracked asphalt with faded lane markings. Silhouette of a city skyline far in distance. Dramatic golden amber sky (#F0C040) with dark purple clouds, sun rays breaking through cloud gaps. A single broken streetlight on roadside. No vehicles. Contemplative, bittersweet ending atmosphere, the feeling of a journey concluded. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, cars, bright daylight, cheerful`

### scene-fridge_smash（砸冰箱）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A smashed refrigerator lying on its side on pavement in front of a glass storefront, shattered glass shards scattered across wet ground reflecting light. Evening urban street scene. Golden amber (#F0C040) streetlight glow from above creating dramatic long shadows. A sledgehammer lying next to debris. Chaotic, rebellious, destructive atmosphere. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, clean, tidy, indoor, daytime`

### scene-lab（实验室）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A tech startup lab interior at night, scattered circuit boards, disassembled smartphone prototypes with components spread on workbench, 3D printer in corner, multiple monitors glowing blue in darkness. Soldering iron, tweezers, magnifying lamp. Tangled cables. Golden amber (#F0C040) desk lamp accent mixed with blue screen glow. Intense, obsessive work atmosphere, the smell of burnt solder. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, daytime, bright, clean, modern lab`

### scene-lecture（讲座）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A large lecture hall with hundreds of empty red velvet seats cascading down, wooden podium center stage, huge projection screen behind showing faded abstract patterns. Dramatic spotlights on stage, golden amber (#F0C040) warm stage lighting. Empty seats waiting. Dust motes in light beams. Anticipatory, grand atmosphere before a major presentation. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, audience, speaker, outdoor, small`

### scene-livestream（直播间）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A livestream studio setup, ring light on stand, professional microphone on boom arm, product display table with empty product stands, backdrop with blurred brand logos and RGB LED strip lighting. Shipping boxes stacked in corner. Warm golden amber (#F0C040) key light mixed with screen glow. Modern e-commerce atmosphere, ready for broadcast. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, streamer, outdoor, dark, vintage`

### scene-office（办公室）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A startup office interior at night, empty desks with laptops showing code, whiteboard with faded product roadmap diagrams and circled goals, scattered colorful post-it notes. Empty coffee cups. City lights through large windows. Single golden amber (#F0C040) desk lamp glow in darkness. Lonely, late-night work atmosphere, the weight of ambition. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, daytime, bright, outdoor, home`

### scene-podcast（播客）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A podcast recording studio, two empty chairs behind a wooden table with professional microphones on boom arms, headphones on table, acoustic foam panels on walls. Sound mixer on side. Warm golden amber (#F0C040) lighting creating intimate atmosphere. Two coffee mugs. Cozy, conversational, late-night-talk atmosphere. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, outdoor, bright, large, stadium`

### scene-stage（舞台）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A large concert stage with dramatic spotlights, empty microphone stand center stage, huge LED screen behind showing abstract pixel patterns. Stage floor with cable runs. Golden amber (#F0C040) and white stage lighting cutting through darkness, atmospheric haze. Epic, grand, anticipatory atmosphere before a product launch. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, performer, crowd, outdoor, small`

### scene-street（街头）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A Chinese city street at night, neon signs with Chinese characters glowing pink and cyan, wet pavement reflecting lights, food stall with steam rising. Closed shops with metal shutters. Golden amber (#F0C040) streetlight glow mixed with neon colors. Puddle reflections. Gritty, urban, alive-at-night atmosphere. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, daytime, bright, suburban, nature`

### scene-talkshow（脱口秀）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A talkshow stage with a single wooden stool and microphone on small stand, red brick wall backdrop, single spotlight on performer area. Mic cable coiled on floor. Warm golden amber (#F0C040) spotlight pool in surrounding darkness. Intimate, comedic, storytelling atmosphere. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, performer, audience, outdoor, large`

### scene-office_empty（废弃办公室）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. An abandoned startup office, desks left in disarray with unplugged monitors and scattered papers, some chairs knocked over, a whiteboard still showing faded product roadmap with circled goals, a single wilted plant on a windowsill. Dim blue-grey lighting from emergency exit sign glow. No warm light — cold, abandoned, post-failure atmosphere. Outside windows: dark city at night with a few distant lights. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, warm light, golden light, tidy, active, daytime`

### scene-street_night（深夜街头）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A Chinese city street deep at night around 3 AM, mostly dark with only a few distant streetlights, closed storefronts with metal shutters, flickering neon sign with Chinese characters, empty bus stop with a torn advertisement poster. A lone streetlight casting long pool of light. Cold blue-grey moonlight with faint golden amber (#F0C040) from a distant 24-hour convenience store. Wet pavement. Lonely, desolate, 3am-walk atmosphere. No people visible, only shadows. Clean pixel art style, highly detailed. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, crowd, daytime, busy, warm, cheerful`

### scene-office_dark（黑暗办公室）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game background. A startup office at very late night, all lights off, only the cold blue glow of a single laptop screen illuminating the darkness. Empty office. Piles of debt notices and legal documents scattered on a desk. A cold cup of coffee. Rain streaks on large windows showing blurry dark city. The only light source is the cold blue laptop screen glow, NO golden warm light at all. Oppressive, desperate, cornered atmosphere. Clean pixel art style, highly detailed. No characters. Wide cinematic 16:9, bottom quarter empty for UI.
```
Negative: 通用负面 + `people, warm light, golden light, daytime, bright, cheerful`

---

## 结局插图（2560×1440 横版，剪影人物，戏剧化光线）

### ending-legend（传奇结局：legend, idealist, warrior）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game ending illustration. A lone Chinese entrepreneur silhouette standing at the pinnacle of a concert stage, dramatic golden spotlight (#F0C040) beaming down from above. A giant LED screen behind him shows the journey of his entire career in pixel art montage. The silhouette wears black frame glasses, dark turtleneck, arms slightly spread in quiet triumph. Pure black background with golden amber rim lighting. Epic, triumphant but solitary atmosphere — victory at the cost of everything. Clean pixel art style, highly detailed, masterpiece. Wide cinematic 16:9 composition. No text.
```
Negative: 通用负面 + `crowd, multiple people, text, words, letters, daytime, bright`

### ending-phoenix（浴火重生：phoenix）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game ending illustration. A Chinese man in his 40s silhouette standing at the edge of a cliff at sunrise, arms raised triumphantly, looking toward a bright golden horizon. He has short black hair, black frame glasses silhouette, wearing a simple dark shirt. Behind him on the ground: broken chains symbolizing freed debts. Majestic phoenix wings made of golden light (#F0C040) forming behind him, spreading wide. Pure black foreground with warm golden amber glow rising from horizon. Rebirth, liberation, debt-repaid atmosphere. Clean pixel art style, highly detailed, masterpiece. Wide cinematic 16:9. No text.
```
Negative: 通用负面 + `crowd, text, words, letters, dark sky, night, sad`

### ending-returns（罗老师回来了：returns, comeback）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game ending illustration. A Chinese man with black frame glasses silhouette stepping through a door of golden light, one foot already through the doorway, looking back over his shoulder with a confident smirk. He wears a dark turtleneck and jeans. The door frame is ornate with golden amber (#F0C040) pixel patterns. On this side: dark cyberpunk ruins and debris. On the other side: warm golden light and a cheering crowd silhouette. Dramatic, triumphant return atmosphere — the prodigal comes home. Clean pixel art style, highly detailed, masterpiece. Wide cinematic 16:9. No text.
```
Negative: 通用负面 + `text, words, letters, single side only, no door`

### ending-peace（与世界和解：peace, hermit, balance）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game ending illustration. A Chinese man in his 50s silhouette sitting peacefully on a park bench at dusk, black frame glasses, casual dark clothes, holding a cup of tea. Warm golden sunset light (#F0C040) streaming through ginkgo trees with golden leaves falling. A cat sitting next to him on the bench. City skyline in soft focus background. Calm, serene expression with gentle smile. Pure dark background with warm amber rim lighting. Peaceful, reconciled, at-peace atmosphere. Clean pixel art style, highly detailed, masterpiece. Wide cinematic 16:9. No text.
```
Negative: 通用负面 + `text, words, letters, tense, dramatic, dark, scary`

### ending-monk（出家：monk）

```
Pixel art, dark cyberpunk aesthetic, retro 8-bit game ending illustration. A Chinese man with shaved head wearing simple grey monk robes, sitting in meditation pose (lotus position) on a mountain temple stone platform at dawn. Black frame glasses resting beside him on a stone. Incense smoke rising slowly. Misty mountains and a traditional pagoda in background. First rays of golden sunrise (#F0C040) breaking through clouds. Zen, peaceful atmosphere with a touch of melancholy — the world abandoned. Pure black foreground with subtle golden amber rim lighting. Clean pixel art style, highly detailed, masterpiece. Wide cinematic 16:9. No text.
```
Negative: 通用负面 + `text, words, letters, modern, city, urban, busy`
