import { useEffect, useState } from "react";

export type ClientUser = {
  id: string;
  nickname: string;
  phone: string | null;
  wechat: boolean;
};

const PUBLIC_COOKIE = "tuan_user";

export function clearAuthCookies() {
  if (typeof document === "undefined") return;
  document.cookie = "tuan_user=; Max-Age=0; path=/";
  document.cookie = "tuan_uid=; Max-Age=0; path=/";
}

export function writePublicUserCookie(user: ClientUser) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${PUBLIC_COOKIE}=${encodeURIComponent(JSON.stringify(user))}; Max-Age=${maxAge}; path=/; SameSite=Lax; Secure`;
}

function parsePublicCookie(): { user: ClientUser | null; error: string | null } {
  if (typeof document === "undefined") return { user: null, error: null };
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${PUBLIC_COOKIE}=`));
  if (!match) return { user: null, error: null };
  const raw = match.slice(`${PUBLIC_COOKIE}=`.length);
  try {
    return { user: JSON.parse(decodeURIComponent(raw)) as ClientUser, error: null };
  } catch {
    // Stale / double-encoded cookie from an older build — clear it so the user
    // isn't stuck in an auth-redirect loop, then force a fresh login.
    clearAuthCookies();
    return { user: null, error: "本地登录信息解析失败，已清理旧会话，请重新登录一次。" };
  }
}

function readPublicCookie(): ClientUser | null {
  return parsePublicCookie()?.user ?? null;
}

export function readAuthCookieError(): string | null {
  return parsePublicCookie()?.error ?? null;
}

/** Reactive read of the public display cookie set by writeSession(). */
export function useCurrentUser(): ClientUser | null {
  const [user, setUser] = useState<ClientUser | null>(() => readPublicCookie());
  useEffect(() => {
    setUser(readPublicCookie());
    const onFocus = () => setUser(readPublicCookie());
    window.addEventListener("focus", onFocus);
    window.addEventListener("tuan-auth-change", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("tuan-auth-change", onFocus);
    };
  }, []);
  return user;
}

export function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tuan-auth-change"));
  }
}
