import { Link } from "@tanstack/react-router";
import { Package, Settings as SettingsIcon, Chrome } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({
  title,
  right,
  children,
  back,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  back?: { to: string; label?: string };
}) {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          {back ? (
            <Link
              to={back.to}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← {back.label ?? "返回"}
            </Link>
          ) : (
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
                团
              </span>
              <span className="font-semibold tracking-tight">团宝助手</span>
            </Link>
          )}
          <div className="flex-1 truncate text-center text-sm font-medium md:text-left md:ml-4">
            {title}
          </div>
          <div className="flex items-center gap-2">{right}</div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <MobileNav />
    </div>
  );
}

function MobileNav() {
  const items = [
    { to: "/", icon: Package, label: "项目" },
    { to: "/extension", icon: Chrome, label: "插件" },
    { to: "/settings", icon: SettingsIcon, label: "设置" },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground",
              "[&.active]:text-primary",
            )}
            activeProps={{ className: "active" }}
          >
            <it.icon className="h-5 w-5" />
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
