import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/orders/$orderNo")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";
        if (!code || code.length < 4) return Response.json({ error: "查询码缺失" }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, order_no, group_order_id, status, payment_status, items_count, total_cents, buyer_name, buyer_phone, address, note, tracking_no, shipping_carrier, created_at, paid_at, shipped_at, completed_at")
          .eq("order_no", params.orderNo)
          .eq("query_code", code)
          .maybeSingle();
        if (!order) return Response.json({ error: "订单不存在或查询码错误" }, { status: 404 });
        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("sku_name, variant_label, image_url, unit_price_cents, qty, subtotal_cents")
          .eq("order_id", order.id);
        const masked = {
          ...order,
          buyer_phone: order.buyer_phone.slice(0, 3) + "****" + order.buyer_phone.slice(-4),
        };
        return Response.json({ order: masked, items: items ?? [] });
      },
    },
  },
});
