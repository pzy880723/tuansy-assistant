## 目标
把 `/auth` 登录页从"朴素卡片"升级成更有质感的品牌登录页，并把"微信扫码登录"做成真实可接入的形态（先把 UI/流程/后端骨架做到位，等你拿到微信开放平台 AppID/AppSecret 直接配置即可生效）。

## 1. 视觉与布局重设计（仅改 `src/routes/auth.tsx` + 少量样式）

风格：暖橙渐变 + 玻璃拟态（沿用 #FF7A2D 品牌色，与首页/编辑器视觉延续）。

**桌面（≥768px）：左右分栏**
```
┌──────────────────────────┬───────────────────────────┐
│  品牌侧（左 55%）         │  登录表单（右 45%）        │
│  - 暖橙径向渐变 + 噪点    │  毛玻璃白卡 backdrop-blur │
│  - 大号 logo + slogan     │  Tab: 手机验证码 / 微信扫码│
│  - 3 条卖点（icon+文案）  │  表单字段 + 主按钮         │
│  - 浮动光斑/橙色光晕动效  │  底部协议 + 客服入口       │
│  - 底部"已服务 N 位团长"  │                            │
└──────────────────────────┴───────────────────────────┘
```

**手机（<768px）：单列**
- 顶部压缩品牌区（logo + 一句 slogan + 渐变背景）
- 下方玻璃卡承载表单，复用同一套组件
- 用 `useIsMobile()` 切换布局，桌面像素级不动其它页面

**视觉细节**
- 背景：`bg-[radial-gradient(...)]` + 两个 `blur-3xl` 橙色光斑做氛围
- 卡片：`bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_20px_60px_-20px_rgba(255,122,45,0.35)]`
- Tab：胶囊式高亮，激活态用品牌橙渐变填充
- 主按钮：`bg-gradient-to-r from-[#FF7A2D] to-[#FFB266]` + hover 微微上移 + 光泽
- 微弱的入场动效（fade + slide-up，纯 CSS，不引入新库）
- 按 `tailwind4-backdrop-filter` 规则：只写 `backdrop-blur-*`，绝不手写 `-webkit-backdrop-filter`

**新增 design tokens**：在 `src/styles.css` 增加 `--gradient-brand`、`--shadow-brand-glow` 两个语义 token，避免组件里写死颜色。

## 2. 微信扫码登录（PC 网页扫码 / Web 应用）

你选了"网页扫码登录(PC)"。这条线本质是微信开放平台的 OAuth2.0 网页授权：

```
用户点"微信登录"
  → 前端拉起 /api/public/wechat/qrconnect 拼好的 open.weixin.qq.com URL（内嵌二维码 iframe 或新窗口）
  → 用户手机扫码确认
  → 微信回调 /api/public/wechat/callback?code=...&state=...
  → 后端用 code 换 access_token + openid + unionid
  → 后端按 openid 查/建 app_users，签发本地 session（复用现有 finishLogin / writeSession）
  → 前端轮询 /api/wechat/poll?state=... 或直接由回调页 postMessage 通知主窗口跳转
```

需要的东西（你日后去微信开放平台 https://open.weixin.qq.com 注册"网站应用"后拿到）：
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- 在开放平台后台填回调域名：`tuansy-assistant.lovable.app`（生产）

这两个我**不会在 plan 阶段就向你要**，等 UI 和后端骨架做完，你确认进入下一步时再用 add_secret 收。

### 后端骨架（本次实现，等密钥即可启用）

新文件：
- `src/routes/api/public/wechat.qrconnect.ts`
  GET：生成随机 `state`（存内存 Map + 5 分钟过期，或写到 `sms_verification_codes` 同结构的新表 `wechat_login_states`），重定向到 `https://open.weixin.qq.com/connect/qrconnect?appid=...&redirect_uri=...&response_type=code&scope=snsapi_login&state=...#wechat_redirect`
- `src/routes/api/public/wechat.callback.ts`
  GET：校验 state → 用 code 调微信 `access_token` & `userinfo` 接口 → upsert app_users（按 wechat_openid）→ 写 session → 返回一个简单 HTML 页面 `postMessage('wechat-login-success', token)` 给父窗口并自动关闭
- `src/lib/auth.functions.ts`：新增 `pollWechatLogin({ state })` serverFn，前端轮询拿到 user + sessionToken

新表（migration）：
```
wechat_login_states(state PK, status enum:pending/done/expired, user_id?, session_token?, created_at, expires_at)
```
带 RLS（仅 service_role 可读写）+ 必要 GRANT。

### 前端改造

`WechatForm` 组件：
- 默认显示一个**真二维码**（嵌入 `https://open.weixin.qq.com/connect/qrconnect?...` 官方二维码 iframe，或我们的端点重定向过去）
- 下方提示"请使用微信扫一扫"
- 开始时调用 `/api/public/wechat/qrconnect?state=xxx` 获取 state，然后用 `setInterval` 每 2 秒轮询 `pollWechatLogin`
- 拿到结果后写 cookie + 跳转，与手机号路径一致
- 兜底：如果 `WECHAT_APP_ID` 未配置，二维码区域显示"微信登录暂未开通，请使用手机号登录"，不报错

### 关于"微信内 H5 公众号授权"
你这次只选了 PC 扫码。H5 公众号授权（snsapi_userinfo）流程不同，需要"微信公众号"资质，本次先不做；后续要做我会单独再起一个 plan。

## 3. 不动的东西
- `src/integrations/supabase/*` 自动生成文件
- 编辑器（`app.project.$id.tsx`）、首页、其它路由的视觉
- 现有手机验证码流程的后端逻辑（只是表单换皮）
- 现有 `wechatMockLogin` 保留为开发兜底（密钥未配置时使用）

## 4. 文件改动清单
- **改**：`src/routes/auth.tsx`（整页重写视觉，逻辑保留）
- **改**：`src/styles.css`（加 2 个品牌 token）
- **改**：`src/lib/auth.functions.ts`（新增 `pollWechatLogin`，保留旧函数）
- **新**：`src/routes/api/public/wechat.qrconnect.ts`
- **新**：`src/routes/api/public/wechat.callback.ts`
- **新**：migration 建 `wechat_login_states` 表
- **不改**：编辑器/首页/其它路由

## 5. 等你确认的事
1. 上面这套方案是否 OK？特别是"先把骨架做出来、AppID/AppSecret 等你拿到再 add_secret"这个节奏？
2. 二维码呈现：(a) 嵌入官方 `qrconnect` iframe（最快、样式由微信控制）  vs  (b) 后端代生成自定义样式二维码（更可控但要多接一个微信 SDK 调用）— 默认我用 (a)，要 (b) 告诉我。

确认后我进入 build 模式开干。