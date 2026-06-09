
## 问题

左侧团宝改东西，右侧预览没反应。根因是 **AI 工具写入的字段 ≠ 预览读取的字段**。

预览 (`PreviewPane`) 按 Tab 读取：

```text
介绍 Tab  → project.intro     ({ title, description, blocks })
商品 Tab  → project.skus      (顶层 jsonb 数组, 优先)
            project.product.skus  (兜底)
设置 Tab  → project.settings  ({ delivery, guarantee, ... })
```

而当前 `src/routes/api/chat.ts` 里团宝只有：

```text
update_product → 写到 projects.product.{title|subtitle|tags}
update_skus    → 写到 projects.product.skus
```

→ 介绍 Tab、设置 Tab、商品 Tab（顶层 skus 存在时）**全部收不到 AI 改动**。
而且 system prompt 只塞了 `product`，模型看不到用户在预览里改出来的 intro / skus / settings 真实当前值。

刷新链本身没坏：`onToolCall` + `onFinish` 都会 invalidate `["project", id]`，server fn 返回新数据后预览会自动重渲。所以只要工具写对列，实时联动立刻就通。

## 改动范围

只动一个文件：`src/routes/api/chat.ts`。预览侧、`projects.functions.ts`、UI 都不动。

### 1. 重写 system prompt 注入的"当前状态"

读 project 时一次性 select `name, intro, skus, settings, product`，并在 prompt 里展示真实的当前 intro / skus / settings / product，让团宝写之前能看清楚现状。

### 2. 用 4 个工具替换原来的 2 个，直接对应预览的 4 块数据

| 工具 | 写入列 | 用途 |
|---|---|---|
| `update_intro` | `intro` | 改介绍 Tab 的标题 / 正文描述 / blocks |
| `update_skus` | `skus`（顶层 jsonb 数组）| 整体替换 SKU 列表（name/price/stock，可扩展字段） |
| `update_settings` | `settings` | 改配送、起团、保障、自提点等 key-value 设置 |
| `update_product_meta` | `product`（合并写入 title/subtitle/tags/cover）| 兜底的商品元信息，主要给商品 Tab 顶部用 |

每个工具：
- 用 zod schema 校验入参；只接收"该列的 patch"，工具内部 `{ ...current, ...input }` 合并后整列写回。
- 写完返回 `{ ok: true, updated: [...] }`，让客户端 `onToolCall` 立刻 invalidate 查询。
- `update_skus` 仍然要求传完整数组（避免漏 SKU），但 schema 扩到包含预览实际支持的可选字段。

### 3. 保留 `ask_questions` / `suggest_next` 不变

这两个工具与数据写入无关，保持现状即可。客户端已经有 `Questionnaire` 组件渲染。

### 4. 调整工作原则文案

system prompt 里明确："改介绍文字→ update_intro；改 SKU → update_skus；改配送/起团/保障 → update_settings；改商品标题副标题标签 → update_product_meta。不要把所有改动都塞进 update_product_meta。"

## 验证

1. 在介绍 Tab 让团宝把标题改成"现摘黄心猕猴桃" → 预览介绍 Tab 立刻变化。
2. 让团宝加一个 1 斤试吃装 19.9 → 商品 Tab 立刻多一档。
3. 让团宝把起送量改成 10 件 → 设置 Tab 立刻变化。
4. 在预览里手动改一个字段，再让团宝"基于现在的内容润色一下副标题" → 团宝回复里应能引用到刚改过的值（说明 prompt 注入了真实当前状态）。

## 不在本次范围

- 不动数据库 schema、不加新列。
- 不改预览的读取优先级（`skus` 优先于 `product.skus` 的逻辑保留）。
- 不引入 Realtime 订阅（现有 React Query invalidate 已经够用，且本地写本地读延迟更低）。
