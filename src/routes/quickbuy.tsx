import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";
import { useCurrentUser } from "@/lib/use-current-user";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssistantPanel } from "@/components/quickbuy/AssistantPanel";

export const Route = createFileRoute("/quickbuy")({
  head: () => ({ meta: [{ title: "团宝速购 — 轻量级开团交易工具" }] }),
  component: QuickBuyLayout,
});

type SidebarSize = "expanded" | "icon";
type SidebarMode = "menu" | "ai";

const SIZE_KEY = "quickbuy.sidebar.size";
const MODE_KEY = "quickbuy.sidebar.mode";
const WIDTH_KEY = "quickbuy.sidebar.width";
const ICON_WIDTH = 56;
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;

function QuickBuyLayout() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hydrated, setHydrated] = useState(false);
  const [size, setSize] = useState<SidebarSize>("expanded");
  const [mode, setMode] = useState<SidebarMode>("menu");
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH);

  useEffect(() => {
    setHydrated(true);
    const s = localStorage.getItem(SIZE_KEY);
    const m = localStorage.getItem(MODE_KEY);
    const w = Number(localStorage.getItem(WIDTH_KEY));
    if (s === "expanded" || s === "icon") setSize(s);
    if (m === "menu" || m === "ai") setMode(m);
    if (Number.isFinite(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) setWidth(w);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(SIZE_KEY, size); }, [size, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(MODE_KEY, mode); }, [mode, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(WIDTH_KEY, String(width)); }, [width, hydrated]);

  useEffect(() => {
    if (hydrated && user === null) {
      navigate({ to: "/auth", replace: true, search: { redirect: pathname } });
    }
  }, [hydrated, user, navigate, pathname]);

  const cycleCollapse = () => setSize((s) => (s === "expanded" ? "icon" : "expanded"));

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/40 via-background to-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
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
            width={width}
            onSize={setSize}
            onMode={setMode}
            onWidth={setWidth}
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
  width,
  onSize,
  onMode,
  onWidth,
  onCycle,
}: {
  pathname: string;
  size: SidebarSize;
  mode: SidebarMode;
  width: number;
  onSize: (s: SidebarSize) => void;
  onMode: (m: SidebarMode) => void;
  onWidth: (w: number) => void;
  onCycle: () => void;
}) {
  const isIcon = size === "icon";
  const asideRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startW + dx));
    onWidth(next);
  }, [onWidth]);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDrag);
  }, [handlePointerMove]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
  };

  useEffect(() => () => stopDrag(), [stopDrag]);

  return (
    <aside
      ref={asideRef}
      style={{ width: isIcon ? ICON_WIDTH : width }}
      className="sticky top-20 hidden h-[calc(100vh-6rem)] shrink-0 overflow-visible rounded-2xl border bg-card md:flex md:flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        {/* Header: mode switcher + collapse */}
        <div className={cn("flex items-center gap-1 border-b p-2", isIcon && "flex-col")}>
          {isIcon ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { onMode(mode === "ai" ? "menu" : "ai"); onSize("expanded"); }}
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
            <AssistantPanel compact={width < 320} />
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
      </div>

      {/* Resize handle (only when expanded) */}
      {!isIcon && (
        <div
          onPointerDown={startDrag}
          onDoubleClick={() => onWidth(DEFAULT_WIDTH)}
          title="拖动调整宽度（双击重置）"
          className="group absolute right-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize"
        >
          <div className="ml-[2px] h-full w-[2px] bg-transparent transition-colors group-hover:bg-emerald-500/40" />
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
