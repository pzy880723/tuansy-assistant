import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createGroupOrder, closeGroupOrder, getActiveGroupOrder, reopenGroupOrder } from "@/lib/group-orders.functions";

export function QuickBuyButton({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const fetchActive = useServerFn(getActiveGroupOrder);
  const create = useServerFn(createGroupOrder);
  const close = useServerFn(closeGroupOrder);
  const reopen = useServerFn(reopenGroupOrder);
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["group-order", projectId],
    queryFn: () => fetchActive({ data: { projectId } }),
  });
  const group = data?.group;
  const isActive = group?.status === "active";

  const createMut = useMutation({
    mutationFn: () => create({ data: { projectId } }),
    onSuccess: () => {
      toast.success("已开团");
      qc.invalidateQueries({ queryKey: ["group-order", projectId] });
      setOpen(true);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "开团失败"),
  });
  const closeMut = useMutation({
    mutationFn: () => close({ data: { id: group!.id } }),
    onSuccess: () => {
      toast.success("已关团");
      qc.invalidateQueries({ queryKey: ["group-order", projectId] });
    },
  });
  const reopenMut = useMutation({
    mutationFn: () => reopen({ data: { projectId } }),
    onSuccess: () => {
      toast.success("已重新开团");
      qc.invalidateQueries({ queryKey: ["group-order", projectId] });
      setOpen(true);
    },
  });

  const label = !group ? "团宝速购开团" : isActive ? "已开团 · 管理" : "重新开团";

  const handle = () => {
    if (!group) createMut.mutate();
    else if (isActive) setOpen(true);
    else reopenMut.mutate();
  };

  const shareUrl = group ? `${typeof window !== "undefined" ? window.location.origin : ""}/g/${group.slug}` : "";

  return (
    <>
      <Button
        size="sm"
        onClick={handle}
        disabled={createMut.isPending || reopenMut.isPending}
        className="h-7 gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-3 text-xs font-medium text-white shadow-sm hover:brightness-110"
      >
        <ShoppingBag className="h-3.5 w-3.5" />
        {label}
      </Button>

      {group && isActive && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-emerald-600" /> 团宝速购 · 进行中
              </DialogTitle>
              <DialogDescription>把链接或二维码分享给客户，他们点开就能下单。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-3 text-center text-xs">
                <Stat n={group.view_count ?? 0} label="浏览" />
                <Stat n={group.order_count ?? 0} label="订单" />
                <Stat n={((Number(group.gmv_cents ?? 0)) / 100).toFixed(0)} label="销售额(元)" />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">分享链接</div>
                <div className="flex items-center gap-2">
                  <input readOnly value={shareUrl} className="h-9 flex-1 rounded-md border bg-background px-2 text-xs" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("链接已复制"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                  </Button>
                </div>
              </div>

              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(shareUrl)}`}
                  alt="二维码"
                  className="h-44 w-44 rounded-lg border bg-white p-2"
                />
              </div>
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="outline" size="sm" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
                <X className="mr-1 h-3.5 w-3.5" /> 关团
              </Button>
              <Button variant="default" size="sm" onClick={() => setOpen(false)}>知道了</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <div className="text-base font-semibold">{n}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
