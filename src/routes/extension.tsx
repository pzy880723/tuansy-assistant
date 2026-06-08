import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Chrome, Download } from "lucide-react";

export const Route = createFileRoute("/extension")({
  head: () => ({ meta: [{ title: "Chrome 插件 — 团宝助手" }] }),
  component: ExtensionPage,
});

function ExtensionPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-5">
          <Link to="/" className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> 首页
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-white shadow-[0_12px_32px_oklch(0.7_0.19_45/0.4)]">
          <Chrome className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Chrome 插件</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          安装后，团宝可以直接把项目内容一键写入快团团网页表单 —
          再也不用复制粘贴。
        </p>
        <button
          disabled
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-muted px-6 text-sm font-semibold text-muted-foreground"
        >
          <Download className="h-4 w-4" /> 即将上线
        </button>
      </main>
    </div>
  );
}
