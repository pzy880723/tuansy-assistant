import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  Rocket,
  Package2,
  Users,
  Wallet,
  Bot,
  PenLine,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { useCurrentUser } from "@/lib/use-current-user";

export const Route = createFileRoute("/quickbuy")({
  head: () => ({ meta: [{ title: "团宝速购 — 轻量级开团交易工具" }] }),
  component: QuickBuyLayout,
});

function QuickBuyLayout() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (hydrated && user === null) {
      navigate({ to: "/auth", replace: true, search: { redirect: pathname } });
    }
  }, [hydrated, user, navigate, pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/40 via-background to-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Link to="/quickbuy" className="flex shrink-0 items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-sm">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">团宝速购</span>
              <span className="text-[10px] text-muted-foreground">轻量级开团交易工具</span>
            </div>
          </Link>
          <Link
            to="/app"
            className="ml-3 hidden items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted md:inline-flex"
          >
            ← 返回团宝助手
          </Link>
          <div className="ml-auto"><UserMenu /></div>
        </div>
      </header>

      {hydrated && user ? (
        <div className="mx-auto flex max-w-7xl gap-4 px-4 py-6">
          <Sidebar pathname={pathname} />
          <main className="min-w-0 flex-1"><Outlet /></main>
        </div>
      ) : (
        <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">
          {hydrated ? "正在跳转登录…" : null}
        </div>
      )}
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const items = [
    { to: "/quickbuy/home", label: "工作台", icon: Home },
    { to: "/quickbuy/groups", label: "我的开团", icon: Rocket },
    { to: "/quickbuy/orders", label: "订单管理", icon: Package2 },
    { to: "/quickbuy/customers", label: "客户", icon: Users },
    { to: "/quickbuy/finance", label: "资金分润", icon: Wallet, badge: "敬请期待" },
  ] as const;
  return (
    <aside className="sticky top-20 hidden h-fit w-52 shrink-0 space-y-1 md:block">
      {items.map((it) => {
        const active = pathname === it.to || pathname.startsWith(it.to + "/");
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
              active
                ? "bg-gradient-to-r from-emerald-500/15 to-green-600/10 font-medium text-emerald-700"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <it.icon className="h-4 w-4" />
            <span>{it.label}</span>
            {"badge" in it && it.badge && (
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
      <div className="my-3 border-t" />
      <Link
        to="/quickbuy/assistant"
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
          pathname === "/quickbuy/assistant"
            ? "bg-gradient-to-r from-amber-500/15 to-orange-500/10 font-medium text-amber-700"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Bot className="h-4 w-4" />
        AI 助手
      </Link>
      <Link
        to="/app"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <PenLine className="h-4 w-4" />
        去团宝助手写文案
        <ExternalLink className="ml-auto h-3 w-3" />
      </Link>
    </aside>
  );
}
