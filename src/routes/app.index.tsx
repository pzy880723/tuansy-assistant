import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, MoreHorizontal, Pencil, ImageIcon, Sparkles, Shield } from "lucide-react";
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
  deleteProject,
  listProjects,
  updateProjectMeta,
} from "@/lib/projects.functions";
import { listPendingInboxCounts } from "@/lib/inbox.functions";
import { clearAuthCookies, notifyAuthChange, setAuthSessionError, useCurrentUser } from "@/lib/use-current-user";
import { ProjectStarter } from "@/components/project-starter";
import { Smartphone, Inbox } from "lucide-react";

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
  const update = useServerFn(updateProjectMeta);
  const del = useServerFn(deleteProject);
  const router = useRouter();
  const qc = useQueryClient();

  const [editProject, setEditProject] = useState<ProjectRow | null>(null);

  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => list(),
    retry: false,
  });

  const countsFn = useServerFn(listPendingInboxCounts);
  const { data: counts } = useQuery({
    queryKey: ["inbox-pending-counts"],
    queryFn: () => countsFn(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const resetAndLogin = () => {
    const message = "登录会话已失效，请重新登录一次。";
    clearAuthCookies();
    setAuthSessionError(message);
    notifyAuthChange();
    router.navigate({ to: "/auth", replace: true, search: { redirect: "/app" } });
  };

  const updateMut = useMutation({
    mutationFn: async (input: { id: string; name: string; product_name: string }) =>
      update({ data: input }),
    onSuccess: () => {
      toast.success("已保存");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditProject(null);
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

  const me = useCurrentUser();

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      {me?.isAdmin && (
        <div className="mb-6 flex justify-end">
          <Link
            to="/admin"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium text-primary transition hover:bg-primary/5"
          >
            <Shield className="h-3.5 w-3.5" /> 进入管理后台
          </Link>
        </div>
      )}
      {/* Starter — the main entry point, like Lovable dashboard */}
      <section className="text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-[oklch(0.7_0.19_45)]" />
          团宝在线，准备开团
        </div>
        <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight md:text-5xl">
          想开一场什么<span className="text-gradient-brand">团</span>？
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-balance text-sm text-muted-foreground md:text-base">
          写一句话或丢几张商品图，团宝会自动识别品类，帮你建好项目并打开工作台。
        </p>
      </section>

      <div className="mt-8">
        <ProjectStarter
          variant="light"
          authRedirect="/app"
          placeholder="例如：云南阳光玫瑰，2 斤 39.9 / 5 斤 88，产地直发顺丰冷链 —— 或者直接拖几张商品图过来"
        />
      </div>

      {/* 手机收料台入口 + 未读总数 */}
      <MobileInboxBanner total={counts?.total ?? 0} unassigned={counts?.unassigned ?? 0} />

      {/* Existing projects */}
      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-lg font-semibold">最近项目</h2>
          {!isLoading && !isError && projects.length > 0 && (
            <span className="text-xs text-muted-foreground">共 {projects.length} 个</span>
          )}
        </div>

        {isLoading ? (
          <SkeletonGrid />
        ) : isError ? (
          <SessionIssue
            message={error instanceof Error ? error.message : "项目列表加载失败"}
            onReset={resetAndLogin}
          />
        ) : projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                pendingCount={counts?.byProject?.[p.id] ?? 0}
                onEdit={() => setEditProject(p)}
                onDelete={() => delMut.mutate(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      <ProjectMetaDialog
        open={editProject !== null}
        onOpenChange={(o) => !o && setEditProject(null)}
        initialName={editProject?.name ?? ""}
        initialProductName={editProject?.product_name ?? ""}
        pending={updateMut.isPending}
        onSubmit={(values) => {
          if (editProject) {
            updateMut.mutate({ id: editProject.id, ...values });
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
      还没有项目。在上方输入框写一句话，团宝会帮你开第一场团。
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日发布`;
}

function MobileInboxBanner({ total, unassigned }: { total: number; unassigned: number }) {
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/m/inbox` : "/m/inbox";
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=${encodeURIComponent(url)}`;
  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-[#fff7ed] to-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <img src={qr} alt="扫码打开手机收料台" className="h-[110px] w-[110px] shrink-0 rounded-xl bg-white p-1.5 shadow" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Smartphone className="h-4 w-4 text-[oklch(0.7_0.19_45)]" />
            手机收料台
            {total > 0 && (
              <span className="inline-flex h-5 items-center rounded-full bg-red-500 px-2 text-[11px] font-semibold text-white">
                <Inbox className="mr-0.5 h-3 w-3" />
                {total} 条待处理
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            扫码后把链接保存到主屏幕。供应商在群里随手丢的图、文字、链接，长按复制后到收料台一粘 → 团宝在电脑端自动收到并生成新版文案。
          </p>
          {unassigned > 0 && (
            <p className="mt-1 text-[12px] text-orange-600">
              其中 {unassigned} 条还没指定项目，到电脑端打开任意项目后可以认领。
            </p>
          )}
          <a
            href="/m/inbox"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex h-7 items-center gap-1 rounded-full border bg-white px-3 text-[12px] text-foreground hover:bg-muted"
          >
            在本机打开预览 →
          </a>
        </div>
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  pendingCount,
  onEdit,
  onDelete,
}: {
  project: ProjectRow;
  pendingCount: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const slots = [0, 1, 2];
  return (
    <div className="group relative rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_40px_-20px_oklch(0.7_0.19_45/0.35)]">
      {pendingCount > 0 && (
        <div
          className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 px-1.5 text-[11px] font-semibold text-white shadow-[0_4px_12px_-2px_rgba(239,68,68,0.5)]"
          title={`手机端新发来了 ${pendingCount} 条素材`}
        >
          {pendingCount > 99 ? "99+" : pendingCount}
        </div>
      )}
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
  initialName,
  initialProductName,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  initialProductName: string;
  pending: boolean;
  onSubmit: (values: { name: string; product_name: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [productName, setProductName] = useState(initialProductName);

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
          <DialogTitle>编辑项目信息</DialogTitle>
          <DialogDescription>修改团购标题或商品名称。</DialogDescription>
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
            {pending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
