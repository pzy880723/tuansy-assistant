import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Users, FolderKanban, FileText, Sparkles } from "lucide-react";
import { getAdminStats, getCopyTrend } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const stats = useServerFn(getAdminStats);
  const trend = useServerFn(getCopyTrend);
  const s = useQuery({ queryKey: ["admin-stats"], queryFn: () => stats() });
  const t = useQuery({ queryKey: ["admin-trend"], queryFn: () => trend() });

  const data = s.data;
  const trendData = t.data?.trend ?? [];
  const max = Math.max(1, ...trendData.map((d) => d.count));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-xl font-bold tracking-tight">仪表盘</h1>
      <p className="mt-1 text-xs text-muted-foreground">全平台数据概览</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="总用户" value={data?.totalUsers ?? "—"} icon={Users} />
        <StatCard label="总项目" value={data?.totalProjects ?? "—"} icon={FolderKanban} />
        <StatCard label="文案版本数" value={data?.totalCopies ?? "—"} icon={FileText} />
        <StatCard label="近 7 日新增用户" value={data?.newUsers7d ?? "—"} icon={Sparkles} />
      </div>

      <section className="mt-8 rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold">近 30 天文案生成数</div>
            <div className="text-[11px] text-muted-foreground">
              每日新增 copy_versions
            </div>
          </div>
        </div>
        <div className="flex h-48 items-end gap-0.5">
          {trendData.map((d) => (
            <div
              key={d.day}
              className="group relative flex-1 rounded-t bg-primary/20 transition hover:bg-primary/60"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }}
              title={`${d.day}: ${d.count}`}
            >
              <span className="absolute left-1/2 top-full mt-1 hidden -translate-x-1/2 text-[10px] text-muted-foreground group-hover:block">
                {d.day} · {d.count}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{trendData[0]?.day}</span>
          <span>{trendData[trendData.length - 1]?.day}</span>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
