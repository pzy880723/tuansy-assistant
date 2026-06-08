## 1. 改文案：开始开团 → 快速开团

`src/routes/index.tsx` 第 179 行：

- 非计划模式按钮文案 `开始开团` → `快速开团`
- 计划模式保持 `先聊清楚`

## 2. 计划模式按钮点了"没反应"

代码上 `onClick` 是接的，问题更像是视觉变化太弱——非激活态白色 12% 描边，激活态橙色 55% 描边 + 半透明橙色背景，在深色卡片上几乎看不出差别。修法：

- 激活态用实色橙色填充：`bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-white border-transparent`，加一个左侧白色小圆点指示灯。
- 非激活态颜色拉强一点：`border-white/25 text-white/75`。
- 文案改成"计划模式 已开"/"计划模式"，并在切换时 `toast.success("已开启计划模式")` / `toast("已关闭计划模式")`，让人立刻知道点中了。
- 工作台 `ChatPane` 里那个一样样式的小按钮也做同样的处理。

## 3. 加图片真正能用 + 拖拽 + 粘贴 + 批量

### 后端

`src/lib/projects.functions.ts` 新增 `uploadProductImage`（POST，`requireSupabaseAuth` 不加，因为目前其他 fn 也都用 admin）：

- 输入：`{ projectId?: string; filename: string; mimeType: string; dataBase64: string }`，校验 mime 是 `image/*`、base64 解码后 ≤ 8MB。
- 通过 `supabaseAdmin.storage.from("product-images").upload(<uuid>.<ext>, bytes, { contentType, upsert: false })`。
- 用 `getPublicUrl` 拿地址；存在 `projectId` 时 `insert` 到 `project_images(project_id, url, sort_order)`。
- 返回 `{ url }`。

`product-images` 桶现在是 private——这一步用 `supabase--storage_update_bucket` 把它切成 public，方便 AI 模型按 URL 直接读取图片（团购商品图本身就是公开素材，没有隐私问题）。如果工作区禁公开桶就退回到 server fn 内用 `createSignedUrl(7d)`。

`startProject` 扩展：

- 入参增加 `imageUrls: string[]`（最多 9 张）。
- 给模型的 prompt 末尾追加"用户还上传了 N 张商品图，可作为品类判断依据：<url 列表>"。
- 项目入库后把这些 URL 写入 `project_images`，第一张同时写到 `projects.cover_image_url`。

### 前端通用 hook

新建 `src/lib/use-image-attachments.ts`：

- state：`attachments: { id, previewUrl, uploading, url? }[]`，`dragActive: boolean`
- `addFiles(files)`：过滤 `image/*`、限制 ≤ 9 张、单张 ≤ 8MB；客户端 canvas 压缩到长边 1600px；`URL.createObjectURL` 出缩略图；并行调 `uploadProductImage` 拿回 url 回填。
- `bindDragHandlers(): { onDragEnter, onDragOver, onDragLeave, onDrop }` 给任意容器用。
- `bindPasteHandler(): onPaste` 给 textarea 用，取 `clipboardData.files`（已经支持一次性多张）。
- `remove(id)` / `clear()` / `getUrls()`。

### 首页 `HeroStarter`

- 用 hook 接管外层 `div` 的拖拽事件；`dragActive` 时把容器边框加成橙色虚线（`outline-dashed outline-[oklch(0.7_0.19_45)]`）。
- textarea 加 `onPaste`。
- "加图片"按钮触发隐藏的 `<input type="file" accept="image/*" multiple>`，`onChange` 调 `addFiles`。
- textarea 下方渲染缩略图条（圆角小图 + 右上角 ×；正在上传时盖一层 spinner）。
- 提交时把 `getUrls()` 一起传给 `startProject`，并要求至少有一张图或文字 ≥ 4 字。

### 工作台 `ChatPane`

- 同一个 hook，给最外层 flex 容器绑拖拽；输入区 textarea 绑粘贴；"图片附件"按钮接 file input。
- 输入框上方显示同样的缩略图条。
- 发送时把附件转成 AI SDK 的 file part 一起发：`sendMessage({ text, files: [{ type: "file", mediaType, url }, ...] })`。
- `/api/chat` 已用 `convertToModelMessages`，可以直接把 file parts 传给 Gemini，不用改后端。

## 涉及文件

- `src/routes/index.tsx`（按钮文案 + 计划按钮样式 + 图片附件 UI）
- `src/routes/app.project.$id.tsx`（计划按钮样式 + 图片附件 UI + 发送时带 file part）
- `src/lib/projects.functions.ts`（新增 `uploadProductImage`，`startProject` 接收 `imageUrls`）
- 新建 `src/lib/use-image-attachments.ts`（hook）
- `supabase--storage_update_bucket` 把 `product-images` 改 public

## 不动

- AI prompt 的品类规则、撰写口径
- `/api/chat` 路由本身
- 不引新依赖（拖拽/粘贴/压缩全部用浏览器原生 API）
