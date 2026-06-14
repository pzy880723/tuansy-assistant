import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListSmsLogs, type AdminSmsRow } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/sms")({
  component: SmsLogsPage,
});

const PAGE_SIZE = 30;

const STATUS_TABS = [
  { id: "all", label: "全部" },
  { id: "delivered", label: "已送达" },
  { id: "failed", label: "未送达" },
  { id: "sending", label: "发送中" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["id"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    delivered: { label: "已送达", cls: "bg-emerald-100 text-emerald-700" },
    failed: { label: "未送达", cls: "bg-rose-100 text-rose-700" },
    sending: { label: "发送中", cls: "bg-amber-100 text-amber-700" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", v.cls)}>
      {v.label}
    </span>
  );
}

function maskPhone(p: string) {
  if (p.length !== 11) return p;
  return `${p.slice(0, 3)}****${p.slice(7)}`;
}

function SmsLogsPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useServerFn(adminListSmsLogs);
  const q = useQuery({
    queryKey: ["admin-sms", status, appliedSearch, page],
    queryFn: () =>
      list({ data: { status, search: appliedSearch || undefined, page, pageSize: PAGE_SIZE } }),
  });

  const rows = (q.data?.rows ?? []) as AdminSmsRow[];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stats = q.data?.stats24h;
  const deliveryRate =
    stats && stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">短信发送日志</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            通过腾讯云回执回调实时记录每条验证码的实际到达情况
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={() => q.refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="近 24h 发送" value={stats?.total ?? "—"} />
        <StatCard label="已送达" value={stats?.delivered ?? "—"} accent="text-emerald-600" />
        <StatCard label="未送达" value={stats?.failed ?? "—"} accent="text-rose-600" />
        <StatCard
          label="到达率"
          value={deliveryRate == null ? "—" : `${deliveryRate}%`}
          accent="text-primary"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setStatus(t.id);
                setPage(1);
              }}
              className={cn(
                "rounded px-3 py-1.5 text-xs transition",
                status === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearch(search.trim());
            setPage(1);
          }}
        >
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索手机号"
              className="h-8 w-48 pl-7 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="h-8">
            搜索
          </Button>
        </form>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">手机号</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">运营商回执</th>
              <th className="px-3 py-2 text-left font-medium">发送时间</th>
              <th className="px-3 py-2 text-left font-medium">到达时间</th>
              <th className="px-3 py-2 text-left font-medium">已使用</th>
              <th className="px-3 py-2 text-left font-medium">SerialNo</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!q.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-xs text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 text-xs font-mono">{maskPhone(r.phone)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.delivery_status} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.delivery_code ? (
                    <div>
                      <div className="font-mono">{r.delivery_code}</div>
                      {r.delivery_message && (
                        <div className="text-[10px] text-muted-foreground">
                          {r.delivery_message}
                        </div>
                      )}
                    </div>
                  ) : r.error_message ? (
                    <span className="text-rose-600">{r.error_message}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString().slice(0, 16)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.delivered_at
                    ? new Date(r.delivered_at).toLocaleString().slice(0, 16)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.consumed_at ? (
                    <span className="text-emerald-600">已验证</span>
                  ) : (
                    <span className="text-muted-foreground">未使用</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {r.provider_request_id ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>
          第 {page} / {totalPages} 页 · 共 {total} 条
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", accent)}>{value}</div>
    </div>
  );
}
