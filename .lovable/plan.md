## 目标

Chrome MV3 插件，从团宝项目拉数据，一键填入快团团 PC 后台「新建普通团购」页（`ktt.pinduoduo.com/groups/create`），覆盖：
- 团购介绍：活动标题 + 活动内容（按 `intro.blocks` 顺序插入文字/大图/小图/视频/标签）
- 团购设置：团购时间、物流方式、隐私设置、背景图等可填字段
- 团购商品：v1 仅自动打开「创建商品」面板并填基础字段（标题/价格/库存），SKU 多规格 v1.1 再做

触发方式：① 点插件图标弹 popup；② 在 KTT 后台页面右下角注入「团宝填入」橙色悬浮按钮。

## 架构

```
[团宝]                                    [Chrome 扩展]                       [ktt.pinduoduo.com]
项目页「发送到快团团」                    popup: 粘贴链接 → 拉取 → 填入        content.js: 表单 + 块编辑器 + 图片
  │                                          │                                        ▲
  ▼                                          ▼                                        │
serverFn createExportToken ──► token        background.js fetch payload ──────────────┘
  │                                          │ (绕过 CORS)
  ▼                                          ▼
/api/public/export-project (CORS *)        chrome.storage.local 缓存
返回 { product, intro, skus, settings, images[] }
```

## 1. 团宝侧

### 1.1 数据库迁移：`export_tokens`

| 列 | 类型 |
|---|---|
| token | text PK (24 字节 base64url) |
| user_id | uuid → auth.users (CASCADE) |
| project_id | uuid → projects (CASCADE) |
| expires_at | timestamptz default now()+interval '30 min' |
| created_at | timestamptz default now() |

RLS：仅本人可 SELECT/INSERT/DELETE 自己的 token；service_role 全权。配齐 GRANT。

### 1.2 server fns

`src/lib/export-project.functions.ts`
- `createExportToken({ projectId })` — `requireSupabaseAuth`，校验项目归属，写 token 返回字符串
- 也提供 `revokeExportToken({ token })` 给「失效」按钮用

### 1.3 公共 HTTP 路由

`src/routes/api/public/export-project.ts`
- GET，query `?token=...`
- `OPTIONS` 处理 CORS 预检
- 响应头：`Access-Control-Allow-Origin: *`、`Access-Control-Allow-Headers: content-type`
- 用 `supabaseAdmin`（handler 内 `await import`）校验 token 未过期、按 project_id 拉 `projects + project_images`
- 返回扁平 JSON：

```ts
{
  project: { id, name, category },
  intro: {
    title: string,
    subtitle?: string,
    blocks: Array<
      | { type: "text", text: string }
      | { type: "image_lg", url: string }
      | { type: "image_sm", urls: string[] }
      | { type: "video", url: string, cover?: string }
      | { type: "tag", text: string }
    >
  },
  product: {...},
  skus: [{ name, price, stock, image? }],
  settings: {
    delivery: "express" | "local" | "self_pickup",
    startAt: ISO, endAt: ISO,
    notifyAll: boolean,
    background?: { url },
    ...
  },
  images: { cover?: string, banner?: string }  // 兜底用
}
```

### 1.4 项目页 UI

`src/routes/app.project.$id.tsx` 顶栏添加「发送到快团团」按钮 → `ExportToKttDialog`：
- 显示「导出链接」`https://tuansy-assistant.lovable.app/api/public/export-project?token=XXX`
- 两个按钮：「复制链接」「复制 token」
- 说明：30 分钟有效；插件里粘贴即可

新建组件 `src/components/tuan/ExportToKttDialog.tsx`。

### 1.5 下载页

`src/routes/extension.tsx`（如未存在则新建）：
- 插件说明
- 「下载插件 zip」按钮（fetch→blob→download）
- 安装步骤：解压 → `chrome://extensions` → 开启开发者模式 → 加载已解压扩展程序
- 使用步骤：在团宝复制链接 → 打开 KTT 新建团购页 → 点插件图标 → 粘贴 → 填入

## 2. Chrome 扩展

目录：`/dev-server/extension/`
```
manifest.json
popup.html  popup.js  popup.css
content.js                    # 注入 KTT 页面
inject.css                    # 悬浮按钮 + 进度浮层样式
background.js                 # fetch 代理（图片 + 导出 API）
selectors.js                  # 字段→选择器映射
fillers.js                    # 复用工具：React 受控输入、文件 dispatch、块插入
icon-48.png  icon-128.png
README.md                     # 故障排查
```

### 2.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "团宝 · 快团团自动填入",
  "version": "0.1.0",
  "description": "一键把团宝里的团购内容填入快团团后台",
  "permissions": ["storage", "activeTab", "scripting", "clipboardWrite"],
  "host_permissions": [
    "https://ktt.pinduoduo.com/*",
    "https://*.kuaituantuan.com/*",
    "https://tuansy-assistant.lovable.app/*",
    "https://project--*.lovable.app/*"
  ],
  "action": { "default_popup": "popup.html", "default_icon": "icon-48.png" },
  "icons": { "48": "icon-48.png", "128": "icon-128.png" },
  "content_scripts": [{
    "matches": ["https://ktt.pinduoduo.com/*", "https://*.kuaituantuan.com/*"],
    "js": ["fillers.js", "selectors.js", "content.js"],
    "css": ["inject.css"],
    "run_at": "document_idle"
  }],
  "background": { "service_worker": "background.js" }
}
```

### 2.2 popup（点插件图标）

最小版：
- 输入框：粘贴导出链接或 token
- 「拉取」按钮 → 调 `background.js` fetch → 显示项目名 + 各分组勾选框（介绍/设置/商品/图片）
- 「填入当前页」按钮 → `chrome.tabs.query → sendMessage({ type: "fill", payload, sections })`
- 「保存为最近一次」开关 → 写 `chrome.storage.local`
- 错误提示区

### 2.3 悬浮按钮

`content.js` 在 `document_idle` 注入右下角橙色圆球（`#fb923c`，团宝色）：
- 仅在 `/groups/create`、`/groups/edit/*` 路径出现
- 点击展开小卡：显示缓存项目名 + 「快速填入」「换一个」「调试」按钮
- 「调试」：高亮当前匹配到的选择器，方便用户截图反馈

### 2.4 字段映射 `selectors.js`

按截图能识别的结构猜一版，外加文本兜底（`xpath` 找含特定文字的元素）：

```js
const KTT = {
  page: {
    isCreate: () => /\/groups\/create/.test(location.pathname),
    isEdit:   () => /\/groups\/edit/.test(location.pathname),
  },
  tabs: { intro: '团购介绍', product: '团购商品', settings: '团购设置' },
  intro: {
    title:      'input[placeholder*="活动标题"]',
    contentRoot:'[class*="content-list"]',     // 占位，需用户首次"调试"实测
    addMenuToolbar: () => findByText('button,span', '大图'),  // 底部那排 大图/小图/视频/文字...
    addBigImage: () => findByText('button,span', '大图'),
    addText:     () => findByText('button,span', '文字'),
    textInputInBlock: '.ql-editor, textarea, [contenteditable=true]',
  },
  settings: {
    deliveryExpress:   () => findByText('label,span', '快递'),
    deliveryLocal:     () => findByText('label,span', '同城配送'),
    deliveryPickup:    () => findByText('label,span', '团客自提'),
    timeRange:         'input[placeholder*="开始时间"], input[readonly][placeholder*="结束"]',
    bgUploadInput:     'input[type=file][accept*=image]',  // 设置背景区
  },
  product: {
    createBtn:  () => findByText('button', '创建商品'),
    titleInput: 'input[placeholder*="商品名称"]',
    priceInput: 'input[placeholder*="价格"]',
    stockInput: 'input[placeholder*="库存"]',
    saveBtn:    () => findByText('button', '保存'),
  },
};
```

> v1 选择器靠"占位 + 文本兜底"双保险；正式准确版需用户首次填入后用「调试」按钮发回 console 日志，下个版本固化。

### 2.5 填表核心 `fillers.js`

通用工具（注入页面 window 上下文，绕过 React/Vue 受控）：

```js
// React/Vue 受控 input
function setNativeValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// 文本兜底定位
function findByText(selector, text) {
  return [...document.querySelectorAll(selector)].find(el => el.textContent.trim() === text);
}

// 文件喂给 <input type=file>
async function dispatchFile(input, url, filename) {
  const blob = await chrome.runtime.sendMessage({ type: 'fetchImage', url }).then(({ buffer, mime }) =>
    new Blob([new Uint8Array(buffer)], { type: mime })
  );
  const file = new File([blob], filename, { type: blob.type });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// 等待选择器出现（块编辑器是异步插入的）
async function waitFor(sel, timeout = 5000) { /* polling */ }
```

填入主流程 `content.js`：
1. 切到「团购介绍」tab → 填标题
2. 遍历 `intro.blocks`：
   - text 块：点「文字」按钮 → `waitFor(textInputInBlock)` → `setNativeValue` 内容
   - image_lg：点「大图」→ `waitFor(file input)` → `dispatchFile`
   - image_sm：点「小图」→ 对每张图 dispatchFile
   - video：点「视频」→ dispatchFile（mp4 直链）
   - tag：点「标签」→ 填文字
3. 切到「团购设置」tab → 物流单选 click → 时间 range pick（直接 setNativeValue 两个 input）→ 背景图 dispatchFile
4. 切到「团购商品」tab → 点「创建商品」→ 在弹层里填标题/价格/库存（v1 单价单 SKU）→ 不自动点保存，留给用户确认
5. 全程顶部 toast 进度条；失败的图片把 URL 复制到剪贴板提示

### 2.6 background.js

仅做两件事：
- `fetchImage(url)` → 返回 `{ buffer, mime }`（绕过 CORS）
- `fetchPayload(url)` → GET 导出 API，返回 JSON

```js
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'fetchImage') {
    fetch(msg.url).then(r => Promise.all([r.arrayBuffer(), r.headers.get('content-type')]))
      .then(([buf, mime]) => sendResponse({ buffer: [...new Uint8Array(buf)], mime: mime || 'image/jpeg' }))
      .catch(e => sendResponse({ error: e.message }));
    return true; // async
  }
  if (msg.type === 'fetchPayload') {
    fetch(msg.url).then(r => r.json()).then(j => sendResponse({ data: j }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }
});
```

### 2.7 打包

`bunfig.toml` 无关；exec 命令：
```bash
nix run nixpkgs#zip -- -j /dev-server/public/tuanbao-ktt-ext.zip \
  /dev-server/extension/manifest.json /dev-server/extension/*.js \
  /dev-server/extension/*.html /dev-server/extension/*.css \
  /dev-server/extension/*.png
```

放在 `public/` 便于 `/extension` 页面 fetch+blob 下载。

## 3. 安全

- token 30 分钟过期，绑定 `project_id + user_id`，timing-safe 比较
- 公共 API 仅返回该项目数据，绝不返回 user_id、其他项目或 auth 字段
- 插件不上传 token 到任何第三方，只 fetch 团宝域名
- 「调试」按钮打印的内容只在用户主动点击时出现

## 4. v1 已知限制（写到 README 与 `/extension` 页）

- 选择器随 KTT 改版会失效；首发版本依赖文本兜底（"大图""文字"按钮文案），失效时可视化提示
- 多规格 SKU 暂未自动填，单 SKU 价格库存自动填
- 商品创建弹窗里的「图片上传」由 KTT 自家组件接管，若是自定义 dropzone 而非 input[type=file]，v1.1 再适配
- 用户须先在浏览器登录快团团；插件不接管登录态
- 仅适配 Chrome / Chromium（Edge/Arc/Brave 兼容）

## 5. 验收

1. 团宝项目页点「发送到快团团」→ 弹窗有可复制链接
2. 装好插件后在 `ktt.pinduoduo.com/groups/create` 页面：
   - popup 粘贴链接 → 拉取成功 → 显示项目名 + 字段勾选
   - 点「填入当前页」→ 标题、活动内容按 blocks 顺序插入、团购设置物流/时间/背景填好
3. 同一页面右下角橙色悬浮按钮点击 → 用缓存数据快速填入
4. 任一步失败：橙色 toast 提示哪一步、把失败的图片 URL 一键复制到剪贴板，KTT 页面继续可用
5. `/extension` 页面能下载 zip，README 里有完整安装步骤

## 6. 不在 v1 范围

- 反向把 KTT 已发布团购抓回团宝
- 自动点「发布」按钮（v1 始终停在用户预览状态，避免误发）
- 帮卖/优惠/隐私的复杂字段（v1 只填核心几项）
- 多规格 SKU 自动循环填入
- 移动端 / 小程序

## 7. 文件清单

新增：
- `supabase/migrations/<ts>_export_tokens.sql`
- `src/lib/export-project.functions.ts`
- `src/routes/api/public/export-project.ts`
- `src/routes/extension.tsx`
- `src/components/tuan/ExportToKttDialog.tsx`
- `/dev-server/extension/`（整套插件文件）
- `/dev-server/public/tuanbao-ktt-ext.zip`

改动：
- `src/routes/app.project.$id.tsx`：顶栏加「发送到快团团」按钮

## 8. 实施顺序

1. 迁移 + serverFn + 公共路由（先打通数据出口）
2. 项目页 ExportToKttDialog
3. 扩展骨架（manifest + popup + 拉取数据展示）
4. content.js 填团购介绍标题与文字块（最低可用）
5. 介绍区图片块
6. 团购设置区
7. 商品创建弹窗基础字段
8. 悬浮按钮 + 调试模式
9. 打包脚本 + `/extension` 下载页

每一步完工后我会停下来让你在真机 KTT 后台试一次，根据实际 DOM 调选择器，避免一口气写完全靠猜。

确认按这个推进吗？
