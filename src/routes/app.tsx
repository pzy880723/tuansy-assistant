import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Chrome, Package, Settings as SettingsIcon, ShoppingBag } from "lucide-react";
import { getProject, updateProject } from "@/lib/projects.functions";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { useCurrentUser } from "@/lib/use-current-user";
import { SyncToKttButton } from "@/components/tuan/SyncToKttButton";
import { AssetLibraryButton } from "@/components/tuan/AssetLibrarySheet";
import { QuickBuyButton } from "@/components/tuan/QuickBuyButton";

import logoHorizontal from "@/assets/logo-horizontal.png.asset.json";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "工作台 — 团宝助手" }] }),
  component: AppLayout,
});

function AppLayout() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Avoid SSR/CSR hydration mismatch: cookie-derived user is only readable on
  // the client, so render the same shell on both passes and only act on the
  // user value after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (hydrated && user === null) {
      navigate({ to: "/auth", replace: true, search: { redirect: pathname } });
    }
  }, [hydrated, user, navigate, pathname]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      {hydrated && user ? (
        <Outlet />
      ) : (
        <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">
          {hydrated ? "正在跳转登录…" : null}
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const projectMatch = pathname.match(/^\/app\/project\/([^/]+)\/?$/);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 md:h-16 md:gap-3 md:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-1.5">
          <img src={logoHorizontal.url} alt="团宝助手" className="h-10 w-auto md:h-14" />
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
    { to: "/app", label: "项目", icon: Package, match: (p: string) => p === "/app" || p.startsWith("/app/project"), highlight: false },
    { to: "/quickbuy", label: "团宝速购", icon: ShoppingBag, match: (p: string) => p.startsWith("/quickbuy"), highlight: true },
    { to: "/extension", label: "Chrome 插件", icon: Chrome, match: (p: string) => p === "/extension", highlight: false },
    { to: "/settings", label: "设置", icon: SettingsIcon, match: (p: string) => p === "/settings", highlight: false },
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
              n.highlight && !active && "bg-gradient-to-r from-emerald-500/15 to-green-600/15 text-emerald-700 hover:from-emerald-500/25 hover:to-green-600/25",
              n.highlight && active && "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm",
              !n.highlight && active && "bg-[var(--brand-soft)] text-primary",
              !n.highlight && !active && "text-muted-foreground hover:text-foreground",
            )}
          >
            <n.icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{n.label}</span>
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
      <AssetLibraryButton projectId={id} />
      <QuickBuyButton projectId={id} />
      <SyncToKttButton projectId={id} projectName={name} />
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
