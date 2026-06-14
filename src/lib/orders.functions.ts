import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-session.server";
import type { OrderStatus, PaymentStatus } from "@/lib/quickbuy-shared";

const OrderFilters = z.object({
  projectId: z.string().uuid().optional(),
  groupOrderId: z.string().uuid().optional(),
  status: z.enum(["pending", "paid", "shipped", "completed", "refunded", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
  q: z.string().max(60).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const listOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderFilters.parse(d ?? {}))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("orders")
      .select(
        "id, order_no, group_order_id, project_id, buyer_phone, buyer_name, address, status, payment_status, items_count, total_cents, tracking_no, created_at, updated_at",
        { count: "exact" },
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.groupOrderId) q = q.eq("group_order_id", data.groupOrderId);
    if (data.status) q = q.eq("status", data.status);
    if (data.paymentStatus) q = q.eq("payment_status", data.paymentStatus);
    if (data.q) q = q.or(`order_no.ilike.%${data.q}%,buyer_phone.ilike.%${data.q}%,buyer_name.ilike.%${data.q}%`);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw new Error(error.message);
    return { orders: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const getOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!order) throw new Error("订单不存在");
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });
    return { order, items: items ?? [] };
  });

const UpdateOrderInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["mark_paid", "mark_unpaid", "ship", "complete", "refund", "cancel", "reopen"]),
  trackingNo: z.string().max(60).optional(),
  shippingCarrier: z.string().max(40).optional(),
});

type OrdersUpdatePatch = Partial<{
  status: OrderStatus;
  payment_status: PaymentStatus;
  paid_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
  tracking_no: string;
  shipping_carrier: string;
}>;

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateOrderInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    const now = new Date().toISOString();
    switch (data.action) {
      case "mark_paid":
        patch.payment_status = "paid" satisfies PaymentStatus;
        patch.paid_at = now;
        patch.status = "paid" satisfies OrderStatus;
        break;
      case "mark_unpaid":
        patch.payment_status = "unpaid" satisfies PaymentStatus;
        patch.paid_at = null;
        break;
      case "ship":
        if (!data.trackingNo) throw new Error("请填写运单号");
        patch.status = "shipped" satisfies OrderStatus;
        patch.shipped_at = now;
        patch.tracking_no = data.trackingNo;
        if (data.shippingCarrier) patch.shipping_carrier = data.shippingCarrier;
        break;
      case "complete":
        patch.status = "completed" satisfies OrderStatus;
        patch.completed_at = now;
        break;
      case "refund":
        patch.status = "refunded" satisfies OrderStatus;
        patch.payment_status = "refunded" satisfies PaymentStatus;
        patch.refunded_at = now;
        break;
      case "cancel":
        patch.status = "cancelled" satisfies OrderStatus;
        patch.cancelled_at = now;
        break;
      case "reopen":
        patch.status = "pending" satisfies OrderStatus;
        patch.cancelled_at = null;
        break;
    }
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.id).eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportOrdersCsv = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderFilters.parse(d ?? {}))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("orders")
      .select("order_no, created_at, buyer_phone, buyer_name, address, status, payment_status, total_cents, items_count, tracking_no, shipping_carrier, note, id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.groupOrderId) q = q.eq("group_order_id", data.groupOrderId);
    if (data.status) q = q.eq("status", data.status);
    if (data.paymentStatus) q = q.eq("payment_status", data.paymentStatus);
    const { data: orders } = await q;
    const orderIds = (orders ?? []).map((o) => o.id);
    const { data: items } = orderIds.length
      ? await supabaseAdmin.from("order_items").select("order_id, sku_name, variant_label, qty, unit_price_cents").in("order_id", orderIds)
      : { data: [] as Array<{ order_id: string; sku_name: string; variant_label: string; qty: number; unit_price_cents: number }> };
    const itemsByOrder = new Map<string, string[]>();
    for (const it of items ?? []) {
      const list = itemsByOrder.get(it.order_id) ?? [];
      list.push(`${it.sku_name}${it.variant_label ? ` [${it.variant_label}]` : ""} ×${it.qty}`);
      itemsByOrder.set(it.order_id, list);
    }
    const headers = ["订单号", "下单时间", "手机", "收件人", "省", "市", "区", "详细地址", "明细", "数量", "金额(元)", "付款", "状态", "承运商", "运单号", "备注"];
    const lines = [headers.join(",")];
    for (const o of orders ?? []) {
      const a = (o.address as { province?: string; city?: string; district?: string; detail?: string }) ?? {};
      const row = [
        o.order_no,
        new Date(o.created_at).toLocaleString("zh-CN"),
        o.buyer_phone,
        o.buyer_name,
        a.province ?? "",
        a.city ?? "",
        a.district ?? "",
        a.detail ?? "",
        (itemsByOrder.get(o.id) ?? []).join(" / "),
        String(o.items_count ?? 0),
        (Number(o.total_cents ?? 0) / 100).toFixed(2),
        o.payment_status,
        o.status,
        o.shipping_carrier ?? "",
        o.tracking_no ?? "",
        (o.note ?? "").replace(/[\r\n]+/g, " "),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    }
    return { csv: "\ufeff" + lines.join("\n"), count: orders?.length ?? 0 };
  });

export const listCustomers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ q: z.string().max(60).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("orders")
      .select("buyer_phone, buyer_name, address, total_cents, status, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.q) q = q.or(`buyer_phone.ilike.%${data.q}%,buyer_name.ilike.%${data.q}%`);
    const { data: rows } = await q;
    const map = new Map<string, { phone: string; name: string; lastAddress: unknown; orderCount: number; totalCents: number; lastAt: string }>();
    for (const r of rows ?? []) {
      const prev = map.get(r.buyer_phone);
      if (prev) {
        prev.orderCount++;
        if (r.status !== "cancelled" && r.status !== "refunded") prev.totalCents += Number(r.total_cents ?? 0);
      } else {
        map.set(r.buyer_phone, {
          phone: r.buyer_phone,
          name: r.buyer_name,
          lastAddress: r.address,
          orderCount: 1,
          totalCents: r.status === "cancelled" || r.status === "refunded" ? 0 : Number(r.total_cents ?? 0),
          lastAt: r.created_at,
        });
      }
    }
    return { customers: Array.from(map.values()) };
  });

export const dashboardSummary = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async () => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("status, payment_status, total_cents, created_at")
      .eq("owner_id", userId)
      .gte("created_at", since);
    const todayKey = new Date().toISOString().slice(0, 10);
    let todayCount = 0, todayGmv = 0, weekCount = 0, weekGmv = 0;
    for (const o of orders ?? []) {
      const live = o.status !== "cancelled" && o.status !== "refunded";
      weekCount++;
      if (live) weekGmv += Number(o.total_cents ?? 0);
      if (o.created_at.slice(0, 10) === todayKey) {
        todayCount++;
        if (live) todayGmv += Number(o.total_cents ?? 0);
      }
    }
    const { data: groups } = await supabaseAdmin
      .from("group_orders")
      .select("id, slug, title, status, order_count, items_sold, gmv_cents, snapshot_skus, project_id")
      .eq("owner_id", userId)
      .order("started_at", { ascending: false })
      .limit(20);
    return {
      kpi: { todayCount, todayGmv, weekCount, weekGmv },
      groups: groups ?? [],
    };
  });
