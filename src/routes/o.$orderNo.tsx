import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/o/$orderNo")({
  ssr: false,
  component: OrderQueryPage,
});

type OrderData = {
  order: {
    order_no: string;
    status: string;
    payment_status: string;
    total_cents: number;
    buyer_name: string;
    buyer_phone: string;
    address: { province?: string; city?: string; district?: string; detail?: string };
    note?: string;
    tracking_no?: string | null;
    shipping_carrier?: string | null;
    created_at: string;
    items_count: number;
  };
  items: Array<{ sku_name: string; variant_label: string; image_url?: string | null; unit_price_cents: number; qty: number; subtotal_cents: number }>;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "待处理", paid: "已确认", shipped: "已发货", completed: "已完成", refunded: "已退款", cancelled: "已取消",
};

function OrderQueryPage() {
  const { orderNo } = Route.useParams();
  const [data, setData] = useState<OrderData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const code = new URL(window.location.href).searchParams.get("code") ?? "";
    fetch(`/api/public/orders/${orderNo}?code=${encodeURIComponent(code)}`)
      .then((r) => r.json().then((j) => (r.ok ? setData(j as OrderData) : setErr(j.error))))
      .catch((e) => setErr(e instanceof Error ? e.message : "加载失败"));
  }, [orderNo]);

  if (err) return <div className="p-8 text-center text-sm text-muted-foreground">{err}</div>;
  if (!data) return <div className="p-8 text-center text-sm text-muted-foreground">加载中…</div>;

  const a = data.order.address ?? {};
  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f5f5f5] p-4 text-sm">
      <div className="rounded-2xl bg-white p-4">
        <div className="text-xs text-muted-foreground">订单号 {data.order.order_no}</div>
        <div className="mt-2 inline-block rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-700">
          {STATUS_LABEL[data.order.status] ?? data.order.status}
        </div>
        <div className="mt-3 space-y-2">
          {data.items.map((it, i) => (
            <div key={i} className="flex gap-2">
              {it.image_url && <img src={it.image_url} alt="" className="h-14 w-14 rounded object-cover" />}
              <div className="flex-1">
                <div className="font-medium">{it.sku_name}</div>
                {it.variant_label && <div className="text-xs text-muted-foreground">{it.variant_label}</div>}
                <div className="text-xs">¥{(it.unit_price_cents / 100).toFixed(2)} × {it.qty}</div>
              </div>
              <div className="text-red-500">¥{(it.subtotal_cents / 100).toFixed(2)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t pt-3 text-right text-base">
          合计 <span className="font-bold text-red-500">¥{(data.order.total_cents / 100).toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white p-4">
        <div className="text-xs text-muted-foreground">收件人</div>
        <div className="mt-1">{data.order.buyer_name} {data.order.buyer_phone}</div>
        <div className="mt-1 text-xs text-muted-foreground">{a.province}{a.city}{a.district} {a.detail}</div>
        {data.order.note && <div className="mt-2 text-xs"><span className="text-muted-foreground">备注：</span>{data.order.note}</div>}
      </div>

      {data.order.tracking_no && (
        <div className="mt-3 rounded-2xl bg-white p-4">
          <div className="text-xs text-muted-foreground">物流</div>
          <div className="mt-1">{data.order.shipping_carrier ?? ""} {data.order.tracking_no}</div>
        </div>
      )}
    </div>
  );
}
