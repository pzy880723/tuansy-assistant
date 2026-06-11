## 设置页：文案逻辑（Copy Logic）模板管理

让团长在 `/settings` 里维护一组「文案撰写逻辑」预设，每个预设可用自然语言描述也可以按模块逐项填写，两侧用 AI 双向匹配。后续团宝写文案时会读取当前激活的预设作为框架。

### 1. 数据库（新建 `copy_logics` 表）

字段：
- `id`, `user_id`, `name`（如 "服装文案"）
- `description`（自然语言描述，TEXT）
- `modules`（JSONB，按顺序的模块数组）
- `is_active`（同一用户仅一条 true，团宝写文案时用它）
- `created_at`, `updated_at`

模块项结构：
```
{ id, type: "title" | "paragraph" | "image_large" | "image_grid" | "video" | "params",
  label: "强力吸睛标题" | "痛点共鸣段" | …,
  guidance: "怎么写这一段的自然语言说明" }
```

RLS：用户只能 CRUD 自己的；GRANT 给 authenticated + service_role。

### 2. 服务端函数（`src/lib/copy-logics.functions.ts`）
- `listCopyLogics()` – 当前用户全部
- `upsertCopyLogic({ id?, name, description, modules, is_active })`
- `deleteCopyLogic({ id })`
- `setActiveCopyLogic({ id })` – 把其它行 is_active 置 false
- `generateModulesFromText({ name, description })` – 调 Lovable AI（gemini-3-flash-preview）+ `Output.object` schema，根据 NL 描述生成模块数组（含默认五步法 fallback）
- `generateTextFromModules({ name, modules })` – 反向：把模块清单总结成一段 NL 描述

均用 `requireSupabaseAuth`。

### 3. 默认种子
首次进入设置页时，如果用户一条逻辑都没有，前端调用 `upsertCopyLogic` 写入"通用五步法"默认预设（拿 chat.ts 里的五步法直接转化为 modules + description），设为 active。

### 4. UI（重写 `src/routes/settings.tsx`）

布局：
- 顶部"新增文案逻辑"按钮 → 弹出输入"名称"对话框，建空白预设后进入编辑视图
- 左侧列表：所有预设，显示名称 + 是否激活 + 删除按钮；点击切换
- 右侧编辑卡片：
  - 名称输入
  - "设为当前激活" Toggle
  - **自然语言描述** `Textarea`（自适应高度），右上角按钮「→ 生成模块」（调 generateModulesFromText，loading 状态）
  - **模块清单**：可拖动重排、每条显示 type 标签 + label + guidance（Textarea）
    - 每条尾部「删除」「上移」「下移」
    - 末尾按钮"+ 添加模块"（弹出 type / label 选择）
  - 模块区右上角按钮「← 回写自然语言」（调 generateTextFromModules，把结果写入 description）
- 所有字段输入都按 800ms 防抖自动 `upsertCopyLogic` 保存，右上角显示"已保存 hh:mm"
- 保存/AI 调用失败用 toast 显示

### 5. 不在本次范围（明确告知用户后续做）
- 把激活逻辑接入 `/api/chat` 的 system prompt（下一步可单独迭代，避免本次范围过大）
- 项目级覆盖（每个团购单独选用哪个文案逻辑）

### 涉及文件
- 新增：`supabase/migrations/<ts>_copy_logics.sql`
- 新增：`src/lib/copy-logics.functions.ts`
- 新增：`src/components/settings/CopyLogicEditor.tsx`
- 编辑：`src/routes/settings.tsx`
