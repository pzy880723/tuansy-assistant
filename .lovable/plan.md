# 团宝速购 工作台/团购列表 微调

## 1. 工作台头部精简 (`src/routes/quickbuy.home.tsx`)

- 删除顶部 `工作台 / 今日 · 本周一览` 标题块。
- 删除右上角 `问问 AI 助手` 按钮（功能已在左侧栏的 AI 模式中提供）。
- 让 `今日订单 / 今日 GMV / 本周订单 / 进行中团数` 四张 KPI 卡成为页面的第一行，自然与左侧菜单栏顶部对齐（外层 `quickbuy.tsx` 已有 `py-6`，左右两侧顶部 Y 一致）。
- 保留下方「库存预警」与「进行中团购」区块。

## 2. 团购卡片显示商品第一张图

数据库里 `group_orders.cover_image_url` 当前多为空，需要兜底取 `project_images` 表中按 `sort_order` 的第一张图（开团时项目并不一定填了封面，但通常都有商品图）。

### 2a. `src/lib/orders.functions.ts` — `dashboardSummary`

- 在已选字段基础上增加 `cover_image_url`。
- 收集返回的 group 的 `project_id`，再用 `supabaseAdmin.from("project_images").select("project_id, url").in("project_id", ids).order("sort_order")` 批量查询，按 project_id 取第一张。
- 在返回的每个 group 上追加 `cover_image_url: g.cover_image_url ?? imagesByProject[g.project_id] ?? null`。

### 2b. `src/lib/group-orders.functions.ts` — `listGroupOrders`

- 同样在两处 select 中保留 `cover_image_url`、新增 `project_id`（已存在），并补一次 `project_images` 批量查询，做同样的兜底合并。

### 2c. UI

- `src/routes/quickbuy.home.tsx` 「进行中团购」卡片：把目前的 `Package2` 占位换成 `g.cover_image_url ? <img …object-cover …/> : <Package2 …/>`。
- `src/routes/quickbuy.groups.tsx`：已使用 `g.cover_image_url`，无需改动（兜底由 2b 提供）。

## 不动的部分

- 左侧栏、AI 助手面板、路由树、其它页面均不改。
- 不修改后端表结构、不动 RLS / GRANT。

## 受影响文件

- `src/routes/quickbuy.home.tsx`
- `src/lib/orders.functions.ts`
- `src/lib/group-orders.functions.ts`
