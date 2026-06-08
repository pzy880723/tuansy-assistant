import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/extension")({
  head: () => ({ meta: [{ title: "Chrome 插件 — 团宝助手" }] }),
  component: () => (
    <AppShell>
      <h1 className="mb-2 text-2xl font-bold">Chrome 插件</h1>
      <p className="text-sm text-muted-foreground">即将上线：下载 .zip 并加载到 chrome://extensions。</p>
    </AppShell>
  ),
});
