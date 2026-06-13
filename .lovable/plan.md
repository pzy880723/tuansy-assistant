
## 1. 团宝是否能实时拿到最新的文案逻辑模板？

**结论：会拿到，但目前体感不明显。** `src/routes/api/chat.ts` 在每条用户消息进来时都会重新查一次 `copy_logics` 表（按 `copyLogicId` 或激活态匹配），dialog 里编辑的 800ms 防抖自动保存写完后，下一条消息就用最新版。"没生效" 通常有两种真实原因，我们顺手修掉：

- **没有把编辑过的模板设为"启用"或选中**——chat 优先取项目当前选中的 `copyLogicId`，没选中才走 `is_active` 兜底。dialog 关闭时，会立即 `invalidateQueries(["copy-logics"])` 但**不会自动把刚编辑的模板设为当前项目选中项**。修改后在 dialog 顶部加一行小灰字提示："修改已保存，团宝下条消息就会用最新版"，并在关闭 dialog 时强制刷新顶部 Select 数据。
- **dialog 内部把模板换了一个再编辑**——这种情况是预期行为，不动。

## 2. 锁定模块（防止团宝修改）

### 数据模型
在 `src/components/tuan/types.ts` 的 `IntroBlock` 每个变体加可选字段 `locked?: boolean`。默认 `false/undefined`。

### 预览侧 UI（`src/components/tuan/IntroTab.tsx`）
- `BlockCard` 头部工具栏现有 上移/下移/删除/AI 重写 按钮旁，新增一个 🔒 / 🔓 Lock 图标按钮。
- 已锁定时：
  - 卡片整体加一个浅色描边（`ring-1 ring-amber-400/60`）+ 右上角小标签「已锁定」。
  - AI 重写按钮禁用并提示「先解锁该模块」。
- 通过 `onChange` 把 `locked` 写回 block。

### 服务端保护（`src/routes/api/chat.ts`）
- `update_intro` tool 的 `execute()` 里读到 `currentBlocks` 后：
  - **blocksReplaceAt**：若 `currentBlocks[index].locked === true`，跳过该 index 并在返回结果里加上 `skippedLocked: [...]`，让模型知道被忽略了。
  - **blocks（整体替换）**：把 `currentBlocks` 里所有 `locked` 的 block 按原索引保留下来，把模型给的 blocks 填进剩余位置（按顺序）；若两者数量冲突则保留所有 locked + 追加未锁定的新内容。
  - **blocksAppend**：不影响（只追加）。
- 系统 prompt 在【图文配对工作流】之前追加一段【锁定模块规则】：
  - 告诉团宝：blocks 中若带 `locked:true` 的段落，**禁止替换/重写/合并/重排**，只能在它前后插入新模块或微调其他段落；用户明示要改时才提示「该段被锁定，需要先解锁」。
  - 在系统 prompt 注入的 `intro` JSON 里就会自带 `locked` 字段（因为我们直接 `JSON.stringify(intro)`），不用额外改。

### 持久化
现有 `setIntro` 已经做整体 JSON 持久化，`locked` 字段会自动一起存进 `projects.intro` jsonb，无需迁移。

## 3. 团购商品入口移动到「商品编辑」Tab 顶部

- `src/routes/app.project.$id.tsx` line 1235-1242：移除 `tab === "intro"` 分支里底部的 `<ProductEntryCard count={skus.length} />`，恢复成单纯 `<IntroTab .../>`。
- `src/components/tuan/ProductTab.tsx`：在最顶部（return 的 `space-y-2` 容器第一个子元素）渲染 `<ProductEntryCard count={skus.length} />`；`ProductEntryCard` 已经在 `IntroTab.tsx` 中 `export`，直接 import 复用即可。

## 技术细节速览

| 文件 | 变更 |
|---|---|
| `src/components/tuan/types.ts` | 给 4 个 IntroBlock 变体加 `locked?: boolean` |
| `src/components/tuan/IntroTab.tsx` | `BlockCard` 增加锁定按钮 + 视觉态；锁定时禁用 AI 重写 |
| `src/components/copy-logic/CopyLogicSection.tsx` | 顶部加灰字提示 "修改已保存，团宝下条消息会用最新版" |
| `src/routes/app.project.$id.tsx` | 移除 IntroTab 下方的 ProductEntryCard；dialog `onOpenChange(false)` 时已经 invalidate，无需再改 |
| `src/components/tuan/ProductTab.tsx` | 顶部插入 ProductEntryCard |
| `src/routes/api/chat.ts` | system prompt 增加【锁定模块规则】；`update_intro` 的 blocks/blocksReplaceAt 分支尊重 `locked` |

不动：copy logic 后端/`chat.ts` 中文案逻辑加载逻辑、`projects` 表结构、其他 Tab。
