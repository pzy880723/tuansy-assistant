import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { listCustomers, getCustomerDetail } from "@/lib/orders.functions";
import { fenToYuan, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/quickbuy-shared";

export const Route = createFileRoute("/quickbuy/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const fetchCustomers = useServerFn(listCustomers);
  const [q, setQ] = useState("");
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["qb-customers", q],
    queryFn: () => fetchCustomers({ data: { q: q || undefined } }),
  });
  const customers = data?.customers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">客户</h1>
          <p className="text-sm text-muted-foreground">按手机去重 · 共 {customers.length} 位</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border bg-card p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="手机或姓名" className="h-8 max-w-xs text-sm" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">加载中…</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            还没有客户
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-normal">姓名</th>
                <th className="px-3 py-2 text-left font-normal">手机</th>
                <th className="px-3 py-2 text-right font-normal">订单</th>
                <th className="px-3 py-2 text-right font-normal">累计</th>
                <th className="px-3 py-2 text-left font-normal">最近地址</th>
                <th className="px-3 py-2 text-left font-normal">最近下单</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.phone} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => setOpenPhone(c.phone)}>
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.phone}</td>
                  <td className="px-3 py-2 text-right text-xs">{c.orderCount}</td>
                  <td className="px-3 py-2 text-right text-xs">¥{fenToYuan(c.totalCents)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {[c.lastAddress.province, c.lastAddress.city, c.lastAddress.district].filter(Boolean).join("")}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{new Date(c.lastAt).toLocaleDateString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CustomerDetailSheet phone={openPhone} onClose={() => setOpenPhone(null)} />
    </div>
  );
}

function CustomerDetailSheet({ phone, onClose }: { phone: string | null; onClose: () => void }) {
  const fetchDetail = useServerFn(getCustomerDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["qb-customer-detail", phone],
    queryFn: () => fetchDetail({ data: { phone: phone! } }),
    enabled: !!phone,
  });
  return (
    <Sheet open={!!phone} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>客户详情</SheetTitle>
          <SheetDescription>{phone}</SheetDescription>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
        ) : (
          <div className="space-y-2 py-4">
            <div className="text-xs text-muted-foreground">共 {data.orders.length} 单</div>
            {data.orders.map((o) => (
              <div key={o.id} className="rounded-lg border p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="font-mono">{o.order_no}</span>
                  <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("zh-CN")}</span>
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{ORDER_STATUS_LABEL[o.status as OrderStatus]} · {o.items_count} 件</span>
                  <span>¥{fenToYuan(o.total_cents)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
