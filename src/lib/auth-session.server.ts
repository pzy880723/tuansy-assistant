import { createHash, randomBytes } from "crypto";
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "tuan_uid";
const PUBLIC_COOKIE = "tuan_user";
export const SESSION_HEADER = "x-tuan-session";
const MAX_AGE = 60 * 60 * 24 * 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseUserCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { id?: unknown };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

function readTokenHeader(): string | null {
  try {
    return getRequestHeader(SESSION_HEADER) || null;
  } catch {
    return null;
  }
}

function getCookieFromHeader(cookieHeader: string | null, name: string) {
  const part = cookieHeader
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`));
  return part ? part.slice(name.length + 1) : undefined;
}

export function readSessionUserId(): string | null {
  const sessionUserId = getCookie(SESSION_COOKIE);
  if (sessionUserId) return sessionUserId;
  return parseUserCookie(getCookie(PUBLIC_COOKIE));
}

async function readUserIdFromSessionToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  await supabaseAdmin
    .from("app_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token));
  return data.user_id;
}

export async function readSessionUserIdAsync(): Promise<string | null> {
  const cookieUserId = readSessionUserId();
  if (cookieUserId) return cookieUserId;
  return readUserIdFromSessionToken(readTokenHeader());
}

export async function readSessionUserIdFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  const uid = getCookieFromHeader(cookieHeader, SESSION_COOKIE);
  if (uid) return uid;
  const publicUid = parseUserCookie(getCookieFromHeader(cookieHeader, PUBLIC_COOKIE));
  if (publicUid) return publicUid;
  return readUserIdFromSessionToken(request.headers.get(SESSION_HEADER));
}

export async function createSessionToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_sessions").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + MAX_AGE * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return token;
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
  setCookie(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
  setCookie(PUBLIC_COOKIE, "", { httpOnly: false, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
}

export async function clearCurrentSession() {
  const token = readTokenHeader();
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("app_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(token));
  }
  clearSession();
}

export async function requireUserId(): Promise<string> {
  const uid = await readSessionUserIdAsync();
  if (!uid) throw new Error("未登录或登录状态已失效，请重新登录");
  return uid;
}
