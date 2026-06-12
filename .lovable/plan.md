## 1. 删除「摘要」输入框（标题下面那块）

`src/components/tuan/IntroTab.tsx` line 565-570 现在渲染了一个 `intro.description` 的 AutoTextarea（截图里那条带绿框的"全系列巴塔 Pata 速干帽…"）。删掉它，只保留标题这一个 AutoTextarea。`intro.description` 字段在数据层保留（不动 types / 数据库），只是不再在编辑预览里出现，避免破坏老数据。

## 2. 同步改写 chat prompt：不再依赖 intro.description

`src/routes/api/chat.ts` 当前提示把"痛点 / 背书 / 卖点拆解 / 款式参数"都塞进 `intro.description`（240-263、281、306 行附近）。摘要框去掉之后，正文只走 `blocks`：

- 第 1 步保留：标题写入 `intro.title`（14-22 字四要素）
- 第 2-5 步：每段单独 `blocksAppend` 一个 `type:"text"` block，按文案逻辑模块顺序产出（沿用现有阶段 A 流程）
- `intro.description` 改为：**始终不写**（即使没有图位也只用 blocks 承载正文），并删掉"先写 ≤60 字封面摘要"那一句
- 工作原则区把"团购正文/卖点描述 → update_intro 的 description"这一条改成"团购正文一律拆成 blocks，禁止往 description 塞内容"

`update_intro` 工具的 description 字段 schema 保留（兼容历史），但 prompt 明确禁止用它。

## 3. 修复"团宝列了几个标题，让它放进去却没进"的问题

根因：当前 prompt 鼓励团宝在聊天里列候选，但没有强制：用户一句"放进去 / 用第二个 / 应用这个"就必须立刻 `update_intro({ title })`。模型经常只在文字里回复"好的，已选第二个"却没调工具，导致右侧没动。

改 `src/routes/api/chat.ts` 提示里新增一段「候选采纳规则」：
- 当用户用任何方式确认采纳（"放进去 / 用 X / 应用 / 就这个 / 第几个"），必须立刻调用对应工具写入：标题候选 → `update_intro({ title })`；段落候选 → `update_intro({ blocksAppend:[{type:"text", text}] })` 或 `blocksReplaceAt`
- 工具调用必须发生在同一回复里，禁止"已选好了"这种空口回复
- 如果用户的指代不明（如"放进去"但有多个候选），先用一句话确认是哪一条，再调工具

同时给团宝增加一条主动写入规则：在聊天里给出 ≥2 个标题/段落候选时，必须同时调一次 `update_intro` 把"自己最推荐的那一个"先写进去（用户后续要换可以再说），避免出现"全在聊天里、预览空空"。

## 4. 验证

- 编辑页"团购介绍"卡片里标题下方那个绿框摘要消失；只剩标题 + 模块工具栏
- 让团宝"生成两个标题"：聊天里出现两个候选，右侧预览已经写进了它最推荐的一条
- 用户回"用第二个 / 放进去"：右侧标题立即被替换为第二个，团宝同时简短确认
- 让团宝写全文：所有正文段都以 block 形式逐段出现，不再出现"description 大段文字"

## 涉及文件
- `src/components/tuan/IntroTab.tsx`（删摘要 textarea）
- `src/routes/api/chat.ts`（prompt 重写，停用 description，强化候选采纳）

不改：数据库、`types.ts`、`CopyLogicEditor`、设置页、`update_intro` 工具 schema。
