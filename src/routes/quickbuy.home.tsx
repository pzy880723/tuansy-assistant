import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Bot, Package2, ArrowRight, AlertTriangle } from "lucide-react";
import { dashboardSummary } from "@/lib/orders.functions";
import { fenToYuan } from "@/lib/quickbuy-shared";

export const Route = createFileRoute("/quickbuy/home")({
  component: HomePage,
});

type SkuLite = { name?: string; stock?: string; variants?: Array<{ stock?: string }> };

function HomePage() {
  const fetchSummary = useServerFn(dashboardSummary);
  const { data, isLoading } = useQuery({ queryKey: ["qb-summary-home"], queryFn: () => fetchSummary({ data: {} }) });
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>;
  const kpi = data?.kpi ?? { todayCount: 0, todayGmv: 0, weekCount: 0, weekGmv: 0 };
  const groups = data?.groups ?? [];
  const active = groups.filter((g) => g.status === "active");

  const alerts: Array<{ groupTitle: string; sku: string }> = [];
  for (const g of active) {
    const skus = (Array.isArray(g.snapshot_skus) ? g.snapshot_skus : []) as SkuLite[];
    for (const s of skus) {
      const stockNum = parseInt(s.stock ?? "", 10);
      if (Number.isFinite(stockNum) && stockNum > 0 && stockNum <= 5) {
        alerts.push({ groupTitle: g.title, sku: `${s.name} (剩 ${stockNum})` });
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">工作台</h1>
          <p className="text-sm text-muted-foreground">今日 · 本周一览</p>
        </div>
        <Link to="/quickbuy/assistant" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:brightness-110">
          <Bot className="h-4 w-4" /> 问问 AI 助手
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="今日订单" value={String(kpi.todayCount)} />
        <Kpi label="今日 GMV" value={`¥${fenToYuan(kpi.todayGmv)}`} />
        <Kpi label="本周订单" value={String(kpi.weekCount)} />
        <Kpi label="进行中团数" value={String(active.length)} highlight />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
            <AlertTriangle className="h-4 w-4" /> 库存预警
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {alerts.slice(0, 6).map((a, i) => (
              <li key={i}>· {a.groupTitle} — {a.sku}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">进行中团购</h2>
          <Link to="/quickbuy/groups" className="text-xs text-emerald-600 hover:underline">查看全部 →</Link>
        </div>
        {active.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">暂无进行中的团购</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {active.slice(0, 6).map((g) => (
              <Link key={g.id} to="/quickbuy/orders" search={{ groupOrderId: g.id }} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/40">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Package2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{g.title}</div>
                  <div className="text-xs text-muted-foreground">订单 {g.order_count ?? 0} · GMV ¥{fenToYuan(g.gmv_cents)}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${highlight ? "ring-1 ring-emerald-500/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
