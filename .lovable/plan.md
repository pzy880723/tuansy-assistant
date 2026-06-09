# 修复编辑页文案生成 & 模块系统

## 问题诊断

通过查看 `src/routes/api/chat.ts` 和 `src/components/tuan/IntroTab.tsx`，发现三个问题：

### 1. AI 只生成一句话，不是段落
当前 `update_intro` 工具的 `description` 字段说明太模糊（"介绍正文/卖点描述"），加上 system prompt 限制"控制在 3 到 6 行内"——这个限制针对的是聊天回复，但 AI 把它误用到了写入预览的文案上。

### 2. AI 写入的 blocks 类型对不上 UI
- AI schema: `type: "text" | "image"`，字段 `content`
- UI 实际类型: `text | image_lg | image_sm | video | tag`，字段 `text / url / urls / tags`
- 结果：AI 调用 `update_intro` 添加图文块时，写进数据库的数据 UI 渲染不出来，看起来"没反应"。

### 3. 团购标题字号太小，没区分层级
当前 `intro.title` 输入框是 `text-[14px] font-medium`，和正文一样大。

模块按需添加这块——`IntroTab` 已经实现了：默认 `blocks: []` 不显示任何模块，点击底部"大图/小图/视频/文字/标签"按钮才 `addBlock`，每个块带"上移/下移/置顶/添加/删除"按钮。这部分实际已经工作，但因为问题 2，AI 主动加的块渲染不出来导致看起来像没生效。

## 修改方案

### A. `src/routes/api/chat.ts` — 重写 `update_intro` 工具

让 AI 的 block schema 完全对齐 UI 类型，并明确文案长度要求：

```ts
const IntroBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image_lg"), url: z.string().nullable().optional() }),
  z.object({ type: z.literal("image_sm"), urls: z.array(z.string()) }),
  z.object({ type: z.literal("video"), url: z.string().nullable().optional() }),
  z.object({ type: z.literal("tag"), tags: z.array(z.string()) }),
]);
```

- `title` 描述改为"团购活动主标题，简短有力，10-20 字"
- `description` 描述改为"团购活动正文，必须写成完整段落，120-300 字，分 2-4 个自然段，突出品类对应的卖点；禁止只写一句话"
- `blocks` 描述改为"图文模块数组，整体替换。默认不要主动添加；只有当用户明确要求 '加大图/加小图/加视频/加标签' 等指令时才传"
- execute 里给 block 自动补 `id`（用 `crypto.randomUUID()` 或随机字符串）才能在 UI 里被 move/remove。

### B. `src/routes/api/chat.ts` — 调整 system prompt

- 把"控制在 3 到 6 行内"改成"聊天回复控制在 3 到 6 行内；但写入预览的 description 必须是完整段落（120-300 字）"
- 明确："默认不要主动添加 blocks，blocks 由用户在右侧点击按钮添加；只有用户明确说'加张大图/加小图九宫格/加段文字'等才用 update_intro 写 blocks"
- 强调"团购标题写到 title 字段，正文卖点写到 description 字段，不要把整段塞到 title"

### C. `src/components/tuan/IntroTab.tsx` — 团购标题样式

把标题输入框样式从 `text-[14px] font-medium text-[#1a1a1a]` 改为 `text-[18px] font-bold text-[#1a1a1a]`，并把 placeholder 改为"请输入团购活动标题"（已经是）。其它不动——按钮区、blocks 渲染、上下移动逻辑已正确。

## 影响范围

只动两个文件：
- `src/routes/api/chat.ts`（工具 schema + 系统提示）
- `src/components/tuan/IntroTab.tsx`（标题字号一行）

不动数据库、不动其它 Tab、不动 PhoneShell。
