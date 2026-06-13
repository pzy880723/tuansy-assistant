
# 手机收料 → 电脑出稿 实施方案

按你的选择落地：**先做 H5 验证流程**，团长用**手机号登录**（复用现有腾讯短信），素材到达后**智能推荐项目 + 可手动改**，电脑端**对话框弹消息 + 项目列表红点提醒**。

## 一、整体流程

```text
供应商在微信群发图/文/链接
      ↓ 团长长按 → 复制 / 保存图片
      ↓ 打开手机浏览器里的「团宝收料台」（H5，已加桌面图标）
      ↓ 粘贴文字 / 选图片 / 贴链接 → 选项目（默认推荐最近编辑的）
      ↓ 点「丢给团宝」
      ↓
后端 inbox 接收 → 存储 + 关联项目
      ↓
团宝 Agent 自动触发：分析素材 → 生成介绍草稿
      ↓
电脑端 实时（Realtime）：
   · 左侧项目列表对应项目出现红点
   · 进入项目后，对话框自动弹出团宝消息：
     "刚收到你手机发来的 3 张图 + 一段供应商描述，正在分析…"
     "✍️ 已生成新版介绍，右侧预览已更新"
```

## 二、手机端 H5（`/m/inbox`）

新增一个**移动端专用路由**，不复用电脑端布局：

- **登录**：复用现有手机号 + 短信验证码（`app_sessions` / `app_users`）。首次进入引导"添加到主屏幕"。
- **三个 Tab**：图片 / 文字 / 链接
  - 图片：调用系统相册多选（`<input type=file accept="image/*" multiple>`），本地预览，可删
  - 文字：大文本框，自动识别粘贴
  - 链接：单行输入 + 自动抓取标题（能抓的抓，抓不到留空）
- **目标项目选择器**：
  - 顶部默认显示「最近编辑：XXX 团」+ 一个下拉
  - 下拉里：最近 10 个项目 + "新建项目"
- **提交按钮**：「丢给团宝 →」，提交后显示「团宝已收到，去电脑看看吧 ☕」

## 三、后端

### 数据表（新增 `inbox_items`）

```text
inbox_items
  id, user_id, project_id (nullable, 新建时先空)
  kind: 'image' | 'text' | 'link'
  payload: jsonb  // 图片url列表 / 文本内容 / 链接url+抓取的标题
  status: 'pending' | 'processing' | 'consumed' | 'failed'
  created_at, processed_at
```

实时订阅 `inbox_items` 和 `projects.updated_at`，电脑端据此点红点。

### Server Functions
- `createInboxItem`（手机端调用）：写入 `inbox_items`，图片走现有 `product-images` bucket
- `consumeInboxForProject`（电脑端进入项目时自动调用 + 触发器）：拉取该项目所有 `pending`，喂给现有 Agent 生成新版介绍，状态置 `consumed`

### 智能推荐项目
手机端选择器默认值 = 用户最近 30 分钟内编辑过的项目；没有则显示「新建项目」。

## 四、电脑端

### 项目列表红点
左侧项目列表订阅 `inbox_items where status=pending`，按 project_id 聚合显示红点 + 数量徽章。

### 对话框自动消息
进入项目时，如有 pending 素材：
1. 团宝先发一条："📥 收到你刚从手机发来的 N 张图 / 一段文字，正在分析…"
2. 调用 Agent 生成 → 写入 copy_versions
3. 团宝再发："✍️ 已生成《XX 介绍》新版本，右侧预览已更新，看看要不要调整？"

复用现有"正在分析需求 / 正在生成文字描述"那套自然语言进度提示。

## 五、技术要点

- **路由**：`src/routes/m/inbox.tsx`（移动端 H5），`src/routes/api/inbox.upload.ts`（图片上传 server route）
- **Server fns**：`src/lib/inbox.functions.ts`（createInboxItem, listMyRecentProjects, consumeInboxForProject）
- **Realtime**：电脑端 `useEffect` 订阅 `inbox_items` 表变更
- **不做的事**：本期不接微信公众号 / 企业微信 / 小程序；不做链接深度抓取（淘宝/拼多多反爬复杂，先抓 og:title/og:image 能抓就抓）；不做小程序卡片解析

## 六、上线后第二阶段（不在本次范围）

H5 跑通 + Agent 出稿质量验证后，再把同样的 `/api/inbox` 后端接到微信小程序「分享菜单」入口，团长体验从"打开 H5"升级到"群里长按直接分享"。

---

**实施顺序（建议分两次提交，方便你边用边反馈）**：
1. 先做后端表 + 手机 H5 收料 + 电脑端红点提醒（不接 Agent，先验收料链路）
2. 再接 Agent 自动出稿 + 对话框自然语言播报
