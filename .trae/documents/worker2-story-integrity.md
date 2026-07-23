# 工作者 2：剧情数据完整性检查与修复

## 项目背景
这是一个以罗永浩人生经历为背景的 2D 像素风互动视觉小说游戏。
玩家在关键节点做出不同选择，体验不同的人生结局。
剧情数据在 `src/data/story.js` 中，当前已从 18 个节点扩展到 70 个节点。
项目根目录：`e:\ownWorkPlace\罗的十字路口\luohammer-pixel-game`

## 当前问题
story.js 由一个工作者一次性从 18 节点扩展到 70 节点，可能存在以下问题：

1. **断裂的剧情路径**：某些 choices 的 next 可能指向不存在的节点 key，导致游戏卡死。
2. **死胡同节点**：某些节点没有 choices 也没有 isEnding: true，玩家到达后无法继续。
3. **结局节点缺少内容**：ending_* 节点应该有 title/desc/quote/summary，但可能只有 isEnding: true。
4. **progress 值不合理**：某些节点的 progress 值可能不递增，导致进度条显示异常。
5. **sceneType 不存在**：某些节点可能使用了 config.js 中未定义的 sceneType。
6. **历史对照文本质量**：historyNote 可能太短或太长，影响 HistoryCard 显示效果。
7. **choices 的 effects 不合理**：某些选择的效果值可能过大或过小，影响游戏平衡。

## 目标状态
1. 所有 choices 的 next 指向存在的节点 key
2. 所有非结局节点都有 choices（至少 2 个选项）
3. 所有 ending_* 节点有完整的 title/desc/quote/summary
4. progress 值从 0 到 100 严格递增
5. 所有 sceneType 在 config.js 的 SCENE_TYPES 中有定义
6. historyNote 长度在 20-80 字之间
7. effects 的值合理（pride/wealth/rep 范围 -2 到 +3，fail 范围 0 到 +2）

## 你要修改的文件
1. `src/data/story.js` — 主要修改对象
2. `src/config.js` — 只读，确认 SCENE_TYPES 定义
3. `src/scenes/GameScene.js` — 只读，确认 getEnding 逻辑

## 具体要求

### 必须做到
1. **路径完整性检查**：遍历所有节点，检查每个 choices[*].next 是否指向 STORY 中存在的 key。列出所有断裂路径并修复。

2. **死胡同检查**：遍历所有节点，找出没有 choices 且没有 isEnding: true 的节点。给它们加上 choices 或标记为结局。

3. **结局节点补全**：所有 ending_* 节点必须有：
   ```javascript
   isEnding: true,
   title: '结局标题',      // 4-8字
   desc: '结局描述',       // 20-40字，描述这个结局的含义
   quote: '结局引言',      // 一句有哲理的话，10-20字
   summary: '结局总结'     // 对这个人生路径的总结，15-30字
   ```

4. **progress 修正**：按时间线顺序，确保每个节点的 progress 值递增。序章=0，终章=100。具体映射：
   - 序章：2-5
   - 第一章：8-15
   - 第二章：18-25
   - 第三章：28-35
   - 第四章：38-42
   - 第五章：45-50
   - 第六章：52-58
   - 第七章：60-65
   - 第八章：68-72
   - 第九章：75-78
   - 第十章：80-85
   - 第十一章：86-90
   - 第十二章：91-94
   - 第十三章：95-97
   - 第十四章：98
   - 第十五章：99
   - 第十六章-终章：100

5. **sceneType 检查**：确保所有节点的 sceneType 在 config.js 的 SCENE_TYPES 中有对应值。如果发现未定义的 sceneType，改为最接近的已有类型。

6. **effects 平衡性**：
   - pride/wealth/rep 单次变化范围：-2 到 +3
   - fail 单次变化范围：0 到 +2
   - achievement 只在关键节点触发（不超过 20 个）
   - 确保从 intro 到任意结局，属性总和合理（pride 0-10, wealth 0-10, rep 0-10, fail 0-8）

7. **historyNote 质量检查**：每条 historyNote 应该是 20-80 字的真实历史对照，不是剧情复述。格式示例：
   - ✅ "2011年11月20日，罗永浩在西门子北京总部前砸碎3台冰箱，最终迫使西门子中国总裁公开道歉。"
   - ❌ "你选择了砸冰箱。"

### 不能做
1. 不要修改 config.js
2. 不要修改 GameScene.js
3. 不要删除任何已有节点
4. 不要改变节点 key 的命名
5. 不要修改 isEnding 节点的 key
6. 不要引入新的 import（保持从 config.js 导入 SCENE_TYPES）

## 验证标准
1. `npm run build` 无报错
2. 写一个简单的路径遍历验证：从 intro 出发，所有路径都能到达某个 ending_* 节点
3. 所有 ending_* 节点有 title/desc/quote/summary
4. progress 值严格递增
5. 所有 sceneType 合法
6. effects 值在合理范围内
