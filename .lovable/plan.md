# 团宝速购 · 内嵌交易模块（第一期）

基于你的选择：**免登录下单（手机号+地址）/ 仅记录已付未付状态 / 仅快递 / 后台四件套全要**。

---

## 一、用户视角的三条入口

### 1) 团长首页（`/app`）— 顶部加一个 Banner
位置：紧贴在「项目卡片网格」上方、招呼语下方（即现在 `<ProjectStarter />` 之下、`<MobileInboxBanner />` 之上的位置）。

```
┌────────────────────────────────────────────────────────────────┐
│ 🛒 团宝速购  开团不用切换工具，团宝助手内嵌的交易页 + 订单后台 │
│ 待处理 N 单 · 进行中 M 团     [我的订单] [我的开团]            │
└────────────────────────────────────────────────────────────────┘
```
- 「我的订单」→ `/app/orders`（团长视角订单总览，跨项目）
- 「我的开团」→ `/app/groups`（所有已开的速购团 + 销量看板）

### 2) 项目工作台顶栏（`/app/project/$id`）— `SyncToKttButton` 左边新增一颗主按钮
顺序最终为：`素材库 N` → **`团宝速购开团 / 已开团 · 进入管理`** → `同步快团团`。

按钮三态：
- **未开团** → 文案「团宝速购开团」，绿色主按钮；点开弹出开团确认 Sheet（确认价格/库存/截团时间/起送条件/收款方式）。
- **进行中** → 文案「已开团 · 进入管理」；点开抽屉显示：销量、订单 N 条、可分享二维码、关团、改价/改库存的跳转。
- **已关团** → 文案「重新开团」。

「同步快团团」按钮保留不变，做为并行通路。

### 3) 文末「立即开团」改名
项目编辑页底部原 CTA → **「团宝速购开团」**，行为=入口 2 的"未开团"路径。

---

## 二、客户视角：H5 速购页

公开路由 `/g/$slug`（slug = 短随机串，避免暴露 projectId 顺序），SSR 友好（OG 卡片 → 标题/封面/低价）。

页面结构：
```
[封面/主图轮播]
[标题 + 价格 + 销量 + 倒计时]
[「立即下单」浮动按钮]
[团购介绍 blocks 渲染 — 复用 IntroTab 的渲染逻辑做只读版]
[商品规格 / SKU 选择 — 单规格直接选数量；多规格用 specGroups+variants 选择]
[下单表单 Modal：手机号 / 收件人 / 省市区 / 详细地址 / 备注]
[提交 → 订单成功页 + 查询入口 + 复制订单号]
```

订单提交：**免登录**。手机号 + 6 位订单查询码（自动生成）→ 客户用 `/g/$slug/o/$code` 自查订单进度。
（即写一个 cookie，下次自动认这个手机号是「我」。）

下单后页面提示：「已下单，团长稍后联系你确认付款方式」。

---

## 三、团长后台：4 个新模块

### A. 我的开团 `/app/groups`
- 卡片网格：每个项目一张卡，显示状态（进行中/已关团/草稿）、销量、订单数、客户数、销售额。
- 卡片操作：分享（链接+二维码+小程序占位）、关团、查看订单、看板。
- 「+ 新开团」直接跳回项目编辑页。

### B. 订单列表 `/app/orders` 与详情 `/app/orders/$id`
- 列表筛选：项目、状态、是否已付、关键字（手机号/收件人/订单号）、时间。
- 状态枚举：`pending`（待处理） → `paid`（已付/已确认） → `shipped`（已发货+物流号） → `completed` → `refunded` / `cancelled`。
- 详情页：客户信息 / SKU / 价格明细 / 状态变更日志 / 备注；操作按钮：标记已付、填运单、完成、退款、撤单。
- 顶部「导出 Excel」：导出筛选结果（订单号、下单时间、手机、收件人、省市区、详细地址、SKU、规格、数量、金额、付款状态、运单号、备注）。

### C. 客户与地址簿 `/app/customers`
- 按手机号去重的客户列表：累计订单数、累计金额、最近订单、收件人和地址（一个手机号可有多个收件地址）。
- 点开 → 客户详情：基本信息 + 历史订单 + 备注（"VIP""退过货"等标签）。

### D. 销量/库存看板 `/app/dashboard`
- 顶部 4 个卡片：今日订单、今日销售额、本周订单、本周销售额。
- 每个团的进度条：已售 / 库存。
- 售罄预警（库存 ≤ 5 标红）。

---

## 四、数据模型（Lovable Cloud 迁移）

### 新表（4 张，全部走 RLS + 团长 owner_id 隔离）

1. **`group_orders`** — 团长开团记录（一个 project 可多次开团）
   - `id, project_id, owner_id, slug(unique), status(draft/active/closed)`
   - `started_at, ends_at(可空), closed_at`
   - `snapshot_intro jsonb, snapshot_skus jsonb`（开团瞬间冻结，后续编辑不影响在售）
   - `share_count, view_count, order_count, gmv_cents`（聚合统计，触发器维护）

2. **`orders`** — 客户订单
   - `id, group_order_id, project_id, owner_id`
   - `order_no(unique, 16 位), query_code(6 位)`（客户自查用）
   - `buyer_phone, buyer_name, address jsonb {province, city, district, detail}`
   - `note, channel(h5/wx)`
   - `status enum(pending/paid/shipped/completed/refunded/cancelled)`
   - `payment_status enum(unpaid/paid/refunded)`（即你说的"已付/未付"字段，二期接通道用）
   - `tracking_no, shipping_carrier`
   - `total_cents, items_count`
   - `created_at, updated_at`

3. **`order_items`**
   - `id, order_id, sku_index(int), sku_name, variant_label, unit_price_cents, qty, subtotal_cents, image_url`

4. **`customers`**（视图或物化表，按 `(owner_id, buyer_phone)` 聚合）
   - 第一期用视图实现；后期需要客户标签/备注时再升为物理表。

### `projects` 表无需改动
开团时把当前 intro/skus 快照写进 `group_orders.snapshot_*`，确保编辑文案不影响在售订单。

### 状态机
```
draft → active ↔ closed
pending → paid → shipped → completed
pending → cancelled
shipped → refunded
```
每次状态变更写一条 `order_status_log`（可选，第一期可省，详情页用 `updated_at` 顶替）。

---

## 五、后端 API（TanStack `createServerFn` + 公开 `/api/public/*`）

### 团长侧（`.functions.ts`，走 `requireSupabaseAuth`）
- `createGroupOrder({ projectId, endsAt?, minOrderQty? })` — 冻结快照、生成 slug、状态 active。
- `closeGroupOrder({ id })`
- `listGroupOrders({ projectId? })`
- `listOrders({ filters, page, pageSize })`
- `getOrder({ id })`
- `updateOrderStatus({ id, action: 'mark_paid' | 'ship' | 'complete' | 'refund' | 'cancel', payload? })`
- `exportOrdersCsv({ filters })` → 返回 CSV 字符串，前端触发下载。
- `listCustomers({ q? })` / `getCustomer({ phone })`
- `dashboardSummary({ projectId? })`

### 客户侧（公开路由 `src/routes/api/public/g/*` + `src/routes/g.$slug.tsx`）
- `GET /g/$slug` — H5 页（SSR，loader 走 `supabaseAdmin` 只投影白名单字段）。
- `POST /api/public/g/$slug/place-order` — 创建订单，**zod 严格校验**手机号格式、地址长度、规格存在性、库存（库存按 `snapshot_skus + 已成单数量` 兜底）。
- `GET /api/public/orders/$orderNo?code=xxx` — 客户自查订单。

**速率限制**：公开下单接口在客户端 cookie 设置 30 秒节流 + 服务端按 `order_no` 唯一性 + 按 `(buyer_phone, group_order_id)` 5 秒去重，避免双击重复下单。

---

## 六、安全 & 合规

- 所有公开接口走 zod 校验（手机号 `^1[3-9]\d{9}$`、地址各字段长度上限）。
- `orders` 表 RLS：客户侧只能用 `order_no + query_code` 反查（走 `supabaseAdmin` 在公开 API 里做，不开 anon 直读）。团长侧 `owner_id = auth.uid()`。
- `group_orders.slug` 16 位随机 base32，避免遍历。
- 客户手机号在团长列表里默认部分脱敏（138****1234），点详情才显示全号。
- 不收款 = 不涉及支付合规，足以走第一期。

---

## 七、不做（第二期/三期）

- 微信 JSAPI 支付、商户号对接。
- 微信小程序同账号同步：预留 `external_refs jsonb` 字段，到时把小程序里的 page_path / scene 写进去即可。
- 拼团、阶梯价、秒杀、优惠券等营销机制（虽然项目里有 settings 字段，先不串通）。
- 物流推送（SF/京东 API）。
- 自提/同城配送。
- 客户标签和会员等级。

---

## 八、改动文件清单

**新增**
- 迁移：`group_orders / orders / order_items` 三张表 + 索引 + RLS + grants + `dashboard_summary` 视图（或函数）
- `src/lib/orders.functions.ts`、`src/lib/group-orders.functions.ts`、`src/lib/customers.functions.ts`、`src/lib/dashboard.functions.ts`
- 公开 H5：`src/routes/g.$slug.tsx`、`src/routes/g.$slug.o.$code.tsx`
- 公开 API：`src/routes/api/public/g.$slug.place-order.ts`、`src/routes/api/public/orders.$orderNo.ts`
- 团长后台：`src/routes/_authenticated/app.groups.tsx`、`src/routes/_authenticated/app.orders.tsx`、`src/routes/_authenticated/app.orders.$id.tsx`、`src/routes/_authenticated/app.customers.tsx`、`src/routes/_authenticated/app.dashboard.tsx`（如果项目目前 `/app` 不在 `_authenticated` 下，按现有结构同形态落位）
- 组件：`QuickBuyBanner`（首页）、`QuickBuyButton`（顶栏，三态）、`StartGroupSheet`、`OrderRow / OrderDetail / OrderFilters / OrderExportButton / GroupCard / CustomerRow / KPIStat`、H5 端 `BuyPage / VariantPicker / OrderForm / OrderSuccess`

**改动**
- `src/routes/app.index.tsx`：在 MobileInboxBanner 上方插 `<QuickBuyBanner />`。
- `src/routes/app.tsx`：顶栏 `<AssetLibraryButton /> <QuickBuyButton /> <SyncToKttButton />` 三件套并列。
- 项目编辑页底部「立即开团」按钮文案 + onClick → 打开 StartGroupSheet。

第一期工作量预计较大但完全在前端 + 现有 Supabase 之内，无需任何第三方密钥/审批。批准后我会按 "数据库迁移 → 团长 API → 团长 UI 入口 → H5 客户端 → 后台 4 模块" 的顺序分步落地。