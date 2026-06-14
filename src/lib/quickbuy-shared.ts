// Shared types/utilities for the in-app quickbuy module. Pure data only.

export type AddressInput = {
  province: string;
  city: string;
  district: string;
  detail: string;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "completed"
  | "refunded"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "待处理",
  paid: "已确认",
  shipped: "已发货",
  completed: "已完成",
  refunded: "已退款",
  cancelled: "已取消",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "未付款",
  paid: "已付款",
  refunded: "已退款",
};

export function maskPhone(p: string): string {
  if (!p || p.length < 7) return p;
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

export function fenToYuan(cents: number | bigint | null | undefined): string {
  const n = Number(cents ?? 0);
  return (n / 100).toFixed(2);
}

export function yuanToFen(yuan: string | number): number {
  const n = typeof yuan === "string" ? parseFloat(yuan) : yuan;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function priceMinFen(skus: unknown): number {
  if (!Array.isArray(skus) || skus.length === 0) return 0;
  let min = Infinity;
  for (const s of skus as Array<Record<string, unknown>>) {
    const variants = Array.isArray(s.variants) ? (s.variants as Array<Record<string, unknown>>) : [];
    if (variants.length > 0) {
      for (const v of variants) {
        const p = yuanToFen(String(v.price ?? ""));
        if (p > 0 && p < min) min = p;
      }
    } else {
      // legacy "19.9" or "19-25" string
      const raw = String(s.price ?? "");
      const m = raw.match(/[\d.]+/g);
      if (m) {
        for (const x of m) {
          const p = yuanToFen(x);
          if (p > 0 && p < min) min = p;
        }
      }
    }
  }
  return min === Infinity ? 0 : min;
}
