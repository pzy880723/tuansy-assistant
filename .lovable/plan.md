## 双向同步：右侧编辑 → 左侧聊天 & 历史

**核心机制**: 用一个轻量事件总线（`window.dispatchEvent` + `CustomEvent`）从右侧 `PreviewPane` 向左侧 `ChatPane` 广播手动编辑事件，避免大改父组件结构。

### 1. 新建 edit-log 总线（`src/lib/edit-log-bus.ts`）
导出 `emitManualEdit(projectId, field, label, snapshotPatch)` 与 `onManualEdit(projectId, cb)`。事件名 `tuanbao:manual-edit:<projectId>`。

### 2. PreviewPane 在每次保存时按字段防抖
- 在 `setIntro / setSkus / setSettings` 中除了原有 `persist`，再调用一个新的 `logEdit(field, humanLabel, fullSnapshot)`。
- `logEdit` 内部按 `field`（intro / skus / settings / 进一步细化到 title / description / blocks / sku 名称 / 设置 key）维护一个 debounce map，停顿 1.5s 后 `emitManualEdit`。
- 字段→中文 label 映射：`intro.title` → "修改了标题"、`intro.description` → "修改了介绍正文"、`intro.blocks` → "调整了介绍内容块"、`skus` → "修改了商品规格"、`settings.<key>` → "修改了设置：<中文名>"。

### 3. ChatPane 监听并写入 history + 系统消息
- `useEffect` 订阅 `onManualEdit(projectId)`，回调里：
  - **HistoryEntry**: `push` 一条 `{ label: "✏️ "+humanLabel, snapshot, messageIndex: messages.length, source: 'manual' }`，可点击回滚（沿用现有 rollback 逻辑）。
  - **系统消息**: 用 `setMessages(prev => [...prev, sysMsg])` 追加一条 `role: 'system'` 风格 UIMessage（自定义 id `manual-<ts>`，单个 text part 文案 `✏️ ${humanLabel}`）。
- `MessageRow` 增加分支：`msg.role === 'system'` 时渲染一条居中、灰色细条 `<div class="mx-auto text-[11px] text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">✏️ …</div>`，不显示头像/气泡。
- 系统消息一并写入 `tuanbao.chat.<projectId>` localStorage（沿用现有 effect）。

### 4. 防止 AI 工具调用回写也被记为"手动编辑"
- `lastWrittenRef` 已区分本地 vs 远端；`logEdit` 只在用户调用 `setIntro/setSkus/setSettings` 时触发，AI 通过 `invalidateQueries` 路径不会进入这些 setter，天然安全。

### 5. 不改动
- 数据库表结构、`/api/chat` 后端、AI tool 流程、回滚逻辑、`IntroTab` 内部 UI。

### 涉及文件
- 新增：`src/lib/edit-log-bus.ts`
- 编辑：`src/routes/app.project.$id.tsx`（PreviewPane setter、ChatPane effect、MessageRow 增加 system 分支）
