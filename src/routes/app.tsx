import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Chrome, ExternalLink, Package, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth.functions";
import { getProject, updateProject } from "@/lib/projects.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { clearAuthCookies, notifyAuthChange, useCurrentUser } from "@/lib/use-current-user";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "工作台 — 团宝助手" }] }),
  component: AppLayout,
});

function AppLayout() {
  const user = useCurrentUser();
  const currentUser = useServerFn(getCurrentUser);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useQuery({
    queryKey: ["current-user-session", user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const res = await currentUser();
      if (!res.user) {
        clearAuthCookies();
        notifyAuthChange();
        toast.error("登录会话已失效，请重新登录一次");
        navigate({ to: "/auth", replace: true, search: { redirect: pathname } });
      }
      return res;
    },
  });

  useEffect(() => {
    if (user === null) {
      navigate({ to: "/auth", replace: true, search: { redirect: pathname } });
    }
  }, [user, navigate, pathname]);

  if (!user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">正在跳转登录…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <Outlet />
    </div>
  );
}

function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projectMatch = pathname.match(/^\/app\/project\/([^/]+)\/?$/);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-11 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-[11px] font-bold text-white shadow-[0_3px_10px_oklch(0.7_0.19_45/0.4)]">
            团
          </span>
          <span className="text-sm font-semibold tracking-tight">团宝助手</span>
        </Link>
        {projectMatch ? (
          <ProjectInlineHeader id={projectMatch[1]} />
        ) : (
          <GlobalNav pathname={pathname} />
        )}
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function GlobalNav({ pathname }: { pathname: string }) {
  const nav = [
    { to: "/app", label: "项目", icon: Package, match: (p: string) => p === "/app" || p.startsWith("/app/project") },
    { to: "/extension", label: "Chrome 插件", icon: Chrome, match: (p: string) => p === "/extension" },
    { to: "/settings", label: "设置", icon: SettingsIcon, match: (p: string) => p === "/settings" },
  ] as const;
  return (
    <nav className="ml-2 flex items-center gap-1">
      {nav.map((n) => {
        const active = n.match(pathname);
        return (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition",
              active
                ? "bg-[var(--brand-soft)] text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <n.icon className="h-3.5 w-3.5" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ProjectInlineHeader({ id }: { id: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getProject);
  const update = useServerFn(updateProject);

  const { data } = useQuery({
    queryKey: ["project", id],
    queryFn: () => get({ data: { id } }),
  });

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState<"idle" | "saving" | "saved">("idle");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedId = useRef<string | null>(null);

  useEffect(() => {
    if (data?.project && lastSyncedId.current !== data.project.id) {
      setName(data.project.name);
      lastSyncedId.current = data.project.id;
    }
  }, [data?.project]);

  const updateMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) => update({ data: { id, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const handleNameChange = (v: string) => {
    setName(v);
    setSavingName("saving");
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      await updateMut.mutateAsync({ name: v || "未命名项目" });
      setSavingName("saved");
      setTimeout(() => setSavingName("idle"), 1500);
    }, 600);
  };

  return (
    <>
      <div className="h-4 w-px bg-border" />
      <Link
        to="/app"
        className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="返回项目列表"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 项目
      </Link>
      <input
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
        placeholder="未命名项目"
      />
      <SaveBadge state={savingName} />
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-full px-3 text-xs"
        onClick={() => toast.info("同步导出页即将上线")}
      >
        <ExternalLink className="h-3.5 w-3.5" /> 同步到快团团
      </Button>
    </>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      {state === "saving" ? (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> 保存中
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-[oklch(0.65_0.18_145)]" /> 已保存
        </>
      )}
    </span>
  );
}
