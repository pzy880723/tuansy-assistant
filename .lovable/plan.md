## 目标

把项目里所有旧的「橙色渐变方块 + 团字」占位 logo，全部换成你新上传的团宝助手 logo 素材。

## 素材分工

四张图分别对应不同场景，全部走 Lovable Assets（CDN），原图不入仓：

| 素材 | 用途 |
| --- | --- |
| image-43.png（横版：吉祥物 + 团宝助手字样，白底） | 顶栏 / 登录页 / 首页 header / footer 主 logo |
| image-47.png（纯吉祥物，白底透明感） | 小尺寸方形头像位（移动端 inbox 头像、project starter 头像、聊天气泡头像，替换现有 tuanbao-avatar） |
| image-46.png（App 图标，圆角橙底） | favicon、Chrome 插件 icon128、`/extension` 下载页主视觉 |
| image-45.png（深色底版本） | 暂不使用，先上传备用（深色模式/海报场景） |

## 改动

### 1. 上传四张图到 Lovable Assets
- `src/assets/logo-horizontal.png.asset.json`（image-43）
- `src/assets/logo-mascot.png.asset.json`（image-47）—— 同时替换掉旧的 `tuanbao-avatar.png.asset.json`，并删除旧 asset pointer
- `src/assets/logo-app-icon.png.asset.json`（image-46）
- `src/assets/logo-dark.png.asset.json`（image-45，备用）

### 2. 顶栏（`src/routes/app.tsx`）
把 `<span class="grid ... 团">` + 「团宝助手」文字整体换成横版 logo `<img>`（高度约 24-28px，保持原点击跳首页）。

### 3. 首页（`src/routes/index.tsx`）
- header 左上 logo（行 43-46）：换成横版 logo（高度约 28px），去掉旁边的「团宝助手」文字（图里已含）。
- 行 122 / 235 的两个装饰性渐变方块（hero 区演示卡 + feature icon）：保留渐变不动（它们不是 logo，是装饰图标），**不替换**。
- footer 文案不动。

### 4. 登录页（`src/routes/auth.tsx` 行 56-60）
换成横版 logo，去掉 "团宝助手" 文字。

### 5. `/extension` 下载页（`src/routes/extension.tsx` 行 40）
把橙色渐变圆角 + Chrome 图标换成 App 图标 `logo-app-icon`（h-16 w-16，圆角 2xl 直接显示原图）。

### 6. 移动端 inbox（`src/routes/m.inbox.tsx` 行 79）
小方块换成吉祥物头像 `logo-mascot`。

### 7. tuanbao-avatar 全量替换
- `src/routes/app.project.$id.tsx`、`src/components/project-starter.tsx`、`src/components/tuan/PhoneShell.tsx`、`src/lib/projects.functions.ts` 等所有 import `tuanbao-avatar.png.asset.json` 的位置，改成 import 新的 `logo-mascot.png.asset.json`。
- 删除旧的 `src/assets/tuanbao-avatar.png.asset.json`（通过 assets--delete_asset）。

### 8. Favicon
在 `src/routes/__root.tsx` 的 `head().links` 加 `{ rel: "icon", href: <app-icon url>, type: "image/png" }`。

### 9. Chrome 插件图标
- 用 image-46 重新生成 `extension/icons/icon128.png`（覆盖原文件，128×128，缩放保存）。
- 重新打包 `public/ktt-filler.zip`。

## 不动的东西

- 业务逻辑（同步、AI、SKU 编辑等）一律不碰。
- 首页 hero 区那些非 logo 的橙色渐变装饰图标保留。
- 配色系 `--brand-*` token 不改。
- 深色版 logo 暂上传不引用。

## 验收

- 顶栏 / 首页 / 登录 / inbox / extension 页 logo 视觉统一。
- 浏览器 tab 出现新 favicon。
- 项目编辑页里 AI 助手头像变成新吉祥物。
- 旧 `tuanbao-avatar` asset 不再被引用。
