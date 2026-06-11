# 修复"预览操作超级慢"的性能问题

## 现状诊断（在 `src/routes/app.project.$id.tsx` 与 `src/components/tuan/*` 实测）

慢的根因有 4 条，互相叠加，造成"每敲一个字几秒后才反应、点击按钮卡顿"：

1. **每 500ms 全量刷新整棵树**
   `PreviewPane.persist()` 每次保存后调 `qc.invalidateQueries(['project', id])` → 触发 `getProject` 重新请求 → `data` 引用变化 → `ProjectEditor` 重渲染 → `ChatPane` + `PreviewPane` 一起重渲染。每次输入都触发服务端往返 + 整页 re-render。

2. **ChatPane 持续渲染拖累 PreviewPane**
   `ChatPane` 与 `PreviewPane` 是 `ProjectEditor` 的兄弟节点，但父组件每次 `useQuery` 更新都会同时重渲染两侧。AI 流式输出时 `useChat.messages` 高频更新，间接把右侧 519 行的 `IntroTab` / 阻塞的拖拽逻辑全部重算。

3. **`InlineText` / `AutoTextarea` 受控值反向覆盖**
   两者都有 `useEffect(() => setLocal(value), [value])`。流程是：用户输入 → 本地 `local` 更新 → 500ms 后 `onChange` → 父更新 intro → 重渲染 → `value` 变 → effect 再次 `setLocal(value)`。一旦中途服务端 refetch 回包，会把还没输入完的内容覆盖回旧值，且光标位置丢失。这是用户感知的"输入卡顿/掉字"。

4. **重子树未 memo**
   `IntroTab` 的 `blocks.map(...)` 每次都生成新闭包传给 `BlockCard`，没有 `React.memo`；`MessageRow` / `ToolCard` 同理。父级任意 setState 都会 O(N) 重算。

附带：还有一处 SSR 水合错误（`AppLayout` 在 SSR 时输出"正在跳转登录…"、客户端输出布局），不影响后续交互，但首屏会丢弃一次树。本次一并修掉。

## 改动方案

### A. `src/routes/app.project.$id.tsx`

- **`PreviewPane`：本地乐观状态 + 不再 invalidate**
  - 新增 `useState<IntroData>(intro)` / `skus` / `settings` 三份本地镜像，所有 `onChange` 先 `setLocal`，再走 `persist`。
  - `persist` 里 **删掉** `qc.invalidateQueries(['project', id])`。用户编辑不需要重新拉数据（数据库就是用户刚发出去的）。AI 工具调用结束的 `onFinish` / `onToolCall` 已经会 invalidate，那条路径保留。
  - 当 `project.intro/skus/settings` 因 AI 写入而变化时（通过比较 `JSON.stringify` 或一个 `aiVersionRef`），把外部值同步进本地 state；普通保存回包不再触发同步（因为不 invalidate）。

- **拆分 ChatPane / PreviewPane 不再共享父级 re-render**
  - 让 `ProjectEditor` 只持有 `project` 引用并通过 props 传下去；用 `React.memo` 包裹 `ChatPane` 和 `PreviewPane`，比较函数只看真正用到的字段（`projectId` + 对应 slice）。
  - `MessageRow`、`ToolCard`、`Questionnaire` 加 `React.memo`，`key` 维持现状。

- **`AppLayout` SSR 水合不一致**
  - 在 `src/routes/app.tsx` 里，把"未登录就显示跳转文案"的分支改成对 `useHydrated()` 为 `false` 时输出与已登录布局**同样的外壳**（带 `TopBar` 占位），避免 SSR ↔ CSR 输出不同 className。

### B. `src/components/tuan/primitives.tsx` 和 `IntroTab.tsx`

- **`InlineText` / `AutoTextarea`：防止反向覆盖**
  - 用 `isFocusedRef` 守门：聚焦时不执行 `setLocal(value)` 同步，只在 blur 后再对齐外部值。
  - 失焦时如果还有 pending debounce，立即 flush 一次，避免丢字。
  - 这一改动让保存延迟降到 0ms 也不会打断输入，可把 debounce 从 500ms 降到 250ms。

- **重子树 memo**
  - `BlockCard` 用 `React.memo`，回调用 `useCallback` 在父组件里稳定下来（或采用「传 id，回调从 ref 拿最新 setBlocks」的模式避免 props 引用变化）。
  - 拖拽时把 `dragId` 从 `IntroTab` 提到 `useRef`，配合一个 `forceUpdate`，避免拖动过程整列重渲染。

### C. 验证

- 打字时观察 React DevTools / Performance：单次输入只重渲染输入框组件，`BlockCard` 不参与。
- 网络面板：连续敲 10 个字符只触发 1～2 次 `updateProject`，不再触发 `getProject`。
- 首屏不再报 hydration mismatch；`/app/project/:id` 进入后立即可交互。

## 不动的部分

- 数据库 schema、`projects.functions.ts`、AI chat 路由（`/api/chat`）、Phone Shell 的样式、`ProductTab` / `SettingsTab` 的现有结构都保持不变，仅在必要处补 memo。
- 不引入新的依赖。

## 受影响文件

- `src/routes/app.project.$id.tsx`（`ProjectEditor` / `ChatPane` / `PreviewPane` / `MessageRow` / `ToolCard`）
- `src/routes/app.tsx`（SSR 水合外壳）
- `src/components/tuan/primitives.tsx`（`InlineText` 聚焦守门）
- `src/components/tuan/IntroTab.tsx`（`AutoTextarea` 聚焦守门 + `BlockCard` memo）
