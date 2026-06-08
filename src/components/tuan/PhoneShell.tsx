import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackButton } from "./primitives";

type Tab = "intro" | "product" | "settings";

export function PhoneShell({
  tab,
  onTabChange,
  showTopBar = true,
  header,
  children,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  showTopBar?: boolean;
  header?: ReactNode;
  children: ReactNode;
}) {
  const tabs: { v: Tab; label: string }[] = [
    { v: "intro", label: "介绍" },
    { v: "product", label: "商品" },
    { v: "settings", label: "设置" },
  ];

  return (
    <div className="mx-auto w-full max-w-[390px]">
      <div className="overflow-hidden rounded-[28px] border border-[#e5e6e8] bg-white shadow-[0_24px_50px_-20px_oklch(0_0_0/0.25)]">
        {/* Top bar with back + capsule */}
        <div className="relative flex items-center justify-between bg-white px-4 pb-2 pt-3">
          <BackButton />
          <div className="flex h-7 items-center gap-0 rounded-full bg-black/5 px-2 text-[11px] text-[#646566]">
            <span className="px-1.5">•••</span>
            <span className="h-3 w-px bg-[#c8c9cc]" />
            <span className="px-1.5">—</span>
            <span className="h-3 w-px bg-[#c8c9cc]" />
            <span className="px-1.5">○</span>
          </div>
        </div>

        {header}

        {/* Tab bar */}
        <div className="flex items-center justify-around border-b border-[#f0f1f2] bg-white px-2 py-2.5">
          {tabs.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => onTabChange(t.v)}
              className={cn(
                "relative px-4 py-1 text-[15px] transition",
                tab === t.v ? "font-semibold text-[#07c160]" : "text-[#1a1a1a]",
              )}
            >
              {t.label}
              {tab === t.v && (
                <span className="absolute -bottom-1 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded bg-[#07c160]" />
              )}
            </button>
          ))}
        </div>

        {/* Showable top bar above intro (background image + leader) is rendered via header prop on intro tab; for other tabs we still show tab bar only */}
        <div className="bg-[#f4f5f7]">{children}</div>

        {/* Bottom action bar */}
        <div className="grid grid-cols-2 gap-3 border-t border-[#f0f1f2] bg-white px-4 py-3">
          <button className="rounded-lg border border-[#07c160] py-2.5 text-[14px] font-medium text-[#07c160] transition active:bg-[#07c160]/5">
            保存并预览
          </button>
          <button className="rounded-lg bg-[#07c160] py-2.5 text-[14px] font-medium text-white shadow-[0_4px_12px_-2px_#07c16066] transition active:bg-[#06ad56]">
            发布团购
          </button>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        快团团 · 团长发团预览
      </p>
    </div>
  );
}

void showTopBar;
