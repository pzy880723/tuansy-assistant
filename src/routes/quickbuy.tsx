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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssistantPanel } from "@/components/quickbuy/AssistantPanel";

export const Route = createFileRoute("/quickbuy")({
  head: () => ({ meta: [{ title: "团宝速购 — 轻量级开团交易工具" }] }),
  component: QuickBuyLayout,
});

type SidebarSize = "expanded" | "icon" | "hidden";
type SidebarMode = "menu" | "ai";

const SIZE_KEY = "quickbuy.sidebar.size";
const MODE_KEY = "quickbuy.sidebar.mode";

function QuickBuyLayout() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hydrated, setHydrated] = useState(false);
  const [size, setSize] = useState<SidebarSize>("expanded");
  const [mode, setMode] = useState<SidebarMode>("menu");

  useEffect(() => {
    setHydrated(true);
    const s = (localStorage.getItem(SIZE_KEY) as SidebarSize | null);
    const m = (localStorage.getItem(MODE_KEY) as SidebarMode | null);
    if (s === "expanded" || s === "icon" || s === "hidden") setSize(s);
    if (m === "menu" || m === "ai") setMode(m);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(SIZE_KEY, size); }, [size, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(MODE_KEY, mode); }, [mode, hydrated]);

  useEffect(() => {
    if (hydrated && user === null) {
      navigate({ to: "/auth", replace: true, search: { redirect: pathname } });
    }
  }, [hydrated, user, navigate, pathname]);

  const toggleSize = () => {
    if (size === "expanded") setSize("hidden");
    else setSize("expanded");
  };
  const cycleCollapse = () => {
    setSize((s) => (s === "expanded" ? "icon" : "expanded"));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/40 via-background to-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleSize} title={size === "hidden" ? "显示侧栏" : "隐藏侧栏"}>
            {size === "hidden" ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <Link to="/quickbuy" className="flex shrink-0 items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-sm">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
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
          <Sidebar
            pathname={pathname}
            size={size}
            mode={mode}
            onSize={setSize}
            onMode={setMode}
            onCycle={cycleCollapse}
          />
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

const menuItems = [
  { to: "/quickbuy/home", label: "工作台", icon: Home },
  { to: "/quickbuy/groups", label: "我的开团", icon: Rocket },
  { to: "/quickbuy/orders", label: "订单管理", icon: Package2 },
  { to: "/quickbuy/customers", label: "客户", icon: Users },
  { to: "/quickbuy/finance", label: "资金分润", icon: Wallet, badge: "敬请期待" as const },
] as const;

function Sidebar({
  pathname,
  size,
  mode,
  onSize,
  onMode,
  onCycle,
}: {
  pathname: string;
  size: SidebarSize;
  mode: SidebarMode;
  onSize: (s: SidebarSize) => void;
  onMode: (m: SidebarMode) => void;
  onCycle: () => void;
}) {
  if (size === "hidden") return null;

  const width = size === "icon" ? "w-14" : "w-64";
  const isIcon = size === "icon";

  return (
    <aside
      className={cn(
        "sticky top-20 hidden h-[calc(100vh-6rem)] shrink-0 overflow-hidden rounded-2xl border bg-card transition-all duration-200 md:flex md:flex-col",
        width,
      )}
    >
      {/* Header: mode switcher + collapse */}
      <div className={cn("flex items-center gap-1 border-b p-2", isIcon && "flex-col")}>
        {isIcon ? (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { onMode(mode === "ai" ? "menu" : "ai"); if (size === "icon") onSize("expanded"); }}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg",
                      mode === "ai" ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white" : "bg-emerald-500/10 text-emerald-700",
                    )}
                  >
                    {mode === "ai" ? <Bot className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{mode === "ai" ? "切换到菜单" : "切换到 AI 助手"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button onClick={onCycle} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted" title="展开">
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-1 items-center gap-0.5 rounded-lg bg-muted p-0.5 text-xs">
              <button
                onClick={() => onMode("menu")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 transition",
                  mode === "menu" ? "bg-background font-medium text-emerald-700 shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="h-3 w-3" /> 菜单
              </button>
              <button
                onClick={() => onMode("ai")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 transition",
                  mode === "ai" ? "bg-gradient-to-r from-amber-500 to-orange-500 font-medium text-white shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Bot className="h-3 w-3" /> AI
              </button>
            </div>
            <button onClick={onCycle} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted" title="折叠">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "menu" ? (
          <MenuList pathname={pathname} isIcon={isIcon} />
        ) : isIcon ? (
          <button
            onClick={() => onSize("expanded")}
            className="m-2 grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow"
            title="展开 AI 助手"
          >
            <Bot className="h-5 w-5" />
          </button>
        ) : (
          <AssistantPanel compact />
        )}
      </div>

      {/* Footer link to assistant app */}
      {mode === "menu" && !isIcon && (
        <div className="border-t p-2">
          <Link
            to="/app"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <PenLine className="h-3.5 w-3.5" />
            去团宝助手写文案
            <ExternalLink className="ml-auto h-3 w-3" />
          </Link>
        </div>
      )}
    </aside>
  );
}

function MenuList({ pathname, isIcon }: { pathname: string; isIcon: boolean }) {
  return (
    <nav className="space-y-1 p-2">
      {menuItems.map((it) => {
        const active = pathname === it.to || pathname.startsWith(it.to + "/");
        const node = (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
              active
                ? "bg-gradient-to-r from-emerald-500/15 to-green-600/10 font-medium text-emerald-700"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              isIcon && "justify-center px-0",
            )}
            title={isIcon ? it.label : undefined}
          >
            <it.icon className="h-4 w-4 shrink-0" />
            {!isIcon && <span className="truncate">{it.label}</span>}
            {!isIcon && "badge" in it && it.badge && (
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {it.badge}
              </span>
            )}
          </Link>
        );
        if (isIcon) {
          return (
            <TooltipProvider key={it.to}>
              <Tooltip>
                <TooltipTrigger asChild>{node}</TooltipTrigger>
                <TooltipContent side="right">{it.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return node;
      })}
    </nav>
  );
}
