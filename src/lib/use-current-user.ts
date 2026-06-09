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
  try {
    return JSON.parse(decodeURIComponent(match.split("=")[1])) as ClientUser;
  } catch {
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
