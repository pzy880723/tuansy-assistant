import { useEffect, useState } from "react";

export type ClientUser = {
  id: string;
  nickname: string;
  phone: string | null;
  wechat: boolean;
};

function readPublicCookie(): ClientUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("tuan_user="));
  if (!match) return null;
  const raw = match.slice("tuan_user=".length);
  try {
    return JSON.parse(decodeURIComponent(raw)) as ClientUser;
  } catch {
    // Stale / double-encoded cookie from an older build — clear it so the user
    // isn't stuck in an auth-redirect loop, then force a fresh login.
    document.cookie = "tuan_user=; Max-Age=0; path=/";
    return null;
  }
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
