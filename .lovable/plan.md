# 团宝速购 · 独立工作台方案（修订版）

理解了 —— **团宝助手** 和 **团宝速购** 是两个独立产品，通过"开团"互通。本方案按这个心智模型重做。

```
团宝助手（文案创作）  ←──开团/写文案──→  团宝速购（开团交易后台）
```

---

## 一、顶部入口（极简）

`src/routes/app.tsx` 的 `GlobalNav` 改为只 4 个：
- 项目（团宝助手主业）
- **团宝速购** 🛒（新增，醒目主色 chip）
- Chrome 插件
- 设置

点「团宝速购」→ 跳到 `/quickbuy`，进入独立工作台。

项目顶栏「团宝速购开团」按钮保留（一键带快照跳到速购的开团流程）。

---

## 二、团宝速购独立工作台 `/quickbuy/*`

完全自成一体，左侧 sidebar + 右侧内容区，与 `/app` 视觉上区分（不同 logo 副标 + 不同主色块）。

### 路由结构
- `/quickbuy` → **首页/介绍页**（首次访问 or 无团时展示，含"开始第一团"CTA）
- `/quickbuy/home` → 工作台仪表盘（有团后默认进这里）
- `/quickbuy/groups` → 我的开团
- `/quickbuy/orders` → 订单
- `/quickbuy/customers` → 客户
- `/quickbuy/finance` → 资金与分润（占位，二期）
- `/quickbuy/assistant` → **AI 助手**（自然语言操作中心，本期重头）

### Sidebar 项
```
🏠 工作台
🚀 我的开团
📦 订单管理
👥 客户
💰 资金分润   [即将上线]
─────────────
🤖 AI 助手
✍️  去团宝助手写文案 ↗  ← 直接跳 /app
```

---

## 三、首页/介绍页 `/quickbuy`（首屏教育）

无需登录态门槛即可访问介绍区；带数据后区分"新用户引导态"和"老用户工作台态"。

**新用户态**：
- Hero："团宝速购 · 轻量级开团交易工具"
  - 副标：不用快团团，30 秒开团，H5 收单、订单管理、资金结算，全部内嵌
- 三栏对比卡：vs 快团团（更轻 / 无审核 / 与团宝助手文案一键联动）
- 4 个能力卡：一键开团 · H5 下单页 · 订单一站式 · AI 自然语言操作
- 操作流图：在团宝助手写文案 → 一键开团 → 分享 H5 → AI 助手管订单
- 两个 CTA：「去团宝助手写第一篇」「直接空白开团」

**老用户态**（有 group_orders 数据）：
- 顶部 4 KPI（今日订单/GMV/待发货/进行中团数）
- 进行中团购卡片
- 「问问 AI 助手」搜索框（直达 /quickbuy/assistant）

---

## 四、AI 助手 `/quickbuy/assistant`（本期亮点）

**这是你说的"自然语言导出订单 / 自然语言上传单号"的核心入口。**

聊天式 UI（复用现有 chat 基础设施 `src/routes/api/chat.ts`），但绑定一组"速购领域工具"。

### 支持的自然语言能力（首期）
| 你说 | AI 调用工具 | 结果 |
|---|---|---|
| "导出 12 月 1 号到 7 号的订单" | `exportOrders({ from, to })` | 返回下载链接 + 预览前 10 条 |
| "导出 XX 团的待发货订单" | `exportOrders({ groupId, status })` | 同上 |
| "把这张 Excel 里的单号都传上去"（粘贴/上传） | `bulkUploadTracking({ rows })` | 按订单号匹配批量发货，反馈成功 N / 失败 N |
| "顺丰 SF1234 是哪个订单" | `findOrderByTracking` | 跳详情 |
| "138xxxx1234 这个客户最近买了啥" | `getCustomerHistory({ phone })` | 列出订单 |
| "今天卖了多少" | `dashboardSummary` | 今日数据气泡 |
| "把订单 OXXX 标记已付款 / 退款" | `updateOrderStatus` | 状态变更 + 卡片 |
| "新开一个团，文案用项目 ABC" | `createGroupOrder({ projectId })` | 返回 slug + 二维码 |

### 实现要点
- 工具基于已有 serverFn（listOrders/exportOrdersCsv/updateOrderStatus/...）封装为 AI tool calls
- 新增 `bulkUploadTracking`（批量发货）serverFn —— 接收 [{orderNo, trackingNo, carrier?}]
- 文件上传：粘贴 Excel 文本 / 上传 .xlsx → 前端解析两列 → 交给工具
- 每个工具回执用富卡片渲染（订单卡、下载按钮、Excel 预览表）
- 助手页底部也保留"传统按钮入口"兜底（看订单/导出/上传单号），不强迫所有人用自然语言

---

## 五、其余 4 个模块（轻量版，因为重头给了 AI 助手）

### 我的开团 `/quickbuy/groups`
卡片网格：状态/标题/起止/销量/订单/GMV/操作（复制链接、二维码、关团、再开、看订单、看数据）。复用已有 `listGroupOrders` / `closeGroupOrder` / `reopenGroupOrder`。

### 订单 `/quickbuy/orders`
- 筛选条 + 表格 + 右上「导出 Excel」+「批量上传单号」
- 行操作：标记已付、发货（填运单+承运商）、完成、退款、取消
- 详情抽屉：商品行 / 地址 / 时间线 / 备注
- 复用 `listOrders / getOrder / updateOrderStatus / exportOrdersCsv`，新增 `bulkUploadTracking`

### 客户 `/quickbuy/customers`
- 按手机聚合：姓名/手机/订单数/累计/最近地址/最近下单
- 详情：该客户所有订单 + 默认地址
- 复用 `listCustomers`，新增 `getCustomerDetail`

### 资金分润 `/quickbuy/finance`（占位）
- 顶部说明卡："本期为团长自收款模式，不涉及平台资金。微信支付接通后将开放：收入流水 / 退款 / 平台抽佣 / 团长账户 / 提现 / 分销分润"
- 留 mock UI 骨架（账户余额 / 流水 / 提现按钮均 disabled）
- 二期接微信 JSAPI 支付后真正启用

---

## 六、与团宝助手的互通

1. 速购 sidebar「去团宝助手写文案 ↗」→ `/app`
2. 团宝助手项目顶栏「团宝速购开团」→ 调用 `createGroupOrder` → 跳 `/quickbuy/groups/$slug`
3. 速购首页 / AI 助手都能"按项目名搜索 → 一键开团"
4. 数据层：`group_orders.project_id` 已建外键，天然联动

---

## 七、技术清单

**新增路由**
- `src/routes/quickbuy.tsx`（layout，带速购侧栏）
- `src/routes/quickbuy.index.tsx`（首页/介绍）
- `src/routes/quickbuy.home.tsx`（工作台仪表盘）
- `src/routes/quickbuy.groups.tsx`
- `src/routes/quickbuy.orders.tsx`
- `src/routes/quickbuy.customers.tsx`
- `src/routes/quickbuy.finance.tsx`
- `src/routes/quickbuy.assistant.tsx`

**新增组件**
- `components/quickbuy/{Sidebar, IntroHero, KpiCards, GroupCard, OrderTable, OrderFilters, OrderDetailSheet, ShipDialog, BulkShipDialog, ExportButton, CustomerTable, AssistantChat, AssistantToolCards}.tsx`

**新增 serverFn**
- `bulkUploadTracking`（批量发货）
- `getCustomerDetail`
- `parseTrackingPaste`（解析粘贴文本/Excel → 行数组，纯函数也行）
- AI tool 注册层：`src/lib/quickbuy-ai-tools.ts`（把现有 serverFn 包成 tool definitions）

**编辑**
- `src/routes/app.tsx`：`GlobalNav` 加「团宝速购」chip；移除前一版我提的多 tab 方案
- `src/routes/api/chat.ts`：注入速购工具集（按当前路由 `/quickbuy/*` 启用）

**不动**
- 现有 `/app/*`、`/g/$slug`、`/o/$orderNo`、所有已建表与 serverFn

---

## 八、明确不做（二期）

- 真实资金流 / 微信支付 / 团长账户 / 提现 / 多级分润
- 物流轨迹查询接口
- 小程序端同步

---

确认后我按 "顶栏改造 → /quickbuy layout+介绍页 → 4 个管理模块 → AI 助手 + 工具封装 → 批量发货 serverFn" 顺序落地。
