import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// 腾讯云短信回执回调
// 配置：腾讯云短信控制台 -> 应用管理 -> 短信回执 -> 回执 URL
//   URL：https://<your-domain>/api/public/sms/tencent-callback?token=<TENCENT_SMS_CALLBACK_TOKEN>
//
// 推送体（数组，腾讯云会批量推送）：
// [{ user_receive_time, nationcode, mobile, report_status, errmsg, description, sn }]

const ReportSchema = z.object({
  user_receive_time: z.string().optional(),
  nationcode: z.string().optional(),
  mobile: z.string().optional(),
  report_status: z.string().optional(), // SUCCESS / FAIL
  errmsg: z.string().optional(),
  description: z.string().optional(),
  sn: z.string().optional(), // = SerialNo
});

function parseReceiveTime(input?: string): string | null {
  if (!input) return null;
  // "2024-06-14 22:18:38" → ISO（按服务器本地时区即可，回执仅用作展示）
  const t = Date.parse(input.replace(" ", "T"));
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export const Route = createFileRoute("/api/public/sms/tencent-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env.TENCENT_SMS_CALLBACK_TOKEN;
        if (!expected) {
          return new Response("callback token not configured", { status: 503 });
        }
        const token = url.searchParams.get("token");
        if (!token || token !== expected) {
          return new Response("invalid token", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const list = Array.isArray(payload) ? payload : [payload];
        const parsed = list
          .map((item) => ReportSchema.safeParse(item))
          .filter((r): r is z.SafeParseSuccess<z.infer<typeof ReportSchema>> => r.success)
          .map((r) => r.data);

        if (parsed.length === 0) {
          return Response.json({ ok: true, updated: 0 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let updated = 0;
        const nowIso = new Date().toISOString();
        for (const r of parsed) {
          if (!r.sn) continue;
          const success = (r.report_status ?? "").toUpperCase() === "SUCCESS";
          const status = success ? "delivered" : "failed";
          const deliveredAt = success ? parseReceiveTime(r.user_receive_time) ?? nowIso : null;
          const { error, count } = await supabaseAdmin
            .from("sms_verification_codes")
            .update(
              {
                delivery_status: status,
                delivery_code: r.errmsg ?? null,
                delivery_message: r.description ?? null,
                delivered_at: deliveredAt,
                report_received_at: nowIso,
              },
              { count: "exact" },
            )
            .eq("provider_request_id", r.sn);
          if (!error && (count ?? 0) > 0) updated += count ?? 0;
        }

        // 腾讯云只关心 200 OK
        return Response.json({ ok: true, updated });
      },
    },
  },
});
