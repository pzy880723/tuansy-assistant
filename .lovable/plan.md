# 修复登录无反应

## 根因
- `src/lib/auth-session.server.ts` 写 `tuan_user` cookie 时手动做了一次 `encodeURIComponent(JSON.stringify(...))`。
- TanStack `setCookie` 内部会再次 URL 编码，导致浏览器拿到的是 **双重编码** 的字符串（例如 `%257B...%257D`）。
- `src/lib/use-current-user.ts` 只做了一次 `decodeURIComponent`，结果传给 `JSON.parse` 的依旧是带 `%` 的字符串 → 抛错被 `catch` 吞掉 → 返回 `null`。
- `/app` 的 `AppLayout` 看到 `user === null`，立刻 `navigate({ to: "/auth", search: { redirect: pathname } })`，于是登录成功后页面又被踢回登录页，表现就是「点了没反应」。

网络日志能印证这一点：`verifySmsCode` / `wechatMockLogin` 都返回了 200 和正确的 user，问题完全在客户端读 cookie 这一步。

## 改动

### 1. `src/lib/auth-session.server.ts`
写 `tuan_user` 时去掉手动 `encodeURIComponent`，直接把 JSON 字符串交给 `setCookie`（让框架自己编码一次就够）：

```ts
setCookie(
  PUBLIC_COOKIE,
  JSON.stringify({
    id: user.id,
    nickname: user.nickname,
    phone: user.phone ?? null,
    wechat: !!user.wechat_openid,
  }),
  { httpOnly: false, sameSite: "lax", secure: true, path: "/", maxAge: MAX_AGE },
);
```

### 2. `src/lib/use-current-user.ts`（兼容性兜底）
保留 `decodeURIComponent`（浏览器读 `document.cookie` 仍是编码态），同时为 `JSON.parse` 失败情况打一条 `console.warn`，方便后续排查；如果解析失败就清掉这个坏 cookie，避免一直卡死：

```ts
try {
  return JSON.parse(decodeURIComponent(raw)) as ClientUser;
} catch {
  // 旧的坏 cookie：清掉，避免反复跳登录
  document.cookie = "tuan_user=; Max-Age=0; path=/";
  return null;
}
```

### 3. 验证
- 在 `/auth` 用 `13xxxxxxxxx` + `123456` 登录 → 应直接跳到 `/app` 并显示用户菜单。
- 在 DevTools → Application → Cookies 检查 `tuan_user`，值应是单次编码的 JSON。
- 已登录用户刷新 `/app` 不再被踢回 `/auth`。

## 不动的部分
- 后端 `verifySmsCode` / `wechatMockLogin` 逻辑不变。
- `tuan_uid`（httpOnly）写入方式不变。
- 路由结构、UI、其他业务代码不变。
