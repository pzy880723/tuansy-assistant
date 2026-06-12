import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { readAuthToken } from "@/lib/use-current-user";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const attachTuanSession = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = readAuthToken();
  try {
    return await next({ headers: token ? { "x-tuan-session": token } : undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (typeof window !== "undefined" && /未登录|登录状态/.test(msg)) {
      const { clearAuthCookies, setAuthSessionError, notifyAuthChange } = await import("@/lib/use-current-user");
      clearAuthCookies();
      setAuthSessionError("登录状态已失效，请重新登录");
      notifyAuthChange();
      if (!window.location.pathname.startsWith("/auth")) {
        const redirect = window.location.pathname + window.location.search;
        window.location.replace(`/auth?redirect=${encodeURIComponent(redirect)}`);
      }
    }
    throw err;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, attachTuanSession],
  requestMiddleware: [errorMiddleware],
}));
