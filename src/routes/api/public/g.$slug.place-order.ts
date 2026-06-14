import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { newOrderNo, newQueryCode } from "@/lib/quickbuy.server";
import { yuanToFen } from "@/lib/quickbuy-shared";

const ItemInput = z.object({
  skuIndex: z.number().int().min(0).max(200),
  variantIndex: z.number().int().min(0).max(500).optional(),
  qty: z.number().int().min(1).max(999),
});

const PlaceOrderInput = z.object({
  buyerPhone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  buyerName: z.string().trim().min(1).max(40),
  address: z.object({
    province: z.string().trim().min(1).max(20),
    city: z.string().trim().min(1).max(20),
    district: z.string().trim().min(1).max(20),
    detail: z.string().trim().min(3).max(200),
  }),
  note: z.string().max(200).optional(),
  items: z.array(ItemInput).min(1).max(20),
});

export const Route = createFileRoute("/api/public/g/$slug/place-order")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        let body: z.infer<typeof PlaceOrderInput>;
        try {
          body = PlaceOrderInput.parse(await request.json());
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "参数错误" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: group } = await supabaseAdmin
          .from("group_orders")
          .select("id, owner_id, project_id, status, snapshot_skus, ends_at")
          .eq("slug", params.slug)
          .maybeSingle();
        if (!group) return Response.json({ error: "团购不存在" }, { status: 404 });
        if (group.status !== "active") return Response.json({ error: "团购已结束" }, { status: 410 });
        if (group.ends_at && new Date(group.ends_at).getTime() < Date.now()) {
          return Response.json({ error: "团购已结束" }, { status: 410 });
        }
        const skus = (group.snapshot_skus ?? []) as Array<{
          name: string;
          price?: string;
          image?: string | null;
          images?: string[];
          variants?: Array<{ price: string; stock: string; image?: string | null; optionValueIds: string[] }>;
          specGroups?: Array<{ name: string; values: Array<{ id: string; label: string }> }>;
        }>;

        // Build order items + total
        const itemsToInsert: Array<{
          sku_index: number;
          variant_index: number | null;
          sku_name: string;
          variant_label: string;
          image_url: string | null;
          unit_price_cents: number;
          qty: number;
          subtotal_cents: number;
        }> = [];
        let total = 0;
        let itemsCount = 0;
        for (const it of body.items) {
          const s = skus[it.skuIndex];
          if (!s) return Response.json({ error: "商品不存在" }, { status: 400 });
          if (it.variantIndex != null && Array.isArray(s.variants) && s.variants.length > 0) {
            const v = s.variants[it.variantIndex];
            if (!v) return Response.json({ error: "规格不存在" }, { status: 400 });
            const price = yuanToFen(v.price);
            if (price <= 0) return Response.json({ error: "规格价格异常" }, { status: 400 });
            const stockNum = v.stock === "" || v.stock == null ? Infinity : parseInt(v.stock, 10);
            if (Number.isFinite(stockNum) && it.qty > stockNum) {
              return Response.json({ error: `「${s.name}」库存不足` }, { status: 409 });
            }
            const labels: string[] = [];
            (s.specGroups ?? []).forEach((g, gi) => {
              const vid = v.optionValueIds?.[gi];
              const found = g.values.find((vv) => vv.id === vid);
              if (found) labels.push(`${g.name}:${found.label}`);
            });
            itemsToInsert.push({
              sku_index: it.skuIndex,
              variant_index: it.variantIndex,
              sku_name: s.name,
              variant_label: labels.join(" / "),
              image_url: v.image ?? s.image ?? s.images?.[0] ?? null,
              unit_price_cents: price,
              qty: it.qty,
              subtotal_cents: price * it.qty,
            });
            total += price * it.qty;
            itemsCount += it.qty;
          } else {
            // Single-variant SKU
            const raw = String(s.price ?? "");
            const m = raw.match(/[\d.]+/);
            const price = m ? yuanToFen(m[0]) : 0;
            if (price <= 0) return Response.json({ error: "商品价格异常" }, { status: 400 });
            itemsToInsert.push({
              sku_index: it.skuIndex,
              variant_index: null,
              sku_name: s.name,
              variant_label: "",
              image_url: s.image ?? s.images?.[0] ?? null,
              unit_price_cents: price,
              qty: it.qty,
              subtotal_cents: price * it.qty,
            });
            total += price * it.qty;
            itemsCount += it.qty;
          }
        }

        // 5-second dedupe: same phone + group within 5s.
        const fiveSecAgo = new Date(Date.now() - 5000).toISOString();
        const { data: dup } = await supabaseAdmin
          .from("orders")
          .select("order_no, query_code")
          .eq("group_order_id", group.id)
          .eq("buyer_phone", body.buyerPhone)
          .gte("created_at", fiveSecAgo)
          .maybeSingle();
        if (dup) {
          return Response.json({ orderNo: dup.order_no, queryCode: dup.query_code, dedupe: true });
        }

        const orderNo = newOrderNo();
        const queryCode = newQueryCode();
        const { data: order, error } = await supabaseAdmin
          .from("orders")
          .insert({
            group_order_id: group.id,
            project_id: group.project_id,
            owner_id: group.owner_id,
            order_no: orderNo,
            query_code: queryCode,
            buyer_phone: body.buyerPhone,
            buyer_name: body.buyerName,
            address: body.address,
            note: body.note ?? "",
            channel: "h5",
            items_count: itemsCount,
            total_cents: total,
          })
          .select("id")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const { error: itErr } = await supabaseAdmin
          .from("order_items")
          .insert(itemsToInsert.map((x) => ({ ...x, order_id: order.id })));
        if (itErr) return Response.json({ error: itErr.message }, { status: 500 });

        // Update group counters (best-effort).
        await supabaseAdmin.rpc("noop").catch(() => null);
        const { data: cur } = await supabaseAdmin
          .from("group_orders")
          .select("order_count, items_sold, gmv_cents")
          .eq("id", group.id)
          .single();
        if (cur) {
          await supabaseAdmin
            .from("group_orders")
            .update({
              order_count: (cur.order_count ?? 0) + 1,
              items_sold: (cur.items_sold ?? 0) + itemsCount,
              gmv_cents: Number(cur.gmv_cents ?? 0) + total,
            })
            .eq("id", group.id);
        }

        return Response.json({ orderNo, queryCode });
      },
    },
  },
});
