# 改动计划

## 1. 编辑页加「设置」入口
在 `src/routes/app.project.$id.tsx` 顶部「文案逻辑」下拉旁，新增一个齿轮按钮（`Settings` 图标，紧挨 Select），点击后 `Link to="/settings" search={{ tab: "copy-logic", id: selectedLogicId !== "auto" ? selectedLogicId : undefined }}` 在新标签打开（`target="_blank"`），便于一边对照预览一边改逻辑。

## 2. Emoji 自然嵌入（不再每行/每段开头硬塞）
改 `src/routes/api/chat.ts` 中的「Emoji 浓度」prompt 文案：
- none：禁止任何 emoji
- light：整段最多 1-2 个 emoji，放在能强化情绪的"那个具体词"后面（如"显瘦闭眼入😍"），不许放段首，也不许每行都加
- rich：可适度多用，但仍必须嵌在情绪/感官词附近，禁止机械地在段首、句首固定位置铺 emoji；标题除外
同步在通用回复风格区补一句硬约束：emoji 必须"自然嵌在情绪词或感官词旁边"，"禁止在每行/每句开头规律性堆 emoji"。

## 3. 应用模板时所有 text block 都按排版规则换行
现状：部分模块（尤其 image_large/grid/video 模块前后的 paragraph、以及参数表 params）输出时模型偶尔忽略段落模式。
改 `src/routes/api/chat.ts`：
- 把「排版规则」从「写每个 text block 时严格执行」升级为"对所有 type:text 的 block 内容（含标题段、痛点段、卖点段、款式参数段、图位说明的相邻段）都必须套用同一套段落模式 + 段间空行 + 首尾空行；params 表条目之间也按段落模式换行"
- 在阶段 A 的模块循环里额外加一行强约束：每个 text block 内部的换行符必须由模型显式写出 `\n`，不允许把多句挤在同一行；如果段落模式是「一句一段」或「句号分段」，模型必须自行拆句后用 `\n` 串起来
（这是 prompt 强化，不改前端渲染逻辑——前端已按 `whitespace-pre-wrap` 渲染）

## 4. 标题生成更丰富
现状：标题常常退化成"商品名 + emoji"一行。
改 `src/routes/api/chat.ts` 第 1 步标题区块：
- 把公式扩成"情绪钩子 + 核心卖点 + 利益点 + 人群标签"四要素，强制要求至少命中 3 项
- 字数下限提高到 14 字、上限 22 字
- 给 2 条正例 + 2 条反例（反例即"只写商品名"或"只加一个 emoji"）
- 当启用了文案逻辑里的 `[title]` 模块时，必须把 `guidance` 里的关键词/句式吃进去，而不是只用默认公式
- 同步在 logic prompt 里强调："[title] 模块 guidance 是硬约束，不能简化为通用公式"

## 技术细节
- 只动两个文件：`src/routes/app.project.$id.tsx`（加入口按钮）、`src/routes/api/chat.ts`（prompt 调整）
- 不动数据库、不改 schema、不改 CopyLogicEditor、不改设置页本身
- 设置页已支持 `?tab=copy-logic`（如未支持需补一个 `useSearch` 跳到对应 tab；待实现时确认）

## 验证
1. 编辑页右上能看到齿轮按钮，点击在新页打开设置/文案逻辑
2. 让团宝重新生成一遍：标题 14-22 字、含情绪+卖点+利益点+人群；正文段 emoji 散落在感官词旁边而非段首；每个段落都按"段落模式 + 段间空行"换行
