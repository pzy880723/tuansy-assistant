import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Upload, Truck, CheckCheck, X, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listOrders,
  getOrder,
  updateOrderStatus,
  exportOrdersCsv,
  bulkUploadTracking,
} from "@/lib/orders.functions";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, fenToYuan, type OrderStatus, type PaymentStatus } from "@/lib/quickbuy-shared";
import { z } from "zod";

type UpdateOrderInput = {
  id: string;
  action: "mark_paid" | "mark_unpaid" | "ship" | "complete" | "refund" | "cancel" | "reopen";
  trackingNo?: string;
  shippingCarrier?: string;
};

const searchSchema = z.object({
  groupOrderId: z.string().optional(),
  status: z.enum(["pending", "paid", "shipped", "completed", "refunded", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/quickbuy/orders")({
  validateSearch: (s) => searchSchema.parse(s),
  component: OrdersPage,
});

function OrdersPage() {
  const search = Route.useSearch();
  const nav = Route.useNavigate();
  const qc = useQueryClient();
  const fetchOrders = useServerFn(listOrders);
  const exportFn = useServerFn(exportOrdersCsv);
  const updateFn = useServerFn(updateOrderStatus);
  const bulkFn = useServerFn(bulkUploadTracking);

  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [shipFor, setShipFor] = useState<{ id: string; orderNo: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [qInput, setQInput] = useState(search.q ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["qb-orders", search, page],
    queryFn: () => fetchOrders({ data: { ...search, page, pageSize: 20 } }),
  });
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;

  const updateStatus = useMutation({
    mutationFn: (input: UpdateOrderInput) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("已更新");
      qc.invalidateQueries({ queryKey: ["qb-orders"] });
      qc.invalidateQueries({ queryKey: ["qb-order-detail"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失败"),
  });

  const doExport = useMutation({
    mutationFn: () => exportFn({ data: search }),
    onSuccess: (r) => {
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${r.count} 条订单`);
    },
  });

  const setFilter = (patch: Partial<typeof search>) => {
    setPage(1);
    nav({ search: { ...search, ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">订单管理</h1>
          <p className="text-sm text-muted-foreground">共 {total} 条</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4" /> 批量上传单号
          </Button>
          <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => doExport.mutate()} disabled={doExport.isPending}>
            <Download className="h-4 w-4" /> 导出 Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => { e.preventDefault(); setFilter({ q: qInput || undefined }); }}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="订单号 / 手机 / 收件人"
            className="h-8 max-w-xs text-sm"
          />
        </form>
        <Select value={search.status ?? "all"} onValueChange={(v) => setFilter({ status: v === "all" ? undefined : (v as OrderStatus) })}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.paymentStatus ?? "all"} onValueChange={(v) => setFilter({ paymentStatus: v === "all" ? undefined : (v as PaymentStatus) })}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="付款" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部付款</SelectItem>
            {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search.q || search.status || search.paymentStatus || search.groupOrderId) && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setQInput(""); nav({ search: {} }); }}>
            <X className="mr-1 h-3 w-3" /> 清除
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">加载中…</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">暂无订单</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-normal">订单号</th>
                <th className="px-3 py-2 text-left font-normal">收件人</th>
                <th className="px-3 py-2 text-left font-normal">金额</th>
                <th className="px-3 py-2 text-left font-normal">付款</th>
                <th className="px-3 py-2 text-left font-normal">状态</th>
                <th className="px-3 py-2 text-left font-normal">时间</th>
                <th className="px-3 py-2 text-right font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">
                    <button className="text-emerald-600 hover:underline" onClick={() => setOpenOrderId(o.id)}>{o.order_no}</button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs">{o.buyer_name}</div>
                    <div className="text-[11px] text-muted-foreground">{o.buyer_phone}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">¥{fenToYuan(o.total_cents)} · {o.items_count} 件</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 ${o.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : o.payment_status === "refunded" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                      {PAYMENT_STATUS_LABEL[o.payment_status as PaymentStatus] ?? o.payment_status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status}
                    {o.tracking_no && <div className="mt-0.5 text-[10px] text-muted-foreground">{o.tracking_no}</div>}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString("zh-CN")}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {o.payment_status !== "paid" && (
                        <button className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted" onClick={() => updateStatus.mutate({ id: o.id, action: "mark_paid" })}>标已付</button>
                      )}
                      {o.status !== "shipped" && o.status !== "completed" && (
                        <button className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted" onClick={() => setShipFor({ id: o.id, orderNo: o.order_no })}>发货</button>
                      )}
                      {o.status === "shipped" && (
                        <button className="rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted" onClick={() => updateStatus.mutate({ id: o.id, action: "complete" })}>完成</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > 20 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-muted-foreground">{page} / {Math.ceil(total / 20)}</span>
          <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}

      <OrderDetailSheet id={openOrderId} onClose={() => setOpenOrderId(null)} />
      <ShipDialog
        open={!!shipFor}
        order={shipFor}
        onClose={() => setShipFor(null)}
        onSubmit={(trackingNo, carrier) => {
          if (!shipFor) return;
          updateStatus.mutate({ id: shipFor.id, action: "ship", trackingNo, shippingCarrier: carrier });
          setShipFor(null);
        }}
      />
      <BulkShipDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSubmit={async (rows) => {
          const r = await bulkFn({ data: { rows } });
          toast.success(`成功 ${r.success} 条，失败 ${r.failed} 条`);
          if (r.failures.length) console.warn("失败明细:", r.failures);
          qc.invalidateQueries({ queryKey: ["qb-orders"] });
          setBulkOpen(false);
        }}
      />
    </div>
  );
}

function ShipDialog({
  open, order, onClose, onSubmit,
}: { open: boolean; order: { id: string; orderNo: string } | null; onClose: () => void; onSubmit: (trackingNo: string, carrier?: string) => void }) {
  const [tn, setTn] = useState("");
  const [carrier, setCarrier] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>填写运单号</DialogTitle>
          <DialogDescription>订单 {order?.orderNo}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">承运商</label>
            <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="如：顺丰、中通、圆通" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">运单号</label>
            <Input value={tn} onChange={(e) => setTn(e.target.value)} placeholder="请输入运单号" autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => tn.trim() && onSubmit(tn.trim(), carrier.trim() || undefined)} disabled={!tn.trim()} className="gap-1">
            <Truck className="h-4 w-4" /> 确认发货
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkShipDialog({
  open, onClose, onSubmit,
}: { open: boolean; onClose: () => void; onSubmit: (rows: Array<{ orderNo: string; trackingNo: string; carrier?: string }>) => void }) {
  const [text, setText] = useState("");
  const parsed = parseBulkText(text);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>批量上传单号</DialogTitle>
          <DialogDescription>
            一行一单，支持「订单号 + 空格/Tab/逗号 + 运单号 [+ 承运商]」，可直接从 Excel 复制两/三列粘贴。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={`示例：\n2606140000012345\tSF1234567890\t顺丰\n2606140000067890\tYTO9876543210\t圆通`}
          className="font-mono text-xs"
        />
        <div className="text-xs text-muted-foreground">已解析 {parsed.length} 条</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSubmit(parsed)} disabled={parsed.length === 0} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
            <Upload className="h-4 w-4" /> 上传 {parsed.length} 条
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseBulkText(text: string): Array<{ orderNo: string; trackingNo: string; carrier?: string }> {
  return text.split(/\r?\n/).map((line) => {
    const parts = line.split(/[\t,\s]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    return { orderNo: parts[0], trackingNo: parts[1], carrier: parts[2] };
  }).filter(Boolean) as Array<{ orderNo: string; trackingNo: string; carrier?: string }>;
}

function OrderDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const fetchOne = useServerFn(getOrder);
  const { data, isLoading } = useQuery({
    queryKey: ["qb-order-detail", id],
    queryFn: () => fetchOne({ data: { id: id! } }),
    enabled: !!id,
  });
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>订单详情</SheetTitle>
          <SheetDescription>{data?.order?.order_no}</SheetDescription>
        </SheetHeader>
        {isLoading || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
        ) : (
          <div className="space-y-4 py-4 text-sm">
            <Section title="状态">
              <div className="flex gap-2 text-xs">
                <span className="rounded bg-muted px-2 py-1">{ORDER_STATUS_LABEL[data.order.status as OrderStatus]}</span>
                <span className="rounded bg-muted px-2 py-1">{PAYMENT_STATUS_LABEL[data.order.payment_status as PaymentStatus]}</span>
              </div>
              {data.order.tracking_no && (
                <div className="mt-2 text-xs text-muted-foreground">运单：{data.order.shipping_carrier ?? ""} {data.order.tracking_no}</div>
              )}
            </Section>
            <Section title="收件人">
              <div>{data.order.buyer_name} · {data.order.buyer_phone}</div>
              <div className="text-xs text-muted-foreground">
                {(() => { const a = data.order.address as { province?: string; city?: string; district?: string; detail?: string } ?? {}; return `${a.province ?? ""}${a.city ?? ""}${a.district ?? ""} ${a.detail ?? ""}`; })()}
              </div>
            </Section>
            <Section title="商品">
              <div className="space-y-1.5">
                {data.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
                    <div>
                      <div>{it.sku_name}</div>
                      {it.variant_label && <div className="text-[10px] text-muted-foreground">{it.variant_label}</div>}
                    </div>
                    <div className="text-right">
                      <div>¥{fenToYuan(it.unit_price_cents)} × {it.qty}</div>
                      <div className="text-[10px] text-muted-foreground">¥{fenToYuan(it.subtotal_cents)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-right text-sm font-semibold">合计 ¥{fenToYuan(data.order.total_cents)}</div>
            </Section>
            {data.order.note && (
              <Section title="买家备注"><div className="text-xs text-muted-foreground">{data.order.note}</div></Section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      <div>{children}</div>
    </div>
  );
}
