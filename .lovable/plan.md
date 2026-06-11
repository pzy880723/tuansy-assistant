## 问题
登录成功后跳转到了 `/app`（项目列表页），但你希望跳转到 `/`（首页）。

## 原因
`src/routes/auth.tsx` 的 `getSafeRedirect` 函数把默认目标和兜底目标都设成了 `/app`：
- 第 108 行：无 redirect 参数时返回 `/app`
- 第 109 行：redirect 是 `/auth` 时返回 `/app`

## 修改
将 `src/routes/auth.tsx` 中 `getSafeRedirect` 的两处兜底值从 `"/app"` 改为 `"/"`，让登录后默认回到首页；如果 URL 上有合法的 `redirect`（例如从某个受保护页面跳来的），仍然按原值跳回。

仅此一处改动，不影响其它逻辑。