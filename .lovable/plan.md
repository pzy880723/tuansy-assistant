
## 核心原则

**桌面端 ≥768px 一行代码逻辑都不动**，所有改动用 `useIsMobile()` 或 `md:` 断点门控。手机端走独立分支渲染，互不污染。

## 范围

纯前端展示层。手机端从首页、登录、应用顶栏、编辑器全链路适配。后端 / serverFn / AI / 插件 / 数据模型 0 改动。

## 改动清单

### 1. `src/routes/app.project.$id.tsx` 编辑器（手机端单独分支）
```
if (isMobile) return <MobileProjectEditor .../>
return <现有桌面 ResizablePanelGroup 实现/>   // 原封不动
```
- 新建 `MobileProjectEditor` 组件（同文件内或拆 `MobileProjectEditor.tsx`）：
  - 顶部窄 Tab：`对话` / `预览`，默认 `对话`。
  - 主体一个横向 snap 容器：`flex w-[200vw] snap-x snap-mandatory overflow-x-auto`，两屏各 `w-screen snap-start`。
  - 左屏 = `<ChatPane />`（复用），右屏 = `<PreviewPane />`（复用，外层去掉桌面 padding，PhoneShell **撑满整个手机屏宽**，因为它本身就是手机预览壳，PC 上才需要居中留白）。
  - Tab ↔ 滑动位置双向同步（点 Tab 用 `scrollTo`，滑完用 `scroll` 事件回写）。
  - 顶栏右侧保留 历史 / 设置 图标按钮。
- ChatPane 内部不动 ✅。PreviewPane 内部不动 ✅；只在外层包装上做手机 vs 桌面差异。

### 2. ChatPane 输入区手机适配（仅手机分支生效）
- 输入框 `text-base`（16px，避免 iOS 自动放大）。
- 底部 `sticky bottom-0 pb-[env(safe-area-inset-bottom)]`。
- 发送按钮窄屏只显图标；图片/计划开关行可横向滚动。
- 全部用 `md:` 前缀让桌面样式保持原样。

### 3. `src/routes/app.tsx` 应用顶栏
- 桌面布局完全保留；只新增 `md:hidden` 的精简移动顶栏（logo 缩写 + 用户菜单），桌面 `hidden md:flex` 包住原内容。

### 4. `src/components/tuan/primitives.tsx` SettingSheet
- 桌面保持现状；手机端通过 `md:` 切换成底部 sheet（`side="bottom"` + 滑动指示条）。

### 5. `src/routes/auth.tsx` 登录页
- 容器响应式：`max-w-md mx-auto px-4`；输入框/按钮在手机 `h-12`；社交按钮纵向排列。
- 桌面卡片样式不变（仅在 md+ 应用现有阴影/宽度）。

### 6. `src/routes/index.tsx` 首页
- 现有桌面布局保留；只为手机端调一遍：Hero 字号、按钮全宽、菜单收成抽屉/汉堡（如有），保证 375 宽不横向溢出。
- 不改设计风格、配色、文案。

## 不动 / 不碰

- 桌面 ≥768 的所有现有样式、ResizablePanelGroup、PhoneShell 内部、AI 对话逻辑、收料台数据流、SyncToKtt、后端、RLS。
- `src/integrations/*`、`routeTree.gen.ts`。

## 验收

- iPhone 12 (390×844) `/app/project/:id`：默认对话 Tab；左滑切到预览，PhoneShell 占满屏宽；右滑回对话；Tab 高亮与滑动同步。
- iPhone 打开首页 / `/auth`：无横向滚动，按钮可点，键盘不挡输入。
- 桌面 (≥768) 打开同样三个页面：与现在 **像素级一致**。

## 待确认（可一句话回我）

1. 首页 / 登录页是否允许我**轻度调样式**让它在手机更协调（仅手机分支生效，桌面像素级不动）？还是只做"不溢出 + 能点"的最低限度适配？
