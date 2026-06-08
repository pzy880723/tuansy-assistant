import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "设置 — 团宝助手" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-5">
          <Link to="/" className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> 首页
          </Link>
        </div>
      </div>
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="mt-3 text-sm text-muted-foreground">运费模板等设置即将上线。</p>
      </main>
    </div>
  );
}
