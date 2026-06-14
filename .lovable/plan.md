## 在 `/g/$slug` 顶部加团长信息条

页面最顶部加一条团长信息（参考快团团商品页顶部）：左侧圆形头像，右侧团长昵称。点击不做跳转（暂无团长主页）。

## 数据来源

- 昵称：`app_users.nickname`（通过 `group_orders.owner_id` 关联）
- 头像：当前 schema 中 `app_users` 没有 avatar 字段。回退方案 = 取昵称首字符渲染为彩色圆形占位头像；后续如要真实头像，再加字段/上传流程。

## 改动

### 1. `src/routes/g.$slug.tsx` loader
在现有查询后追加一次 `app_users` 查询（owner_id），把 `leader = { nickname }` 一并返回。

```ts
const { data: owner } = await supabaseAdmin
  .from("app_users").select("nickname").eq("id", group.owner_id).maybeSingle();
return { group, leader: { nickname: owner?.nickname || "团长" } };
```

### 2. `src/routes/g.$slug.tsx` 组件
在 `<div className="mx-auto max-w-md">` 的最顶部、🔥 pill 之前，插入一行：

```
[圆形头像(首字)]  团长昵称
```

- 容器：`bg-white px-4 py-3 flex items-center gap-3 border-b border-border/50`
- 头像：`h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white grid place-items-center text-sm font-semibold`，内容 = 昵称首字符
- 名称：`text-sm font-medium`

### 3. 不变项
- 其它布局（标题、正文、SKU、底部 CTA、`OrderSheet`）全部保持上一版方案不变。
- 服务端 API、其它路由不动。
