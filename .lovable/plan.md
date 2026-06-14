## 目标
解决两件事：
1. 项目卡上的红点点进去后没反应——pending 素材没有任何地方接住。
2. 手机端发来的图/文/链接，应该**进项目时就在左边对话框里弹出**，问："要不要用这些？"，确认后由团宝结合到右边预览。

## 行为

### 进入项目时
- ChatPane 挂载后调用 `listProjectPendingInbox({ projectId })`。
- 若 `items.length > 0`，在聊天流末尾**注入一条不会被发到模型的本地系统卡**（`role: "system"`, `id: "inbox-card-<batchTs>"`），渲染成「📥 手机收料台 收到 N 条素材」卡片：
  - 图片：缩略图九宫格（点击可放大、可拖到右侧——复用现有 `ImageLightbox` / `DraggableChatImage`）。
  - 文字：折叠预览 + 复制按钮。
  - 链接:标题 + 域名 + 打开。
- 卡片底部两个主操作 + 一个次操作：
  - **「全部使用 →」**（主）
  - **「只入素材库」**（次）
  - **「全部忽略」**（淡）
- 卡片只在进入项目那一次拉取后弹出；处理完（任一按钮点击）后消失，并把这批 ids 调 `markInboxConsumed`。后续手机端再丢素材，下次进项目时再弹。

### 「全部使用」点击后
- 图片：
  1. 调新增的 `adoptInboxImagesToProject({ projectId, ids })`：服务端把图片 URL 写入 `project_images`（追加在末尾，order 续号），并 `markInboxConsumed`。
  2. 同时构造一条**真的用户消息**通过 `sendMessage` 发出：
     - `parts`: `[{type:"text", text:"我从手机收料台导入了 N 张新图，请你结合这些图把右边预览补充/替换得更合适，记得说明每张图放到了哪个模块。"}, ...imageParts]`
     - imageParts 用现有 `image-attachments` 的格式（与「+ 上传图片」走同一通道），URL 来自 inbox.payload.urls。
- 文字/链接：
  - 文字：拼接成 `用户从手机端发来一段补充资料：\n"""\n{text}\n"""\n请结合到合适的位置。`
  - 链接：`用户从手机端发来一个参考链接：{title} {url}，请抓核心信息融入文案。`
  - 一并并入同一条用户消息（多类型时分段）。
- 走完后由现有 chat 流自动驱动团宝读上下文 + 写入 intro/skus；团宝写完后由 `onFinish` 触发 project query 失效，右侧预览自动刷新。

### 「只入素材库」
- 仅做 `adoptInboxImagesToProject`（图片入库）+ `markInboxConsumed`，**不发对话**。
- 对于纯文字/链接条目，仅 `markInboxConsumed`（素材库不存文字）。

### 「全部忽略」
- 仅 `markInboxConsumed`。

### 项目卡红点
- /app 的 `ProjectCard` 红点保持不变；用户点进去后由弹卡完成消化，红点会随 query 失效自动归零（`["inbox-pending-counts"]` 失效）。

## 技术细节

### 新增服务函数（`src/lib/inbox.functions.ts`）
- `adoptInboxImagesToProject({ projectId, ids })`
  - `requireUserId` + `assertProjectOwner`。
  - 读取这批 `inbox_items` 中 `kind = image` 的所有 `payload.urls`。
  - 查 `project_images` 当前 `max(sort_order)`，逐个 `insert {project_id, url, sort_order}`。
  - `markInboxConsumed(ids)`（合并所有 ids，不只是图片，方便一次性消化整批）。
  - 返回 `{ adopted: <number>, urls: string[] }`。

### 前端：`src/components/tuan/InboxIntakeCard.tsx`（新建）
- 入参 `{ items, onAdoptAll, onLibraryOnly, onIgnoreAll, busy }`。
- 渲染分组：图片九宫格、文字、链接；底部 3 个按钮。
- 复用 `ImageLightbox`，缩略图用 `DraggableChatImage`（顺带支持单独拖到右侧）。

### `ChatPane`（`src/routes/app.project.$id.tsx`）
- 用 `useQuery(["project-inbox-pending", projectId])` 调 `listProjectPendingInbox`，`staleTime: 0`，`refetchOnWindowFocus: false`。
- 仅在**首次拉到 items 且未在本会话弹过**时调用 `setMessages([...messages, inboxCardMsg])`。本会话用 ref 记 batch key，避免重复注入。
- 在 `MessageRow` 渲染分支里识别 `id.startsWith("inbox-card-")` 的 system 消息，渲染 `<InboxIntakeCard ...>` 而不是普通气泡。
- 三个回调里调对应服务函数，成功后：
  - 失效 `["inbox-pending-counts"]`、`["project-inbox-pending", projectId]`、`["project", projectId]`。
  - 从 `messages` 里移除这张卡（`setMessages(prev => prev.filter(m => m.id !== cardId))`）。
- 注入卡用的 system 消息不参与发给模型——`prepareSendMessagesRequest` 已经只发 `useChat` 维护的 messages，所以需要在发给后端前过滤掉 `id.startsWith("inbox-card-")`（在 `prepareSendMessagesRequest` 里 `messages.filter(...)`）。

### 持久化
- inbox 卡注入到 messages 后，会被现有的 `saveProjectChat`（之前一步加的云端持久化）一并保存。处理后从 messages 移除，云端也跟着更新——下次跨设备进项目也不会重复弹（即使 batch ids 已 consumed）。

## 文件清单
- 新建：`src/components/tuan/InboxIntakeCard.tsx`
- 修改：`src/lib/inbox.functions.ts`（新增 `adoptInboxImagesToProject`）
- 修改：`src/routes/app.project.$id.tsx`（查询 + 注入 + 卡片回调 + 过滤发给模型的消息）

## 验证
1. 手机端发 2 张图 + 1 段文字到任意项目 → /app 卡片红点 3。
2. 进入该项目 → 对话流末尾立刻弹出收料卡。
3. 点「全部使用」→ 卡片消失；对话出现"我从手机收料台导入了 2 张新图，并补充一段资料……"；团宝开始工具调用写入；右侧预览随之更新；红点归零。
4. 重新进入同一项目 → 不再弹卡。
5. 切到另一台电脑登录同账号进同项目 → 也不再弹卡（已 consumed）。
