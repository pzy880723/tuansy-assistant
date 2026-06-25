## 诊断

「同步到快团团」点击后弹出"先安装 Chrome 插件"对话框 = 当前页面没检测到插件的 `bridge.js` 注入。你之前装的是**旧版**插件，旧版的 `manifest.json` 里 `host_permissions` / `content_scripts.matches` 大概率没覆盖你现在用的预览域名：

- 当前预览 URL: `dddce179-...lovableproject.com`
- 最新 `extension/manifest.json` v0.3.0 已经把 `*.lovable.app`、`*.lovableproject.com`、`*.lovable.dev` 都加进去了
- 旧版（你之前装的那个）可能只匹配 `*.lovable.app`，所以在 `lovableproject.com` 上 `bridge.js` 不会注入 → 页面探测不到 → 弹安装对话框

另外 `public/ktt-filler.zip` 是 6/25 打的包，需要重新构建确保跟当前 `extension/` 源码一致。

## 计划

### 1. 重新打包最新 zip
- 用 `nix run nixpkgs#zip` 把 `extension/` 目录重新压成 `public/ktt-filler.zip`
- 覆盖旧的 zip 文件，确保下载下来的是 v0.3.0

### 2. 更新 `/extension` 页面文案
- 在「安装步骤」上方加一段醒目提示：**如果之前装过旧版，请先在 `chrome://extensions` 里移除老的「团宝快团团助手」，再加载新解压的文件夹**（旧版不支持当前预览域名）
- 在「使用方法」里强调：安装/更新后必须刷新当前团宝页面，否则 `bridge.js` 不会注入到已打开的标签页

### 3. 不改其它逻辑
- 按钮、bridge、background、content 当前实现是对的，先不动
- 等你装上新版刷新后再次复现，如果还有问题（比如快团团页面能打开但表单没填进去），那是 `selectors.js` 选择器对不上快团团最新 DOM 的问题，再单独修

## 你需要做的事

1. 我重新打完包后，去 `/extension` 页点「下载插件 zip」拿新版
2. 打开 `chrome://extensions`，**先把旧的「团宝快团团助手」移除**
3. 解压新 zip，点「加载已解压的扩展程序」选解压后的文件夹
4. **回到当前团宝项目页刷新一次**（关键，否则 bridge 不会注入）
5. 再点「同步到快团团」

如果第 5 步还是失败，把控制台的报错截给我，多半就是快团团 DOM 改版需要更新 `selectors.js` 了。
