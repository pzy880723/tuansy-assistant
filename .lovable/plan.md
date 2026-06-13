
## 目标

1. 团宝在自然对话里能记住用户偏好，自动写进**当前选中的文案逻辑**，下次生成自动遵守。
2. 每个预览模块旁有「AI 丰富」按钮，点开小输入框（带快捷预设），团宝只改这一块。
3. 聊天框输入 `@` 弹出当前预览的模块列表，可精准点名某一块让团宝修改。

---

## 1. 记忆能力：写进当前文案逻辑

### 服务端 (`src/routes/api/chat.ts`)

新增一个工具 `remember_preference`：

- 入参：`note`（≤200字，用户偏好原话凝练）、`scope`（`"global"` 写进逻辑总纲 / `"module"` 写进某个模块的指引），可选 `moduleId`。
- 行为：
  - `global`：在 `activeLogic.description` 末尾追加一个 `\n\n【用户偏好（团宝记录）】\n- {note}`（已存在该标题时合并到列表里，并自动去重）。
  - `module`：在对应模块的 `guidance` 字段追加 `- {note}`。
- 通过 `supabaseAdmin` 写回 `copy_logics`（或 `preset_copy_logics`，按 `activeLogic.source` 分流；预设逻辑只读则升级为复制一份成自定义逻辑后写入，避免污染预设）。
- 返回 `{ ok: true, scope, snippet }`，UI 渲染为「📌 团宝记下了：xxx」气泡。

系统提示新增一段「记忆规则」：

- 当用户出现明显偏好/规则性表述（"以后都…"、"记住…"、"我喜欢…"、"别再…"）时，必须在回复同一回合调用 `remember_preference`。
- 不要记录一次性的本条修改请求（如"这次把标题改短"）。
- 记完后用一句话向用户确认："好的，我记下了 xxx，以后都按这个来。"

### 前端

- 聊天消息流里识别 `remember_preference` 工具调用，渲染一行带 📌 图标的浅色提示卡。
- 该工具调用完成后，前端 `invalidateQueries(["copy-logics"])` + `["preset-copy-logics"]`，让逻辑下拉与编辑弹窗看到最新内容。

---

## 2. 单块 AI 改写

### `IntroTab.tsx`

- `BlockCard` 头部增加 ✨「AI 丰富」按钮（与现有 🔒/AI生图 并列），仅对 `type:"text"` 与 `image_lg/image_sm` 可见；锁定时禁用。
- 点击弹 `Popover`（用 shadcn 已有组件）：
  - 顶部 4 个 chip 快捷预设：`更生动`、`更短一点`、`更专业`、`加入痛点`。
  - 下面一个小 textarea「其他要求…」。
  - 「发送给团宝」按钮。
- 提交时调用父级回传的 `onAskAI(blockId, prompt)`，组装为聊天消息：
  ```
  @[段落2#a1b2c3d4] 更生动
  ```
  自动 `sendMessage` 进现有聊天流（用户看得到，可继续追问）。

### 块 → label 规则（用于 mention 显示文本）

- text → `段落N`
- image_lg → `大图N`
- image_sm → `九宫格N`
- 序号按同类型块出现顺序。
- mention token 格式：`@[label#blockId前8位]`，便于人读且能反查 id。

---

## 3. @mention 选块

### 聊天 textarea (`app.project.$id.tsx`)

- 检测最后一个未完成的 `@` 触发轻量浮层：
  - 列出当前 `intro.blocks` 的全部块，显示 label + 内容前 24 字预览（图片块显示缩略图）。
  - ↑↓ + Enter 选择，或鼠标点击。
  - 选中后把光标处的 `@` 替换成 `@[label#shortId] `。
- 实现：新组件 `BlockMentionPopover`，不引第三方库（用 `Popover` + 自管列表）。

### 服务端解析 (`chat.ts`)

- 系统提示加一段「@mention 规则」：
  - 用户消息里出现 `@[label#xxxxxxxx]` 表示精准点名某个现有块。
  - 解析方法：在 `intro.blocks` 里找 `id.startsWith(xxxxxxxx)` 的块的 index。
  - 命中后**只能**用 `blocksReplaceAt` 替换该 index，不允许动其他块，也不允许 append。
  - 若该 index 处的块 `locked:true`，回复让用户先解锁。
- 服务端已注入 `intro.blocks`（含 id），模型可自行解析；不需要在服务端做硬解析。

### blockId 稳定性修复

- 修改 `chat.ts` 第 432 行 `blocksReplaceAt` 分支：**保留** `nextBlocks[replacement.index].id`，不生成新 id：
  ```ts
  nextBlocks[replacement.index] = {
    ...replacement.block,
    id: existing.id,
  };
  ```
- 不然每次替换都换 id，@mention 形成的 shortId 会失效。

---

## 技术细节

- `copy_logics` 与 `preset_copy_logics` 写入路径：`activeLogic.source === "preset"` 时，团宝先 fork 一份到 `copy_logics`（同名 + " (我的偏好)"），把活跃逻辑切到新 fork，再写入；保证预设不被污染。fork 后通过工具返回告知前端要切换 active 选择。
- 所有偏好写入走已有的 `supabaseAdmin` 客户端（chat.ts 内已加载）。
- 不新增数据库表，不改 schema。
- 不动 ProductTab、shipping、其他 Tab。
- 不动 SMS、auth、user_roles。

---

## 涉及文件

- `src/routes/api/chat.ts` — 新工具 `remember_preference`、系统提示新增「记忆 / mention」两段、`blocksReplaceAt` 保留 id。
- `src/components/tuan/IntroTab.tsx` — 块头 ✨ 按钮 + 改写 Popover，向上回传 `onAskAI`。
- `src/components/tuan/types.ts` — 若需要，`text` 块 label 帮助函数。
- `src/routes/app.project.$id.tsx` — 接 `onAskAI` → `sendMessage`；textarea 加 `BlockMentionPopover`；处理 `remember_preference` 工具消息渲染；fork 后切换 active logic。
- `src/components/tuan/BlockMentionPopover.tsx` — 新建。
- `src/components/tuan/BlockAIRewritePopover.tsx` — 新建。

不修改：路由/服务端中间件/auth/Supabase 集成层/任何生成文件。
