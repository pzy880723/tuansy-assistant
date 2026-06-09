/**
 * Server-only session helpers. Mock auth: a httpOnly cookie holds the
 * app_users.id of the logged-in user.
 *
 * NOTE: This is a development-phase mock. Replace with real SMS / WeChat
 * provider integration before production launch.
 */
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "tuan_uid";
const PUBLIC_COOKIE = "tuan_user"; // readable from client for display only
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function readSessionUserId(): string | null {
  return getCookie(SESSION_COOKIE) ?? null;
}

export function writeSession(user: {
  id: string;
  nickname: string;
  phone?: string | null;
  wechat_openid?: string | null;
}) {
  setCookie(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
  // Public, JS-readable cookie for client-side display + route guard.
  // NOTE: setCookie() URL-encodes the value itself — do NOT pre-encode here,
  // or the browser ends up with a double-encoded string the client can't parse.
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
}

export function clearSession() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
  deleteCookie(PUBLIC_COOKIE, { path: "/" });
  setCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  setCookie(PUBLIC_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

export async function requireUserId(): Promise<string> {
  const uid = readSessionUserId();
  if (!uid) throw new Error("未登录");
  return uid;
}
