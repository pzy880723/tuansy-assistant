import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Package, MoreHorizontal, Pencil, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProjectMeta,
} from "@/lib/projects.functions";
import { clearAuthCookies, notifyAuthChange, setAuthSessionError } from "@/lib/use-current-user";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "我的项目 — 团宝助手" }] }),
  component: AppIndex,
});

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  cover_image_url: string | null;
  product_name: string;
  updated_at: string;
  created_at: string;
  images: string[];
};

function AppIndex() {
  const list = useServerFn(listProjects);
  const create = useServerFn(createProject);
  const update = useServerFn(updateProjectMeta);
  const del = useServerFn(deleteProject);
  const router = useRouter();
  const qc = useQueryClient();

  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; project: ProjectRow } | null
  >(null);

  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => list(),
    retry: false,
  });

  const resetAndLogin = () => {
    const message = "登录会话已失效，请重新登录一次。";
    clearAuthCookies();
    setAuthSessionError(message);
    notifyAuthChange();
    router.navigate({ to: "/auth", replace: true, search: { redirect: "/app" } });
  };

  const createMut = useMutation({
    mutationFn: async (input: { name: string; product_name: string }) =>
      create({ data: input }),
    onSuccess: ({ id }) => {
      toast.success("已创建项目");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDialog(null);
      router.navigate({ to: "/app/project/$id", params: { id } });
    },
    onError: (e) => toast.error(String(e)),
  });

  const updateMut = useMutation({
    mutationFn: async (input: { id: string; name: string; product_name: string }) =>
      update({ data: input }),
    onSuccess: () => {
      toast.success("已保存");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDialog(null);
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

  const projects = (data?.projects ?? []) as ProjectRow[];

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">我的项目</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            每个项目对应一场快团团团购。
          </p>
        </div>
        <Button
          onClick={() => setDialog({ mode: "create" })}
          className="brand-glow h-10 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] px-5 font-semibold text-white hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> 新建项目
        </Button>
      </div>

      {isLoading ? (
        <SkeletonGrid />
      ) : isError ? (
        <SessionIssue message={error instanceof Error ? error.message : "项目列表加载失败"} onReset={resetAndLogin} />
      ) : projects.length === 0 ? (
        <EmptyState onCreate={() => setDialog({ mode: "create" })} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => setDialog({ mode: "edit", project: p })}
              onDelete={() => delMut.mutate(p.id)}
            />
          ))}
        </div>
      )}

      <ProjectMetaDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        mode={dialog?.mode ?? "create"}
        initialName={dialog?.mode === "edit" ? dialog.project.name : ""}
        initialProductName={dialog?.mode === "edit" ? dialog.project.product_name : ""}
        pending={createMut.isPending || updateMut.isPending}
        onSubmit={(values) => {
          if (dialog?.mode === "edit") {
            updateMut.mutate({ id: dialog.project.id, ...values });
          } else {
            createMut.mutate(values);
          }
        }}
      />
    </main>
  );
}

function SessionIssue({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
      <h2 className="font-semibold">当前登录状态异常</h2>
      <p className="mt-2 leading-relaxed">{message || "请清理旧会话后重新登录一次。"}</p>
      <Button className="mt-4" variant="outline" onClick={onReset}>
        重新登录
      </Button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-dashed bg-gradient-to-b from-[var(--brand-soft)] to-card p-16 text-center">
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(closest-side,oklch(0.7_0.19_45/0.18),transparent)]" />
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-white shadow-[0_12px_32px_oklch(0.7_0.19_45/0.4)]">
          <Package className="h-7 w-7" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">开第一场团</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          上传商品图，告诉团宝你想怎么卖，团宝会帮你生成完整的快团团内容。
        </p>
        <Button
          className="brand-glow mt-7 h-11 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] px-6 font-semibold text-white hover:brightness-110"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" /> 创建第一个项目
        </Button>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日发布`;
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const slots = [0, 1, 2];
  return (
    <div className="group relative rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_40px_-20px_oklch(0.7_0.19_45/0.35)]">
      <Link
        to="/app/project/$id"
        params={{ id: project.id }}
        className="block"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 flex-1 text-[15px] font-semibold leading-snug">
            {project.name}
          </h3>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDate(project.created_at)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {slots.map((i) => {
            const url = project.images[i];
            return (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-lg bg-muted"
              >
                {url ? (
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground/40">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 truncate text-xs text-muted-foreground">
          {project.product_name || <span className="italic">未填写商品名称</span>}
        </div>
      </Link>

      <div className="absolute right-2.5 top-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="grid h-7 w-7 place-items-center rounded-full bg-background/95 text-muted-foreground opacity-0 shadow transition group-hover:opacity-100 hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
              aria-label="操作"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => onEdit()}>
              <Pencil className="h-3.5 w-3.5" /> 编辑信息
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setConfirmOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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

function ProjectMetaDialog({
  open,
  onOpenChange,
  mode,
  initialName,
  initialProductName,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialName: string;
  initialProductName: string;
  pending: boolean;
  onSubmit: (values: { name: string; product_name: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [productName, setProductName] = useState(initialProductName);

  // reset state when dialog opens with new initial values
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(initialName);
      setProductName(initialProductName);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "编辑项目信息" : "新建项目"}</DialogTitle>
          <DialogDescription>
            填写团购标题和商品名称，稍后可在编辑器中继续完善。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">团购标题</Label>
            <Input
              id="title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：口碑王👑袜中爱马仕‼️"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product">商品名称</Label>
            <Input
              id="product"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="例如：日本 ZoeJenko 隐形船袜"
              maxLength={120}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={() =>
              onSubmit({ name: name.trim() || "未命名项目", product_name: productName.trim() })
            }
            disabled={pending}
            className="bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-white hover:brightness-110"
          >
            {pending ? "保存中…" : mode === "edit" ? "保存" : "创建并进入编辑"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
