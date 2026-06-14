import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/quickbuy-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages)) return new Response("Bad request", { status: 400 });

        const { readSessionUserIdFromRequest } = await import("@/lib/auth-session.server");
        const userId = await readSessionUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const fenToYuan = (n: number | bigint | null | undefined) => (Number(n ?? 0) / 100).toFixed(2);

        const tools = {
          searchOrders: tool({
            description: "按筛选条件查询订单列表。可按订单号、手机、收件人关键词搜索，可筛选状态/付款状态/时间范围。",
            inputSchema: z.object({
              q: z.string().optional().describe("关键词：订单号 / 手机号 / 收件人姓名"),
              status: z.enum(["pending", "paid", "shipped", "completed", "refunded", "cancelled"]).optional(),
              paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
              from: z.string().optional().describe("起始日期 YYYY-MM-DD"),
              to: z.string().optional().describe("结束日期 YYYY-MM-DD（含）"),
              limit: z.number().int().min(1).max(50).default(20),
            }),
            execute: async ({ q, status, paymentStatus, from, to, limit }) => {
              let qb = supabaseAdmin
                .from("orders")
                .select("order_no, buyer_name, buyer_phone, status, payment_status, total_cents, items_count, created_at, tracking_no")
                .eq("owner_id", userId)
                .order("created_at", { ascending: false })
                .limit(limit);
              if (status) qb = qb.eq("status", status);
              if (paymentStatus) qb = qb.eq("payment_status", paymentStatus);
              if (from) qb = qb.gte("created_at", `${from}T00:00:00`);
              if (to) qb = qb.lte("created_at", `${to}T23:59:59`);
              if (q) qb = qb.or(`order_no.ilike.%${q}%,buyer_phone.ilike.%${q}%,buyer_name.ilike.%${q}%`);
              const { data, error } = await qb;
              if (error) return { error: error.message };
              return {
                count: data?.length ?? 0,
                orders: (data ?? []).map((o) => ({
                  orderNo: o.order_no,
                  name: o.buyer_name,
                  phone: o.buyer_phone,
                  status: o.status,
                  paymentStatus: o.payment_status,
                  totalYuan: fenToYuan(o.total_cents),
                  itemsCount: o.items_count,
                  createdAt: o.created_at,
                  trackingNo: o.tracking_no,
                })),
              };
            },
          }),

          exportOrders: tool({
            description: "导出订单为 CSV，按筛选条件过滤。返回下载用的 base64 内容与摘要。",
            inputSchema: z.object({
              from: z.string().optional().describe("起始日期 YYYY-MM-DD"),
              to: z.string().optional().describe("结束日期 YYYY-MM-DD"),
              status: z.enum(["pending", "paid", "shipped", "completed", "refunded", "cancelled"]).optional(),
              paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
            }),
            execute: async ({ from, to, status, paymentStatus }) => {
              let qb = supabaseAdmin
                .from("orders")
                .select("order_no, created_at, buyer_phone, buyer_name, address, status, payment_status, total_cents, items_count, tracking_no, shipping_carrier, note")
                .eq("owner_id", userId)
                .order("created_at", { ascending: false })
                .limit(5000);
              if (status) qb = qb.eq("status", status);
              if (paymentStatus) qb = qb.eq("payment_status", paymentStatus);
              if (from) qb = qb.gte("created_at", `${from}T00:00:00`);
              if (to) qb = qb.lte("created_at", `${to}T23:59:59`);
              const { data, error } = await qb;
              if (error) return { error: error.message };
              const headers = ["订单号", "下单时间", "手机", "收件人", "省", "市", "区", "详细地址", "数量", "金额(元)", "付款", "状态", "承运商", "运单号", "备注"];
              const rows = (data ?? []).map((o) => {
                const a = (o.address as { province?: string; city?: string; district?: string; detail?: string }) ?? {};
                return [
                  o.order_no,
                  new Date(o.created_at).toLocaleString("zh-CN"),
                  o.buyer_phone, o.buyer_name,
                  a.province ?? "", a.city ?? "", a.district ?? "", a.detail ?? "",
                  String(o.items_count ?? 0),
                  fenToYuan(o.total_cents),
                  o.payment_status, o.status,
                  o.shipping_carrier ?? "", o.tracking_no ?? "",
                  (o.note ?? "").replace(/[\r\n]+/g, " "),
                ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
              });
              const csv = "\ufeff" + [headers.join(","), ...rows].join("\n");
              const filename = `orders_${from ?? "all"}_${to ?? new Date().toISOString().slice(0, 10)}.csv`;
              return { count: data?.length ?? 0, filename, csvBase64: Buffer.from(csv, "utf-8").toString("base64") };
            },
          }),

          bulkUploadTracking: tool({
            description: "批量为订单上传运单号并发货。每行包含 orderNo 和 trackingNo，可选 carrier。",
            inputSchema: z.object({
              rows: z.array(z.object({
                orderNo: z.string(),
                trackingNo: z.string(),
                carrier: z.string().optional(),
              })).min(1).max(500),
            }),
            execute: async ({ rows }) => {
              const now = new Date().toISOString();
              let success = 0;
              const failures: Array<{ orderNo: string; reason: string }> = [];
              for (const r of rows) {
                const { data: existing } = await supabaseAdmin
                  .from("orders").select("id").eq("owner_id", userId).eq("order_no", r.orderNo).maybeSingle();
                if (!existing) { failures.push({ orderNo: r.orderNo, reason: "订单不存在" }); continue; }
                const patch: Partial<Record<string, string | number | null>> = { tracking_no: r.trackingNo, status: "shipped", shipped_at: now };
                if (r.carrier) patch.shipping_carrier = r.carrier;
                const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", existing.id).eq("owner_id", userId);
                if (error) failures.push({ orderNo: r.orderNo, reason: error.message });
                else success++;
              }
              return { success, failed: failures.length, failures };
            },
          }),

          updateOrder: tool({
            description: "更新单个订单状态。action: mark_paid/mark_unpaid/ship/complete/refund/cancel/reopen。ship 必须带 trackingNo。",
            inputSchema: z.object({
              orderNo: z.string(),
              action: z.enum(["mark_paid", "mark_unpaid", "ship", "complete", "refund", "cancel", "reopen"]),
              trackingNo: z.string().optional(),
              carrier: z.string().optional(),
            }),
            execute: async ({ orderNo, action, trackingNo, carrier }) => {
              const { data: existing } = await supabaseAdmin.from("orders").select("id").eq("owner_id", userId).eq("order_no", orderNo).maybeSingle();
              if (!existing) return { error: "订单不存在" };
              const now = new Date().toISOString();
              const patch: Partial<Record<string, string | number | null>> = {};
              switch (action) {
                case "mark_paid": patch.payment_status = "paid"; patch.paid_at = now; patch.status = "paid"; break;
                case "mark_unpaid": patch.payment_status = "unpaid"; patch.paid_at = null; break;
                case "ship":
                  if (!trackingNo) return { error: "ship 必须带 trackingNo" };
                  patch.status = "shipped"; patch.shipped_at = now; patch.tracking_no = trackingNo;
                  if (carrier) patch.shipping_carrier = carrier;
                  break;
                case "complete": patch.status = "completed"; patch.completed_at = now; break;
                case "refund": patch.status = "refunded"; patch.payment_status = "refunded"; patch.refunded_at = now; break;
                case "cancel": patch.status = "cancelled"; patch.cancelled_at = now; break;
                case "reopen": patch.status = "pending"; patch.cancelled_at = null; break;
              }
              const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", existing.id).eq("owner_id", userId);
              if (error) return { error: error.message };
              return { ok: true, orderNo, action };
            },
          }),

          dashboardSummary: tool({
            description: "查看今日 / 本周的订单数、GMV，以及进行中的团数。",
            inputSchema: z.object({}),
            execute: async () => {
              const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
              const { data: orders } = await supabaseAdmin
                .from("orders").select("status, total_cents, created_at").eq("owner_id", userId).gte("created_at", since);
              const todayKey = new Date().toISOString().slice(0, 10);
              let todayCount = 0, todayGmv = 0, weekCount = 0, weekGmv = 0;
              for (const o of orders ?? []) {
                const live = o.status !== "cancelled" && o.status !== "refunded";
                weekCount++;
                if (live) weekGmv += Number(o.total_cents ?? 0);
                if (o.created_at.slice(0, 10) === todayKey) { todayCount++; if (live) todayGmv += Number(o.total_cents ?? 0); }
              }
              const { count: activeGroups } = await supabaseAdmin
                .from("group_orders").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "active");
              return { todayCount, todayGmvYuan: fenToYuan(todayGmv), weekCount, weekGmvYuan: fenToYuan(weekGmv), activeGroups: activeGroups ?? 0 };
            },
          }),

          getCustomerHistory: tool({
            description: "按手机号查询某客户的全部订单。",
            inputSchema: z.object({ phone: z.string() }),
            execute: async ({ phone }) => {
              const { data } = await supabaseAdmin
                .from("orders").select("order_no, status, payment_status, total_cents, items_count, created_at")
                .eq("owner_id", userId).eq("buyer_phone", phone).order("created_at", { ascending: false }).limit(100);
              return {
                phone,
                count: data?.length ?? 0,
                orders: (data ?? []).map((o) => ({ orderNo: o.order_no, status: o.status, paymentStatus: o.payment_status, totalYuan: fenToYuan(o.total_cents), itemsCount: o.items_count, createdAt: o.created_at })),
              };
            },
          }),

          listGroups: tool({
            description: "列出当前所有的团购（包含进行中和已关团）。",
            inputSchema: z.object({ onlyActive: z.boolean().default(false) }),
            execute: async ({ onlyActive }) => {
              let qb = supabaseAdmin
                .from("group_orders").select("slug, title, status, order_count, items_sold, gmv_cents, started_at")
                .eq("owner_id", userId).order("started_at", { ascending: false }).limit(50);
              if (onlyActive) qb = qb.eq("status", "active");
              const { data } = await qb;
              return {
                count: data?.length ?? 0,
                groups: (data ?? []).map((g) => ({ slug: g.slug, title: g.title, status: g.status, orderCount: g.order_count, itemsSold: g.items_sold, gmvYuan: fenToYuan(g.gmv_cents), startedAt: g.started_at })),
              };
            },
          }),

          createGroupByProjectName: tool({
            description: "按项目名称（模糊匹配）新建一个团购，返回 H5 链接 slug。",
            inputSchema: z.object({ projectName: z.string() }),
            execute: async ({ projectName }) => {
              const { data: projects } = await supabaseAdmin
                .from("projects").select("id, name, intro, skus, delivery, cover_image_url").eq("owner_id", userId).ilike("name", `%${projectName}%`).limit(5);
              if (!projects || projects.length === 0) return { error: "未找到匹配的项目" };
              if (projects.length > 1) return { error: "匹配到多个项目，请明确名称", candidates: projects.map((p) => p.name) };
              const project = projects[0];
              const { newSlug } = await import("@/lib/quickbuy.server");
              await supabaseAdmin
                .from("group_orders").update({ status: "closed", closed_at: new Date().toISOString() })
                .eq("project_id", project.id).eq("status", "active");
              let slug = "";
              for (let i = 0; i < 5; i++) {
                const s = newSlug();
                const { data: dup } = await supabaseAdmin.from("group_orders").select("id").eq("slug", s).maybeSingle();
                if (!dup) { slug = s; break; }
              }
              if (!slug) return { error: "生成短链失败" };
              const { error } = await supabaseAdmin.from("group_orders").insert({
                project_id: project.id, owner_id: userId, slug, status: "active", title: project.name,
                cover_image_url: project.cover_image_url, snapshot_intro: project.intro, snapshot_skus: project.skus, snapshot_delivery: project.delivery,
              });
              if (error) return { error: error.message };
              return { ok: true, slug, title: project.name, url: `/g/${slug}` };
            },
          }),
        };

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");
        const result = streamText({
          model,
          abortSignal: request.signal,
          stopWhen: stepCountIs(10),
          tools,
          system: `你是「团宝速购 AI 助手」，帮团长用自然语言管理订单和团购。
你可以调用工具来：查询订单、导出订单 CSV、批量上传单号发货、更新订单状态、看仪表盘、查客户历史、列出团购、按项目名一键开团。
回复要简短、清晰、口语化中文。涉及数据时直接给数字结论；导出后用富文本告诉用户文件名与条数；批量发货后总结成功/失败条数。
不要瞎编订单号或手机号，没查到就说没查到。今天日期：${new Date().toISOString().slice(0, 10)}`,
          messages: await convertToModelMessages(body.messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
