import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, BookTemplate, FileText, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { to: "/admin/users", label: "用户管理", icon: Users },
  { to: "/admin/presets", label: "预设文案逻辑", icon: BookTemplate },
  { to: "/admin/audit", label: "审计日志", icon: FileText },
] as const;

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-card">
      <div className="flex h-12 items-center border-b px-4">
        <span className="text-sm font-semibold">团宝 · 管理后台</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {items.map((it) => {
          const active =
            pathname === it.to || pathname.startsWith(`${it.to}/`);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <Link
          to="/app"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回项目库
        </Link>
      </div>
    </aside>
  );
}
