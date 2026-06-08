import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "设置 — 团宝助手" }] }),
  component: () => (
    <AppShell>
      <h1 className="mb-2 text-2xl font-bold">设置</h1>
      <p className="text-sm text-muted-foreground">运费模板等设置即将上线。</p>
    </AppShell>
  ),
});
