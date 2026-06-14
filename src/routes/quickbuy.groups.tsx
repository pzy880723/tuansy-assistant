import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, X, RefreshCw, Package2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listGroupOrders, closeGroupOrder, reopenGroupOrder } from "@/lib/group-orders.functions";
import { fenToYuan } from "@/lib/quickbuy-shared";

export const Route = createFileRoute("/quickbuy/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const fetchGroups = useServerFn(listGroupOrders);
  const close = useServerFn(closeGroupOrder);
  const reopen = useServerFn(reopenGroupOrder);
  const { data, isLoading } = useQuery({
    queryKey: ["qb-groups"],
    queryFn: () => fetchGroups({ data: {} }),
  });
  const closeMut = useMutation({
    mutationFn: (id: string) => close({ data: { id } }),
    onSuccess: () => { toast.success("已关团"); qc.invalidateQueries({ queryKey: ["qb-groups"] }); },
  });
  const reopenMut = useMutation({
    mutationFn: (projectId: string) => reopen({ data: { projectId } }),
    onSuccess: () => { toast.success("已重新开团"); qc.invalidateQueries({ queryKey: ["qb-groups"] }); },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>;
  const groups = data?.groups ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">我的开团</h1>
        <p className="text-sm text-muted-foreground">从团宝助手项目顶栏点「团宝速购开团」即可新开一团。</p>
      </div>
      {groups.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Rocket className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <div className="mt-3 text-sm text-muted-foreground">还没有任何团购</div>
          <Link to="/app" className="mt-4 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-2 text-sm text-white hover:brightness-110">
            去团宝助手写文案
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const url = typeof window !== "undefined" ? `${window.location.origin}/g/${g.slug}` : `/g/${g.slug}`;
            const active = g.status === "active";
            return (
              <div key={g.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted">
                    {g.cover_image_url ? <img src={g.cover_image_url} alt="" className="h-full w-full rounded-lg object-cover" /> : <Package2 className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold">{g.title}</div>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {active ? "进行中" : "已关团"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">/g/{g.slug}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <Stat n={g.view_count ?? 0} l="浏览" />
                      <Stat n={g.order_count ?? 0} l="订单" />
                      <Stat n={`¥${fenToYuan(g.gmv_cents)}`} l="GMV" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(url); toast.success("已复制链接"); }}>
                    <Copy className="h-3 w-3" /> 复制
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                    <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /> 打开</a>
                  </Button>
                  <Link to="/quickbuy/orders" search={{ groupOrderId: g.id }} className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted">
                    看订单
                  </Link>
                  {active ? (
                    <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => closeMut.mutate(g.id)} disabled={closeMut.isPending}>
                      <X className="h-3 w-3" /> 关团
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => reopenMut.mutate(g.project_id)} disabled={reopenMut.isPending}>
                      <RefreshCw className="h-3 w-3" /> 再开
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1">
      <div className="text-sm font-semibold">{n}</div>
      <div className="text-[10px] text-muted-foreground">{l}</div>
    </div>
  );
}
