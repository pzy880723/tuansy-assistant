import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "团宝助手 — 项目列表" },
      { name: "description", content: "团宝助手：一键从文案到快团团商品上架" },
    ],
  }),
  component: Index,
});

function Index() {
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
      router.navigate({ to: "/project/$id", params: { id } });
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
    <AppShell
      right={
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} size="sm">
          <Plus className="h-4 w-4" /> 新建项目
        </Button>
      }
    >
      <h1 className="mb-4 text-2xl font-bold tracking-tight">我的项目</h1>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">加载中…</div>
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => createMut.mutate()} loading={createMut.isPending} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDelete={() => delMut.mutate(p.id)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ onCreate, loading }: { onCreate: () => void; loading: boolean }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand-soft)]">
        <Package className="h-7 w-7 text-primary" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">还没有项目</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        创建第一个团购项目，上传图片+粘贴文案，让 AI 一键生成完整商品信息
      </p>
      <Button className="mt-5" onClick={onCreate} disabled={loading}>
        <Plus className="h-4 w-4" /> 创建第一个项目
      </Button>
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

function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectRow;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="group relative overflow-hidden p-0">
      <Link
        to="/project/$id"
        params={{ id: project.id }}
        className="block"
      >
        <div className="aspect-[4/3] bg-[var(--brand-soft)]">
          {project.cover_image_url ? (
            <img
              src={project.cover_image_url}
              alt={project.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-primary/60">
              <Package className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="truncate font-medium">{project.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {new Date(project.updated_at).toLocaleString("zh-CN")}
          </div>
        </div>
      </Link>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <button
            className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
            onClick={(e) => e.stopPropagation()}
            aria-label="删除"
          >
            <Trash2 className="h-4 w-4" />
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
    </Card>
  );
}
