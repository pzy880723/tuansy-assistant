# 团购浏览页改成快团团编辑器同款布局

## 目标

`/g/$slug` 当前是「顶部大封面 → 价格/标题 → 正文 → 底部下单」的电商首页风格。要改成与编辑器一致：标题在最上面，下面是图文正文，最后才是商品（SKU）。

## 改动文件

`src/routes/g.$slug.tsx`

## 新版结构（自上而下）

1. **标题区**（白底，居中容器最大宽 `max-w-md`，移除原顶部全宽封面）
   - `H1` 团标题
   - 起步价 `¥xx 起` + 已售 N
   - `intro.description` 简介一行（若有）

2. **正文区** — 复用 `BlockView` 渲染 `intro.blocks`（文本 / 大图 / 九宫格小图 / 视频），保持与编辑器 IntroTab 一致的视觉顺序。这是页面主体。

3. **商品区**（标题"商品规格"）— 把 `snapshot_skus` 以卡片列表形式列出：
   - 每个 SKU 一张卡：缩略图（`sku.image` 或 `sku.images?.[0]`，无则灰底占位）、名称、描述、价格（有 variants 时显示 `¥min–¥max`，否则单价）、库存。
   - 有 variants 时下方展示规格 chips（只读预览，不在此选购，下单还在弹窗里选）。

4. **底部固定 CTA** — 保留现有"立即下单"按钮和 `OrderSheet` 弹窗逻辑，不动下单流程。

## 细节

- 删除最上方 `aspect-square` 封面块；仍保留 `cover_image_url` 给 `<head>` 的 `og:image`。
- 背景灰、内容卡片白底，圆角分组：标题卡、正文卡、商品卡三段，之间留 8px 间隔，符合快团团式分段视觉。
- `BlockView` 组件不变。
- 不改 loader、不改下单 API、不改 OrderSheet 内部表单。

## 不改动

- 服务端字段、`group_orders` 表、`snapshot_intro/snapshot_skus` 结构。
- 编辑器、其它路由、AI 助手、左侧栏。
