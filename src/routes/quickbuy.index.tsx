import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Rocket,
  Smartphone,
  Package2,
  Bot,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { dashboardSummary } from "@/lib/orders.functions";
import { listGroupOrders, createGroupOrder } from "@/lib/group-orders.functions";
import { listProjects } from "@/lib/projects.functions";
import { fenToYuan } from "@/lib/quickbuy-shared";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/quickbuy/")({
  component: QuickBuyHome,
});

function QuickBuyHome() {
  const fetchGroups = useServerFn(listGroupOrders);
  const { data, isLoading } = useQuery({
    queryKey: ["qb-groups-intro"],
    queryFn: () => fetchGroups({ data: {} }),
  });
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>;
  const groups = data?.groups ?? [];
  return groups.length > 0 ? <ReturningHome /> : <IntroPage />;
}

function IntroPage() {
  const fetchProjects = useServerFn(listProjects);
  const create = useServerFn(createGroupOrder);
  const navigate = useNavigate();
  const { data: projData } = useQuery({ queryKey: ["projects-intro"], queryFn: () => fetchProjects() });
  const projects = projData?.projects ?? [];

  const createMut = useMutation({
    mutationFn: (projectId: string) => create({ data: { projectId } }),
    onSuccess: () => {
      toast.success("已开团");
      navigate({ to: "/quickbuy/groups" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "开团失败"),
  });

  return (
    <div className="space-y-8 pb-12">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600 p-8 text-white shadow-lg">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-8 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3 w-3" /> 不用快团团 · 30 秒开团 · 内嵌交易
          </div>
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">
            团宝速购<span className="ml-2 text-xl font-normal opacity-80">轻量级开团交易工具</span>
          </h1>
          <p className="text-sm leading-relaxed text-white/85 md:text-base">
            为团长打造的零门槛开团工具：H5 一键下单、订单一站管理、AI 自然语言操作。
            与团宝助手联动，文案写完即可秒级开团。
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate({ to: "/app" })}
              className="gap-2 bg-white text-emerald-700 hover:bg-white/90"
            >
              <Sparkles className="h-4 w-4" /> 去团宝助手写第一篇
            </Button>
            {projects.length > 0 && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => createMut.mutate(projects[0].id)}
                disabled={createMut.isPending}
                className="gap-2 border-white/40 bg-white/10 text-white hover:bg-white/20"
              >
                <Rocket className="h-4 w-4" /> 用最新项目直接开团
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <CompareCard
          title="vs 快团团"
          pros={["更轻，无需团团 App", "免审核，立即可用", "与团宝助手文案联动"]}
        />
        <CompareCard
          title="核心能力"
          pros={["一键开团 H5", "订单一站式管理", "客户与销售看板"]}
        />
        <CompareCard
          title="即将上线"
          pros={["微信支付 JSAPI", "团长账户与提现", "多级分销分润"]}
          dim
        />
      </section>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">怎么用</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Step n={1} icon={Sparkles} title="写文案" desc="在团宝助手里和 AI 一起写商品文案" />
          <Step n={2} icon={Rocket} title="一键开团" desc="点「团宝速购开团」自动生成 H5" />
          <Step n={3} icon={Smartphone} title="分享下单" desc="分享链接或二维码，客户免登录下单" />
          <Step n={4} icon={Bot} title="AI 管订单" desc="自然语言导出订单、批量上传单号" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Capability icon={Rocket} title="一键开团" desc="项目顶栏直接开团，自动快照商品" />
        <Capability icon={Smartphone} title="H5 下单页" desc="规格选择、地址、备注全套" />
        <Capability icon={Package2} title="订单一站式" desc="筛选、发货、导出、状态流转" />
        <Capability icon={Bot} title="AI 自然语言" desc="说话就能管订单、导报表" highlight />
      </section>
    </div>
  );
}

function ReturningHome() {
  const fetchSummary = useServerFn(dashboardSummary);
  const { data } = useQuery({ queryKey: ["qb-summary"], queryFn: () => fetchSummary({ data: {} }) });
  const kpi = data?.kpi ?? { todayCount: 0, todayGmv: 0, weekCount: 0, weekGmv: 0 };
  const groups = (data?.groups ?? []).filter((g) => g.status === "active");
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
        <Kpi label="进行中团数" value={String(groups.length)} highlight />
      </div>
      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">进行中团购</h2>
          <Link to="/quickbuy/groups" className="text-xs text-emerald-600 hover:underline">查看全部 →</Link>
        </div>
        {groups.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">暂无进行中的团购</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {groups.slice(0, 4).map((g) => (
              <Link key={g.id} to="/quickbuy/groups" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/40">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  {g.cover_image_url ? <img src={g.cover_image_url} className="h-full w-full rounded-lg object-cover" alt="" /> : <Package2 className="h-5 w-5" />}
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

function CompareCard({ title, pros, dim }: { title: string; pros: string[]; dim?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-5 ${dim ? "opacity-70" : ""}`}>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1.5 text-sm">
        {pros.map((p) => (
          <li key={p} className="flex items-start gap-2 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, icon: Icon, title, desc }: { n: number; icon: typeof Sparkles; title: string; desc: string }) {
  return (
    <div className="relative rounded-xl border bg-card p-4">
      <div className="absolute -top-2 left-3 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">{n}</div>
      <Icon className="mb-2 h-5 w-5 text-emerald-600" />
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}

function Capability({ icon: Icon, title, desc, highlight }: { icon: typeof Zap; title: string; desc: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50" : "bg-card"}`}>
      <Icon className={`mb-2 h-5 w-5 ${highlight ? "text-amber-600" : "text-emerald-600"}`} />
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
