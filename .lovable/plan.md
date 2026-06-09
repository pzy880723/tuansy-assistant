# 增加身份验证（开发期模拟版）

目标：用最小代价做"用户区隔"，登录方式为**短信验证码**和**微信扫码**，开发期全部走模拟流程，预留接口后期对接真实服务。

## 一、用户体验

1. 新路由 `/auth`（公开）：
   - Tab 1「手机验证码」：输入手机号 → 点"获取验证码" → 输入 6 位码 → 登录。开发期任意手机号都可发，验证码固定为 `123456`（也会在 toast 里提示），输入正确即登录。
   - Tab 2「微信扫码」：显示一张占位二维码 + "模拟扫码成功"按钮，点一下即登录为"微信用户"。
2. 进入 `/app/*` 任意页面时若未登录，自动跳到 `/auth`，登录后回到原页面。
3. 顶栏右上角显示当前用户（手机号尾号 / 微信昵称）+「退出登录」。

## 二、数据隔离

每个用户只能看到自己创建的团购项目。

- `projects`、`project_images`、`copy_versions` 增加 `owner_id uuid` 字段，关联 `auth.users(id)`。
- `shipping_templates` 暂时保持全局共享（属于通用配置）。
- RLS 重写为「仅本人可读写自己的数据」，去掉现有的 `USING (true)` 公共策略。
- Storage `product-images` 桶：写入路径强制为 `{user_id}/...`，策略仅允许本人对自己目录增删改；读取保持公开（图片要在小程序预览展示）。
- 现有 3 条历史数据：迁移时设为 NULL owner，登录后在「我的项目」页提供「认领到当前账号」按钮（或直接由你手动指认），避免数据丢失。

## 三、技术实现（开发期模拟）

- 不接入 Supabase 真实的 Phone Auth / 微信 OAuth，避免短信费用与微信开放平台审核。
- 使用 Supabase Admin API（在 server function 里用 service role key）"模拟"创建/登录用户：
  - 手机登录：以 `{phone}@mock.local` 作为邮箱、固定密码登录；不存在则自动创建。
  - 微信登录：以 `wx_{随机id}@mock.local` 创建，二维码页面点击"模拟扫码成功"后调用 server function 创建并登录。
- 登录后由前端用返回的 access/refresh token 调用 `supabase.auth.setSession()`，之后所有数据请求都带上 bearer，RLS 正常生效。
- 全部模拟逻辑集中在 `src/lib/auth.functions.ts`，并加 `// TODO: 接入真实短信/微信` 注释，方便后期替换。

## 四、改动清单

```text
新增  src/routes/auth.tsx                    登录页（手机 Tab + 微信 Tab）
新增  src/routes/_authenticated/route.tsx    受保护布局（未登录跳 /auth）
新增  src/lib/auth.functions.ts              模拟短信/扫码 server functions
新增  src/components/UserMenu.tsx            顶栏用户信息 + 退出
迁移  数据库                                 给 3 张表加 owner_id；重写 RLS；
                                            重写 storage 策略；GRANT 收紧到 authenticated
移动  src/routes/app.*.tsx                   迁入 _authenticated/ 子树
改动  src/routes/__root.tsx                  注册 onAuthStateChange
改动  src/lib/projects.functions.ts          写入时自动带 owner_id；查询按本人过滤
改动  src/routes/api/chat.ts                 校验当前用户对项目的所有权
```

## 五、后期接入真实功能的钩子

`src/lib/auth.functions.ts` 里两个函数 `sendSmsCode` / `verifySmsCode` / `wechatScanLogin` 都用 `if (import.meta.env.DEV || !process.env.SMS_PROVIDER_KEY) { /* mock */ }` 包住，将来只需：

- 短信：接阿里云/腾讯云短信，填 `SMS_PROVIDER_KEY` 等 secret。
- 微信：申请微信开放平台「网站应用」，前端生成真实二维码、后端处理 callback。

不需要重写路由或前端 UI。

## 六、需要你确认的两点

1. **模拟阶段验证码**：固定 `123456` 可以吗？还是希望随机生成并在 toast 里弹出？
2. **历史数据**：现有 3 个项目要不要绑定到你的第一个登录账号（推荐），还是清空重来？
