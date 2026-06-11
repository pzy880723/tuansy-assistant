## 目标

让聊天生成文案时遵守用户在「设置 → 文案编辑逻辑」里定义的模板（模块顺序 + 每模块自然语言指导）。在 ChatPane 顶部新增一个"文案逻辑"下拉选择器：
- 用户手动选定 → 强制用该逻辑
- 留空（默认"自动"）→ 后端依据当前项目品类 + 商品标题，让 AI 匹配最合适的一条，匹配不到则回落到 `is_active=true` 的全局默认；再没有就用现有硬编码五步法。

## 后端改动 `src/routes/api/chat.ts`

1. 请求体新增可选 `copyLogicId?: string`。
2. 加载逻辑：
   - 若 `copyLogicId` 传了 → `supabaseAdmin.from("copy_logics").select().eq("id", id).eq("user_id", userId).maybeSingle()`。
   - 否则查询该用户全部 `copy_logics`（只取 `id,name,description,modules`），若 ≥1 条：
     - 取 `is_active=true` 那条作为 fallback；
     - 若总数 ≥2，调用一次轻量 `generateText` (gemini-3-flash) + `Output.object({ id: enum(候选id列表) })`，prompt 喂入候选列表（名称+description 截断 200 字）+ 当前 `product.category` + `product.title`，让模型选最匹配的一条；选不出走 fallback。
   - 都没有则不注入，沿用现有硬编码段。
3. 把选中的 logic 渲染成 prompt 片段并替换/拼接到 system 中：
   - 在【文案五步转化框架…】整段之前插入「【当前启用文案逻辑：${name}】」块，内容含：
     - `description`（自然语言总纲）
     - 模块清单：`1. [type] label — guidance` 逐条列出
     - 一句硬约束："写 intro.title/description/blocks 时必须按上述模块顺序逐段输出；每段内容必须满足对应 guidance；五步法仅作风格参考，与上面冲突时以本逻辑为准。"
4. 在响应头里回写 `X-Tuanbao-Copy-Logic: <id>`，便于前端显示已生效的逻辑（可选）。

## 前端改动

### `src/routes/app.project.$id.tsx`（ChatPane）
1. 新增 `useQuery(["copy-logics"], listCopyLogics)`。
2. ChatPane 顶部（输入框上方或标题栏右侧）加一个紧凑 `Select`：
   - 选项：`自动匹配` + 用户所有逻辑（标注哪条是 ⭐ 激活）。
   - 选中值放 React state `selectedLogicId`，并 `localStorage` 按 projectId 持久化。
3. `DefaultChatTransport.prepareSendMessagesRequest` 已经 spread body —— 在 body 里追加 `copyLogicId: selectedLogicId ?? undefined`。

### 不改：`src/lib/copy-logics.functions.ts`、settings 编辑页、其他 tool 行为。

## 自动匹配细节

- 候选 prompt 控制在 ~1.5k tokens：每条只塞 name + description 截 200 字 + 模块 label 列表。
- 用 `Output.object({ id: z.enum([...]) })`，没有匹配返回 `is_active` 那条的 id（在 enum 中保留 `"__none__"` 选项让模型可表达"都不匹配"）。
- 单次额外调用约 1-2s，可接受；后续如需可加缓存（按 projectId + product.title 哈希），本期不做。

## 不在范围

- 不改 copy_logics 表结构。
- 不改 settings UI。
- 不改其他 tool 的 schema。

## 涉及文件

- `src/routes/api/chat.ts`（主要改动）
- `src/routes/app.project.$id.tsx`（加 Select + 透传 copyLogicId）
