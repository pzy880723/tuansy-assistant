import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { createProject, deleteProject, listProjects } from "@/lib/projects.functions";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "我的项目 — 团宝助手" }] }),
  component: AppIndex,
});

function AppIndex() {
  const list = useServerFn(listProjects);
  const create = useServerFn(createProject);
  const del = useServerFn(deleteProject);
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: async () => create({ data: {} }),
    onSuccess: ({ id }) => {
      toast.success("已创建项目");
      qc.invalidateQueries({ queryKey: ["projects"] });
      router.navigate({ to: "/app/project/$id", params: { id } });
    },
    onError: (e) => toast.error(String(e)),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("已删除");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const projects = data?.projects ?? [];

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">我的项目</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            每个项目对应一场快团团团购，AI 帮你写完整流程。
          </p>
        </div>
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="brand-glow h-10 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] px-5 font-semibold text-white hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> 新建项目
        </Button>
      </div>

      {isLoading ? (
        <SkeletonGrid />
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => createMut.mutate()} loading={createMut.isPending} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={() => delMut.mutate(p.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border bg-card">
          <div className="aspect-[4/3] animate-pulse bg-muted" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate, loading }: { onCreate: () => void; loading: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed bg-gradient-to-b from-[var(--brand-soft)] to-card p-16 text-center">
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(closest-side,oklch(0.7_0.19_45/0.18),transparent)]" />
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-white shadow-[0_12px_32px_oklch(0.7_0.19_45/0.4)]">
          <Package className="h-7 w-7" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">开第一场团</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          上传商品图，告诉 AI 你想怎么卖，让团宝帮你生成完整的快团团内容。
        </p>
        <Button
          className="brand-glow mt-7 h-11 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] px-6 font-semibold text-white hover:brightness-110"
          onClick={onCreate}
          disabled={loading}
        >
          <Plus className="h-4 w-4" /> 创建第一个项目
        </Button>
      </div>
    </div>
  );
}

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  cover_image_url: string | null;
  updated_at: string;
};

function ProjectCard({ project, onDelete }: { project: ProjectRow; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_40px_-20px_oklch(0.7_0.19_45/0.35)]">
      <Link to="/app/project/$id" params={{ id: project.id }} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[var(--brand-soft)] to-muted">
          {project.cover_image_url ? (
            <img
              src={project.cover_image_url}
              alt={project.name}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-primary/40">
              <Package className="h-12 w-12" />
            </div>
          )}
          <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
            {project.status === "draft" ? "草稿" : project.status}
          </div>
        </div>
        <div className="p-4">
          <div className="truncate font-semibold">{project.name}</div>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(project.updated_at).toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </Link>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <button
            className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-background/95 text-muted-foreground opacity-0 shadow transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
            onClick={(e) => e.stopPropagation()}
            aria-label="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{project.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，项目内的图片、文案、SKU 都会一并删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
