## 一、设置页加返回入口

`/settings` 顶部增加"← 返回项目库"按钮跳 `/app`。

## 二、预设文案逻辑（行业模版）— 改为后台管理

### 数据模型

新建 `preset_copy_logics` 表（与 `copy_logics` 结构基本一致，但**无 user_id**，由 admin 维护）：
- `id, slug(unique), name, description, modules(jsonb), industry, sort_order, is_published, created_at, updated_at`
- RLS：`authenticated` 可 `SELECT` `is_published = true` 的行（用户端可浏览）；写入只允许 admin（通过 `has_role`）

初始迁移内 `INSERT` 7 条种子：服装、食品、珠宝、家电、日化、3C 数码、日用家居（每条预填 description + modules 草案）。

### 后台管理界面 `/admin/presets`

复用 `/settings` 现有的文案逻辑编辑组件（自然语言描述 + 模块列表 + "AI 生成模块"按钮 + 手动增删模块）。差别：
- 列表显示所有 `preset_copy_logics`（不分用户）
- 可新建/编辑/删除/上下架（`is_published`）/排序
- 调用 admin server fn：`adminListPresets`, `adminUpsertPreset`, `adminDeletePreset`, `adminGenerateModulesFromText`（复用现有的 `generateModulesFromText` 逻辑）

为复用编辑 UI：把 `/settings` 现有的编辑器拆成可复用组件 `<CopyLogicEditor source={"user"|"preset"} value onChange onAIGenerate />`，两边都用它。

### 前端用户侧表现

在 `/settings` 文案逻辑页面新增一个"**标准文案逻辑**"分区，列出所有已上架的预设：
- 只读展示（描述 + 模块列表 collapsed）
- 每条带"**复制到我的文案逻辑**"按钮 → 调 server fn `copyPresetToMine({presetId})` 在用户 `copy_logics` 里创建一份可编辑副本，自动跳到编辑态
- 用户**不能直接修改预设**，只能复制后改

在聊天面板的"文案逻辑"下拉里，预设也会显示在一个独立分组「标准模版（只读）」中，可直接选用；选用时按只读模板生成文案，不允许编辑（要改就先复制）。

为此 `/api/chat` 接收的 `copyLogicId` 需要支持 "preset:<id>" 与原本的 user copy_logic id 两种来源；命中 preset 时从 `preset_copy_logics` 取 modules 注入 system prompt。

## 三、后台管理系统 (admin)

### 1. 权限模型

迁移：
- `app_role` 枚举 `admin`/`user`
- `user_roles(user_id, role)` + 唯一约束 + RLS（admin 可读写）
- `has_role(_user_id, _role)` security definer
- `app_users.is_banned boolean default false`
- 触发器：新建 `app_users` 时若手机号 = `18657433310` 自动写入 admin 角色
- 同迁移末尾 `INSERT` 兜底：若该手机号已存在 `app_users`，直接插入 admin 角色

### 2. 路由结构

```text
src/routes/
  admin.tsx              // 布局，SidebarProvider + AdminSidebar
                         // beforeLoad: 未登录→/auth；非 admin→/app
  admin.index.tsx        // → /admin/dashboard
  admin.dashboard.tsx
  admin.users.tsx
  admin.presets.tsx      // 预设文案逻辑管理
  admin.audit.tsx
```

### 3. 仪表盘

四张卡：总用户、总项目、总文案、近 7 日新增用户；30 天折线：每日 `copy_versions` 生成数。
server fn：`getAdminStats()`, `getCopyTrend()`。

### 4. 用户管理

表格列：手机号 / 注册时间 / 项目数 / 文案数 / 角色 / 状态 / 操作
- 操作：封禁/解封、提升/撤销 admin
- 手机号搜索 + 分页 20/页
- server fn：`adminListUsers`, `adminSetBan`, `adminSetRole`
- 封禁用户在登录与 `/api/chat` 拒绝访问

### 5. 预设管理

如上述「二」详细描述。

### 6. 审计日志

两个 Tab：项目列表、文案记录；server fn `adminListProjects`, `adminListCopyVersions`。

### 7. 入口

`/app` 项目库右上角：若 `has_role('admin')` 显示「管理后台」按钮。判定走 `getMyRoles()` server fn。

### 8. 安全约束

所有 admin server fn：`requireSupabaseAuth` → `has_role` 校验 → `supabaseAdmin` 操作；否则抛 403。

## 四、交付清单

- **迁移 1**：`app_role` + `user_roles` + `has_role` + `app_users.is_banned` + 手机号自动 admin 触发器 + 首位 admin 兜底插入
- **迁移 2**：`preset_copy_logics` 表 + RLS + GRANT + 7 条种子数据
- **新文件**
  - `src/components/copy-logic/CopyLogicEditor.tsx`（拆分复用）
  - `src/components/admin/AdminSidebar.tsx`
  - `src/lib/admin.functions.ts`（含 preset CRUD、用户管理、统计）
  - `src/lib/presets.functions.ts`（用户侧：列预设、复制到我的）
  - `src/routes/admin.tsx` / `admin.index.tsx` / `admin.dashboard.tsx` / `admin.users.tsx` / `admin.presets.tsx` / `admin.audit.tsx`
- **修改**
  - `src/routes/settings.tsx`：返回按钮 + 「标准文案逻辑」分区 + 用 CopyLogicEditor
  - `src/routes/app.index.tsx`：admin 入口
  - `src/routes/app.project.$id.tsx`：下拉支持 preset 分组，选中传 `preset:<id>`
  - `src/routes/api/chat.ts`：解析 `copyLogicId` 区分 user / preset 来源
  - `src/lib/copy-logics.functions.ts`：保持现有 `generateModulesFromText` 可被 admin 复用

## 待你确认（最后一项）

封禁是否立即把用户踢下线？默认：仅拒绝下次登录与所有 server fn 调用（当前 session 页面不强制中断）。要"立即踢下线"建议二期再做。

如无异议，回复"开始"即按此实施。
