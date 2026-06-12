## 现状问题（你测到的）
1. 在首页对话框写的那段话只被当成"隐形指令"塞进 sessionStorage，编辑页左侧聊天里看不到它。
2. 进入编辑页常常不会自动开写——boot 那条 sessionStorage 有时丢失、或 AI 返回的 `autoUserPrompt` 是 null 就完全不会触发。
3. 团宝写文案是一口气把整段 `update_intro` 全填完，用户看不到"它在一段段写"的过程，也没有收尾总结+主动给建议。

## 改动一：首页那句话 = 编辑页第一条 user 消息

`src/lib/projects.functions.ts` 的 `startProject`：
- 删除 `autoUserPrompt` 字段（连同 prompt 里的相关说明）。
- 返回的 `seedMessages` 改成两条：
  1. `role:"user"` — 一条真实用户消息，`parts` 包含用户的原文 `description`，如果还上传了图片就追加 `file` parts（`mediaType` + `url`）。
  2. `role:"assistant"` — 一条很短的开场（≤30 字，例如「收到，这就给你写」）+ `suggest_next` 工具结果。计划模式下，assistant 这条改为先反问 3-5 个澄清问题，且不触发自动开写。
- `seedAssistantText` 长度限制收紧到 ≤80 字，避免 AI 直接在开场里把整篇写完。

## 改动二：编辑页一进来就自动开跑（不靠 sessionStorage）

`src/components/project-starter.tsx`：删掉写 `tuanbao.boot.${id}` 的那段。

`src/routes/app.project.$id.tsx`：
- 删掉现有 `bootedRef` + sessionStorage 触发块（行 322-334）。
- 改用更稳的判定：组件挂载后，若 `messages` 的最后一条是 `role:"user"` 且后面没有任何 assistant 回复，并且 `status === "ready"`，就调用 `regenerate()`（AI SDK `useChat` 自带）让团宝针对这条已存在的 user 消息开始流式回答。
- 这样刷新安全（已有 assistant 回复就不会重跑），首页跳进来稳定触发，计划模式同样适用（团宝会按 plan 系统提示反问而不是直接写）。

## 改动三：让团宝"一段一段地写"（核心体感升级）

`src/routes/api/chat.ts`：

A. `update_intro` 工具新增两个增量入参，保持向后兼容：
- `blocksAppend?: IntroBlock[]` — 追加到现有 `intro.blocks` 末尾。
- `blocksReplaceAt?: { index: number; block: IntroBlock }[]` — 按索引覆盖（用于阶段 B 把"[图位·…]"占位换成 image_lg/image_sm）。
- `blocks` 仍支持整体替换，但 system prompt 里改成"最后一步收尾才允许整体替换；正常撰写必须用 blocksAppend"。
- execute 时基于数据库里最新的 `intro.blocks` 做合并，生成新 id。

B. 阶段 A 工作流（system prompt 重写）改为「分步流式」：
1. 先输出一句"在想这次怎么写…"（≤25 字），然后调用一次 `update_intro` 只写 `title`。
2. 按当前文案逻辑模块清单**每个模块单独一次** `update_intro({ blocksAppend: [一个 block] })`，每次调用前用 1 行口语化过渡（"先把痛点写出来"/"接下来上材质特写"），不允许把多个模块塞进同一次工具调用。
3. 所有模块写完后输出收尾段（必须包含）：
   - 一句话总结这版抓的卖点角度（≤40 字）
   - 3 条带编号的具体调整建议（标题更扎心 / 拆价格档位 / 补材质特写 等，针对当前品类）
   - 调用一次 `suggest_next` 给 3-4 条可点指令
4. 工具循环 `stepCountIs(50)` 已经够；明确告诉模型"分步比一次塞完更重要，禁止一次性传完整 blocks 数组"。

C. 阶段 B（用户上传图片）：用 `blocksReplaceAt` 精确把占位 block 换成图片 block，不再整体替换，保留已写文字段落不动。

D. 让团宝更聪明的开场段（system prompt 顶部追加）：
- 首次对该项目回答时，先用 2-3 句话复述「我看到的上下文」：项目名 / 品类 / 用户原文要点 / 是否启用文案逻辑及其名字 / 是否带图。这一步只输出文字，不调用工具，给用户"它真的看懂了"的感觉。
- 后续对话优先复用已存在的段落微调，不要每次重写整篇。

## 改动四：左侧聊天 UI 渲染流式过程

`src/routes/app.project.$id.tsx` 渲染 messages 的部分：
- 确认 assistant message 的 text part 是用 AI Elements 的 `MessageResponse` 渲染流式增量（不要自己 join 后再渲染，否则看不到逐字流）。
- `update_intro` 工具调用渲染为一个紧凑的状态行（"✍️ 写第 3 段：品牌背书"），collapsed by default，配合右侧预览的实时刷新（`onToolCall: qc.invalidateQueries` 已有，保留）。
- 不增加新组件，按需小幅调整现有渲染分支。

## 技术细节

```text
首页输入 ─▶ startProject
            ├─ seedMessages = [user(原文+图), assistant(≤30字开场+suggest_next)]
            └─ 写入 localStorage tuanbao.chat.{id}
            
编辑页挂载 ─▶ useChat 从 localStorage 读 seedMessages
            └─ 若最后一条是 user 且 status=ready → regenerate()
                 │
                 ▼
            团宝："我看到的上下文是…"（文字）
            团宝："在想这次怎么写…"（文字）
            update_intro({ title })
            团宝："先把痛点写出来" → update_intro({ blocksAppend:[痛点段] })
            团宝："接下来品牌背书" → update_intro({ blocksAppend:[背书段] })
            ... 每段一次工具调用 ...
            团宝：「总结 + 3 条调整建议」+ suggest_next
```

新工具入参（zod）：
```ts
blocksAppend: z.array(IntroBlockSchema).optional()
blocksReplaceAt: z.array(z.object({
  index: z.number().int().min(0),
  block: IntroBlockSchema
})).optional()
```
execute 内：读 `projects.intro.blocks` 当前值 → 合并 → 写回。

## 不动的部分
- 数据库表结构、RLS、grants、文案逻辑数据、SKU/settings/product_meta 工具签名、拖拽/缩略图层级、AI 生图、设置 Tab、auth、其它路由。

## 验收
1. 首页写「卖云南牛肉干」→ 跳转编辑页 → 左侧立刻看见自己那句话作为 user 气泡 + 团宝开场气泡。
2. 团宝自动开始：先"我看到的是…" → "在想…" → 一段段写 → 右侧预览里 intro blocks 一段段冒出来。
3. 写完团宝主动总结 + 给 3 条具体调整建议 + 4 个可点 suggest_next。
4. 刷新编辑页，不会重新触发开写（已有 assistant 回复）。
5. 计划模式：user 消息照常显示，团宝按 plan 流程反问，不会自动开写。
6. 之后用户上传图片，占位 block 被原地替换成图片，不会清掉已写文字。
