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
  return next({ headers: token ? { "x-tuan-session": token } : undefined });
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, attachTuanSession],
  requestMiddleware: [errorMiddleware],
}));
