## 目标
1. **修 Bug**：「全部使用 →」目前只把图入了素材库 + 发给团宝，没有出现在右侧预览。改成直接把图按顺序追加为预览大图块，同时仍发给团宝继续优化。
2. **新增素材库**：项目顶栏「同步快团团」按钮左侧加入口，弹层按来源分 tab（全部 / 手机收料 / AI 生成 / 手动上传），每张图可「插入预览」或「在编辑页编辑」。

---

## 一、Bug 修复 —「全部使用 →」要写入预览

`src/routes/app.project.$id.tsx` 的 `handleInboxAdoptAll` 在 `adoptInboxFn` 成功后，把返回的 `urls` 顺序追加为 `intro.blocks` 末尾的 `image_lg` 块，再写回数据库（`updateProject({ id, patch: { intro } })`），并 invalidate `["project", projectId]` 让右侧预览立刻刷新。然后再 `sendMessage` 让团宝继续优化。

要点：
- 用 `qc.getQueryData(["project", id])` 读当前 intro，缺失时用 `{ blocks: [] }` 兜底
- 新块结构与 IntroTab 里现有 `image_lg` 一致：`{ type: "image_lg", id: 新生成, url }`
- 在 sendMessage 的提示里把"已经把图放在预览末尾"告知团宝，避免重复插入

---

## 二、素材库

### 1. 数据来源标记
迁移 `project_images`：新增 `source text` 字段（取值 `manual` / `ai` / `inbox`），默认 `manual`；老数据保持 `manual`。

写入侧改三处：
- `adoptInboxImagesToProject`（手机收料采纳）→ `source: "inbox"`
- AI 生图采纳到预览的流程（团宝调用 `update_intro` 时若引用了新 URL，由前端在镜像 intro 的 image 块时顺手 upsert 到 `project_images` 并标 `source: "ai"`；或在 `uploadAiGeneratedImage` 时就插一行 `source: "ai"`），采更简单的方案：**在 `uploadAiGeneratedImage` 成功后立即 insert `project_images` 一行**
- `uploadProductImage`（手动上传）→ 现在已经只在团宝调用工具时写入，要补成：用户上传后立刻 insert `project_images` 一行 `source: "manual"`

### 2. 新接口
`src/lib/projects.functions.ts` 新增：
- `listProjectAssets({ projectId })` → 返回 `{ assets: Array<{ id, url, source, created_at, used_in_preview: boolean }> }`，`used_in_preview` 通过比对当前 `projects.intro` 的所有 `image_lg.url` / `image_sm.urls` 计算
- `appendImageToPreview({ projectId, url })` → 把指定 URL 作为 `image_lg` 块追加到 `intro.blocks` 末尾并保存
- `deleteProjectAsset({ id })` → 仅从素材库删，不动 intro

### 3. UI
新组件 `src/components/tuan/AssetLibrarySheet.tsx`：
- 触发器：图片堆叠图标（Lucide `Images`）+「素材库 (N)」，N=素材总数
- 弹层用 `Sheet`（右侧抽屉，宽 480px），内部 `Tabs`：全部 / 手机收料 / AI 生成 / 手动上传
- 网格 3 列，每张图悬停时显示三个动作：
  - **插入预览**：调用 `appendImageToPreview`，invalidate project 查询
  - **去编辑页用**：关闭抽屉并 `emit` 一个事件给 IntroTab 让左侧弹出"选这张图"的提示（v1 简化为：直接复制 URL 到剪贴板 + toast「已复制图片地址，可在编辑页选择"从已上传图片中选择"贴入」）
  - **删除**：二次确认后 `deleteProjectAsset`
- 已在预览中使用的图右上角加 ✓ 角标 + 悬浮文案「已在预览」

接入位置：`src/routes/app.tsx` 在 `<SyncToKttButton>` 前插入 `<AssetLibraryButton projectId={id} />`。

---

## 三、文件改动清单

**新建**
- `src/components/tuan/AssetLibrarySheet.tsx`（含按钮 + 抽屉两个导出）

**编辑**
- `supabase` 迁移：`project_images` 新增 `source` 列
- `src/lib/projects.functions.ts`：新增 `listProjectAssets` / `appendImageToPreview` / `deleteProjectAsset`；在 `uploadProductImage` handler 末尾插入 `project_images` 行
- `src/lib/image-gen.functions.ts`：`uploadAiGeneratedImage` 成功后插入 `project_images` 行（`source: "ai"`）
- `src/lib/inbox.functions.ts`：`adoptInboxImagesToProject` 写入时带 `source: "inbox"`
- `src/routes/app.project.$id.tsx`：`handleInboxAdoptAll` 改成"先追加大图块再 sendMessage"
- `src/routes/app.tsx`：顶栏加入素材库按钮

不动：聊天面板缩略图拖拽、IntroTab 现有"从已上传图片中选择"逻辑保持不变（它已经能列出 availableImages）。
