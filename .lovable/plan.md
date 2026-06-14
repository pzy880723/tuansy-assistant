## 目标

合并两个按钮，把"同步到快团团"做成真正的一键操作：检测插件 → 自动打开快团团 → 自动填入，全程用户只点一下。

## 改动总览

### 1. 删掉冗余按钮
- 删除 `ExportToKttDialog`（即"发送到快团团"按钮和对应弹窗）。
- 项目页 `src/routes/app.project.$id.tsx` 不再渲染 `ExportToKttDialog`。
- 顶栏 `src/routes/app.tsx` 那个 `toast.info(...)` 占位的"同步到快团团"按钮升级成主入口。

### 2. 新建 `SyncToKttButton`（替代原按钮）
位置同顶栏，文案保持"同步到快团团"。点击逻辑：

1. **探测插件**：向 `window` 发 `postMessage({ type: "TB_PING" })`，等 600ms 拿 `TB_PONG`。
2. **未安装** → 弹出一个极简 Dialog（只有一段话 + "下载插件"按钮跳 `/extension`，再 + "我已安装，重试"按钮）。
3. **已安装** → 生成 token（调用现有 `createExportToken`）→ 再发 `postMessage({ type: "TB_SYNC", token, origin, projectName })` → 显示 toast "已发送到插件，正在打开快团团…"。
4. 任何步骤报错 → toast 红字提示，不阻塞。

无弹窗、无复制粘贴、无 token 可见。

### 3. 插件侧改造

**`manifest.json`**
- 给 `content_scripts` 增加一条：匹配 `https://*.lovable.app/*`、`https://*.lovableproject.com/*`、自定义域名 `https://tuansy-assistant.lovable.app/*`，只注入一个新的 `bridge.js`（很轻量，不引 fillers/selectors）。
- 这样团宝页面就能和插件通信。

**`extension/bridge.js`（新）**
- `window.postMessage` 监听：
  - `TB_PING` → 回 `TB_PONG`（带版本号）。
  - `TB_SYNC` → `chrome.runtime.sendMessage` 转给 background。
- 同时在 `<html>` 上加个 `data-tb-installed="0.1.0"` 标记，作为兜底探测。

**`extension/background.js`**
- 新增 `type: "syncToKtt"` 处理：
  1. 调用现有 `fetchPayload` 逻辑拉项目数据。
  2. `chrome.storage.local.set({ lastPayload, autoFillPending: true })`。
  3. `chrome.tabs.query` 找已打开的 KTT 创建/编辑标签；找不到则 `chrome.tabs.create({ url: "https://ktt.pinduoduo.com/groups/create" })`。
  4. 标签 ready 后向 content.js 发 `{ type: "fill", payload }`。

**`extension/content.js`**
- 加载时检查 `autoFillPending`，若为 true 则等页面就绪后自动 `fillAll(lastPayload)`，完成清掉 flag，弹个右下角悬浮提示"已自动填入 X 项"。
- 浮窗按钮保留，作为手动重试入口。

### 4. 重新打包插件
- `cd /dev-server/extension && nix run nixpkgs#zip -- -r /dev-server/public/ktt-filler.zip .`
- `/extension` 下载页文案小调：去掉"复制 token / 粘贴到插件"的旧步骤，强调"装好插件后回到团宝点同步即可"。

## 用户感知

- 一次性操作：装插件 → 之后每个项目只点一下"同步到快团团"。
- 第一次没装：点击会出现安装引导，装完回来重试还是一下。
- 不再让用户接触 token、链接、复制粘贴。

## 受影响文件

- 删：`src/components/tuan/ExportToKttDialog.tsx`
- 改：`src/routes/app.project.$id.tsx`（去掉导入和使用）
- 改：`src/routes/app.tsx`（按钮换成新组件）
- 新：`src/components/tuan/SyncToKttButton.tsx`
- 改：`extension/manifest.json`、`extension/background.js`、`extension/content.js`
- 新：`extension/bridge.js`
- 改：`src/routes/extension.tsx`（文案）
- 重建：`public/ktt-filler.zip`

服务端 `createExportToken` / `/api/public/export-project` 保持不变。
