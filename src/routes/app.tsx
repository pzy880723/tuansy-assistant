import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Package, Chrome, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "工作台 — 团宝助手" }] }),
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <Outlet />
    </div>
  );
}

function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = [
    { to: "/app", label: "项目", icon: Package, match: (p: string) => p === "/app" || p.startsWith("/app/project") },
    { to: "/extension", label: "Chrome 插件", icon: Chrome, match: (p: string) => p === "/extension" },
    { to: "/settings", label: "设置", icon: SettingsIcon, match: (p: string) => p === "/settings" },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-sm font-bold text-white shadow-[0_4px_12px_oklch(0.7_0.19_45/0.45)]">
            团
          </span>
          <span className="font-semibold tracking-tight">团宝助手</span>
        </Link>
        <nav className="ml-2 flex items-center gap-1">
          {nav.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm transition",
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
      </div>
    </header>
  );
}
