## 团宝速购侧栏与 AI 助手修复 + 体验优化

### 一、Bug 根因（必须修）

AI 助手收不到回复是因为 `/api/quickbuy-chat` 返回 **401 未授权**（preview 日志多次出现 `POST /api/quickbuy-chat → 401`）。

原因：Lovable 预览页跑在 iframe 内属于「跨站上下文」，`SameSite=Lax` 的 `tuan_uid` cookie 不会被发出。项目其他 fetch 调用都通过 `x-tuan-session` header 兜底（见 `src/start.ts`、`src/routes/app.project.$id.tsx#244`、`AIGenerateImageDialog.tsx#111`），但我新写的 `AssistantPanel` 里 `DefaultChatTransport({ api: "/api/quickbuy-chat" })` 没附带这个 header。

修复：

```ts
import { readAuthToken } from "@/lib/use-current-user";

const transport = new DefaultChatTransport({
  api: "/api/quickbuy-chat",
  headers: () => {
    const t = readAuthToken();
    return t ? { "x-tuan-session": t } : {};
  },
});
```

（headers 用函数形式，确保每次请求都读最新 token）

### 二、侧栏改动

**1. 去掉「完全隐藏」状态**

- `SidebarSize` 类型从 `"expanded" | "icon" | "hidden"` 改为 `"expanded" | "icon"`
- 顶栏左侧那颗 `PanelLeftClose / PanelLeftOpen` 按钮 → 删除
- localStorage key `quickbuy.sidebar.size` 旧值 `"hidden"` 兼容性处理：读到 `"hidden"` 时回退到 `"expanded"`

**2. 侧栏可左右拖拽改宽**

在侧栏右边缘加一根 4px 宽的拖拽条（hover 时高亮）：
- 仅在 `expanded` 状态生效（icon 状态固定 56px）
- 宽度范围 240–520px，写入 `localStorage` 键 `quickbuy.sidebar.width`
- 拖拽时给 `<body>` 加 `cursor: col-resize` + `user-select: none`，结束清除
- 用 inline style 控制宽度（`style={{ width }}`），避免 Tailwind 任意值类带来的 JIT 问题
- 拖拽到 < 200px 时自动 snap 回 240px（防止用户拖没）

```tsx
// 简化逻辑
<aside style={{ width: size === "icon" ? 56 : width }} className="relative ...">
  {/* 内容 */}
  {size === "expanded" && (
    <div
      onPointerDown={startDrag}
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-emerald-400/40"
    />
  )}
</aside>
```

### 三、AssistantPanel 预设点击 → 自动发送

当前：点击预设词 → 填入输入框 → 用户还要按发送  
改为：点击预设词 → 直接 `sendMessage({ text })`，不经过输入框

涉及两处：欢迎页的 3 个示例按钮、底部的 4 个快捷 chip。两处都改为：

```tsx
const quickSend = (text: string) => {
  if (status === "submitted" || status === "streaming") return;
  sendMessage({ text });
};
```

（输入框仍保留，用户也可自己输入复杂语句）

### 四、文件改动

- **修改** `src/components/quickbuy/AssistantPanel.tsx`
  - transport 加 `x-tuan-session` header（修 401）
  - 预设/示例改为一键发送
- **修改** `src/routes/quickbuy.tsx`
  - 删除 hidden 状态、顶栏的隐藏按钮、相关 useEffect 分支
  - `Sidebar` 增加拖拽条 + 宽度 state + localStorage
  - 把 `width` 类换成 inline style
- 不动：`src/routes/api/quickbuy-chat.ts`、聊天工具逻辑、`/quickbuy/assistant` 路由

### 五、不在本次范围

- 移动端拖拽（移动端侧栏暂时仍 hidden md:flex 不显示）
- 聊天历史持久化
- 限制宽度的最大值随窗口动态收紧（先用固定 520px 上限）
