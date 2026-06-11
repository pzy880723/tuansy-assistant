import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminListProjects, adminListCopyVersions } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

const PAGE_SIZE = 30;

function AuditPage() {
  const [tab, setTab] = useState<"projects" | "copies">("projects");
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-xl font-bold tracking-tight">审计日志</h1>
      <p className="mt-1 text-xs text-muted-foreground">只读的项目与文案记录</p>

      <div className="mt-4 inline-flex rounded-md border bg-card p-0.5">
        {[
          { id: "projects" as const, label: "项目列表" },
          { id: "copies" as const, label: "文案记录" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded px-3 py-1.5 text-xs transition",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "projects" ? <ProjectsTable /> : <CopiesTable />}
      </div>
    </div>
  );
}

function ProjectsTable() {
  const [page, setPage] = useState(1);
  const list = useServerFn(adminListProjects);
  const q = useQuery({
    queryKey: ["admin-projects", page],
    queryFn: () => list({ data: { page, pageSize: PAGE_SIZE } }),
  });
  const rows = q.data?.projects ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">项目名</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">所有者</th>
              <th className="px-3 py-2 text-left font-medium">创建时间</th>
              <th className="px-3 py-2 text-left font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2 text-xs">{p.name}</td>
                <td className="px-3 py-2 text-xs">{p.status}</td>
                <td className="px-3 py-2 text-xs">
                  {p.owner ? `${p.owner.nickname} · ${p.owner.phone ?? "—"}` : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString().slice(0, 16)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(p.updated_at).toLocaleString().slice(0, 16)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}

function CopiesTable() {
  const [page, setPage] = useState(1);
  const list = useServerFn(adminListCopyVersions);
  const q = useQuery({
    queryKey: ["admin-copies", page],
    queryFn: () => list({ data: { page, pageSize: PAGE_SIZE } }),
  });
  const rows = q.data?.versions ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">版本标签</th>
              <th className="px-3 py-2 text-left font-medium">所属项目</th>
              <th className="px-3 py-2 text-left font-medium">所有者</th>
              <th className="px-3 py-2 text-left font-medium">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {rows.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="px-3 py-2 text-xs">{v.label ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{v.project?.name ?? v.project_id}</td>
                <td className="px-3 py-2 text-xs">
                  {v.owner ? `${v.owner.nickname} · ${v.owner.phone ?? "—"}` : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString().slice(0, 16)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} onChange={setPage} />
    </>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <span>
        第 {page} / {totalPages} 页
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </Button>
    </div>
  );
}
