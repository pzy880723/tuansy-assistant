## 目标

在文案逻辑编辑器（`CopyLogicEditor`）的顶部"名称"输入框右侧增加一个「扫码上传」按钮。点击弹出二维码，团长用手机扫码后打开现成的 `/m/inbox` 移动上传页，所拍/所选图片自动入库到**当前正在编辑的项目素材库**（与 `AssetLibrarySheet` 共用同一份数据，「手机」来源标签）。

## 现状摸底

- 移动端 `/m/inbox` 已经能拍照/选图上传，并写入 `inbox_items` + `product-images` 存储桶 —— 这是现成的基础设施，本次不重写。
- `AssetLibrarySheet` 已把 `inbox` 来源标记为「手机」并展示在素材库 Tab 中，所以图片到位后用户在素材库自然就能看到。
- `CopyLogicEditor` 目前不知道 `projectId`，且被两处使用：`CopyLogicSection`（在 `settings.tsx` 无项目、在 `app.project.$id.tsx` 嵌入有项目）和 `admin.presets.tsx`（无项目）。
- `/m/inbox` 目前不支持通过 URL 预选项目。

## 改动清单

### 1. 让 `/m/inbox` 支持 `?project=<uuid>` 预选

文件：`src/routes/m.inbox.tsx`
- `createFileRoute` 增加 `validateSearch`：`{ project?: string }`（uuid 校验，可选）。
- 在 `InboxScreen` 用 `Route.useSearch()` 读取。当存在 `project` 且该 id 出现在 `listMyRecentProjects` 返回里时，初始化 `selectedProjectId` 用它（覆盖默认选最近一个的逻辑），并在项目选择条上加一个小提示「电脑端已为你选好项目」。
- 不强制锁死选择，团长仍可改。
- 若传入 id 不在列表里，回退到现有默认行为，避免出错。

### 2. `CopyLogicEditor` 顶部加扫码按钮

文件：`src/components/copy-logic/CopyLogicEditor.tsx`
- Props 增加可选 `projectId?: string`。仅当 `projectId` 存在时显示扫码按钮（admin/settings 场景下不出现）。
- 名称 `Input` 改为 flex 行：左侧 Input 占满，右侧紧跟一个 `Button`（icon = lucide `QrCode`, 文案「扫码上传图片」, `variant="outline"`, `size="sm"`）。
- 点击打开新组件 `<MobileUploadQRDialog projectId={projectId} />`（同文件内或同目录新文件，倾向同目录新文件 `MobileUploadQRDialog.tsx` 保持编辑器精简）。

### 3. 新文件：`src/components/copy-logic/MobileUploadQRDialog.tsx`

- 使用 shadcn `Dialog`，触发由父组件传入 `open/onOpenChange` 控制。
- 构造 URL：`${window.location.origin}/m/inbox?project=${projectId}`（SSR-safe：在 effect 里赋值）。
- 用 `qrcode` npm 包在客户端生成二维码（渲染到 `<canvas>` 或转成 dataURL 放进 `<img>`）。`qrcode` 体积小、纯 JS、无 React 依赖问题；通过 `bun add qrcode @types/qrcode`。
- UI：
  - 二维码 220×220 居中
  - 下方一行小字：「用微信/相机扫一扫，手机选图后会自动进入本项目素材库」
  - 一个「复制链接」按钮（`navigator.clipboard.writeText`），方便桌面端测试
  - 关闭按钮
- 关闭弹窗时调用一次素材库的 `queryClient.invalidateQueries({ queryKey: ["project-assets", projectId] })`，让素材库刷新出新传图片（通过新增可选 prop 暴露 `onClose`，或在 Dialog 内部直接拿 `useQueryClient`，倾向后者）。

### 4. 把 `projectId` 透传下来

- `CopyLogicSection` 增加可选 `projectId?: string` prop，并把它继续传给 `CopyLogicEditor`。
- `src/routes/app.project.$id.tsx` 中 `<CopyLogicSection embedded />` 改成 `<CopyLogicSection embedded projectId={id} />`（`id` 来自 `Route.useParams().id`，文件里已有）。
- `settings.tsx` 与 `admin.presets.tsx` 不传 `projectId`，按钮自然隐藏。

### 5. 依赖

新增运行时依赖：`qrcode`、开发依赖：`@types/qrcode`。安装由实现阶段 `bun add` 完成。

## 不做的事

- 不改服务端、不动 RLS、不新建表、不新建存储桶 —— 完全复用 `inbox_items` + `product-images`。
- 不做"扫码后桌面端实时收到通知"的 realtime 推送；用户上传完回到桌面，关闭弹窗会触发素材库重查，已足够。
- 不在素材库内单独再加扫码入口（用户只要求文案编辑页）。

## 用户可见效果

文案编辑器（在项目内打开时）名称栏右侧多一个「扫码上传图片」按钮 → 点开二维码弹窗 → 手机扫码进入收料台并预选当前项目 → 上传 → 桌面端关闭弹窗，素材库自动刷新出"手机"来源的新图。
