import { createFileRoute } from "@tanstack/react-router";
import { createSessionToken } from "@/lib/auth-session.server";

// 微信开放平台 OAuth2.0 回调：
//   1. 校验 state 是否存在且未过期
//   2. 用 code 换 access_token + openid
//   3. upsert app_users (按 wechat_openid)
//   4. 签发本地 session_token，写回 wechat_login_states，让前端轮询取走
//   5. 返回一个简单的 HTML 页面提示"扫码成功，请回到登录页"

export const Route = createFileRoute("/api/public/wechat/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!state) return htmlResponse("缺少 state 参数", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("wechat_login_states")
          .select("state, status, expires_at")
          .eq("state", state)
          .maybeSingle();
        if (!row) return htmlResponse("登录会话不存在或已失效，请回到登录页重新扫码", 400);
        if (new Date(row.expires_at).getTime() <= Date.now()) {
          await supabaseAdmin
            .from("wechat_login_states")
            .update({ status: "expired" })
            .eq("state", state);
          return htmlResponse("二维码已过期，请回到登录页重新获取", 400);
        }
        if (!code) {
          await supabaseAdmin
            .from("wechat_login_states")
            .update({ status: "error", error_message: "用户取消授权" })
            .eq("state", state);
          return htmlResponse("已取消授权");
        }

        const appid = process.env.WECHAT_APP_ID;
        const secret = process.env.WECHAT_APP_SECRET;
        if (!appid || !secret) {
          await supabaseAdmin
            .from("wechat_login_states")
            .update({ status: "error", error_message: "微信尚未配置" })
            .eq("state", state);
          return htmlResponse("微信登录尚未配置，请联系管理员", 500);
        }

        try {
          // 1) code → access_token + openid
          const tokenRes = await fetch(
            `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}&secret=${secret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`,
          );
          const tokenJson = (await tokenRes.json()) as {
            access_token?: string;
            openid?: string;
            unionid?: string;
            errcode?: number;
            errmsg?: string;
          };
          if (!tokenJson.access_token || !tokenJson.openid) {
            throw new Error(tokenJson.errmsg || "微信换取 token 失败");
          }

          // 2) 拉取用户信息（昵称、头像）
          let nickname = `微信用户${tokenJson.openid.slice(-4)}`;
          try {
            const infoRes = await fetch(
              `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenJson.access_token}&openid=${tokenJson.openid}&lang=zh_CN`,
            );
            const infoJson = (await infoRes.json()) as { nickname?: string };
            if (infoJson.nickname) nickname = infoJson.nickname;
          } catch {
            // 拉昵称失败不阻塞登录
          }

          // 3) upsert app_users
          const { data: existing } = await supabaseAdmin
            .from("app_users")
            .select("id, nickname, phone, wechat_openid, is_banned")
            .eq("wechat_openid", tokenJson.openid)
            .maybeSingle();
          if (existing?.is_banned) {
            await supabaseAdmin
              .from("wechat_login_states")
              .update({ status: "error", error_message: "该账号已被封禁" })
              .eq("state", state);
            return htmlResponse("该账号已被封禁，请联系管理员", 403);
          }

          let userId = existing?.id;
          if (!userId) {
            const { data: created, error } = await supabaseAdmin
              .from("app_users")
              .insert({ wechat_openid: tokenJson.openid, nickname })
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            userId = created.id;
          }

          // 4) 签发 session_token，写回扫码状态
          const sessionToken = await createSessionToken(userId);
          await supabaseAdmin
            .from("wechat_login_states")
            .update({ status: "done", user_id: userId, session_token: sessionToken })
            .eq("state", state);

          return htmlResponse(
            "扫码成功！请回到登录页面，系统正在自动登录...",
            200,
            true,
          );
        } catch (e) {
          const message = e instanceof Error ? e.message : "微信登录失败";
          await supabaseAdmin
            .from("wechat_login_states")
            .update({ status: "error", error_message: message })
            .eq("state", state);
          return htmlResponse(`登录失败：${message}`, 500);
        }
      },
    },
  },
});

function htmlResponse(msg: string, status = 200, success = false) {
  const color = success ? "#FF7A2D" : "#1A1A1A";
  const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>微信登录</title><style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#fff4e6 0%,#ffffff 100%);min-height:100vh;display:grid;place-items:center;padding:24px;color:#1a1a1a}
.card{background:rgba(255,255,255,.85);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.6);border-radius:20px;padding:32px 28px;text-align:center;max-width:360px;box-shadow:0 20px 50px -20px rgba(255,122,45,.3)}
.dot{width:48px;height:48px;border-radius:50%;background:${color};margin:0 auto 16px;display:grid;place-items:center;color:#fff;font-size:24px}
p{margin:0;font-size:14px;line-height:1.6;color:#444}
</style></head><body><div class="card"><div class="dot">${success ? "✓" : "!"}</div><p>${escapeHtml(msg)}</p></div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
