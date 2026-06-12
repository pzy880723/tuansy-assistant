import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/use-current-user";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyLogicSection } from "@/components/copy-logic/CopyLogicSection";
import { listPresetCopyLogics, copyPresetToMine } from "@/lib/presets.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "设置 — 团宝助手" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (hydrated && user === null) {
      navigate({ to: "/auth", replace: true, search: { redirect: "/settings" } });
    }
  }, [hydrated, user, navigate]);
  if (!hydrated || !user) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">
        {hydrated ? "正在跳转登录…" : null}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5">
          <Link
            to="/app"
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 返回项目库
          </Link>
          <div className="text-sm font-medium">设置</div>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          维护团宝在撰写文案时遵循的逻辑模板，可自然语言描述也可逐模块编辑，双向同步。
        </p>
        <div className="mt-6 space-y-6">
          <CopyLogicSection />
          <PresetSection />
        </div>
      </main>
    </div>
  );
}

function PresetSection() {
  const list = useServerFn(listPresetCopyLogics);
  const copy = useServerFn(copyPresetToMine);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["preset-copy-logics"],
    queryFn: () => list(),
  });
  const presets = data?.presets ?? [];
  const [copying, setCopying] = useState<string | null>(null);

  const handleCopy = async (id: string) => {
    setCopying(id);
    try {
      await copy({ data: { presetId: id } });
      await qc.invalidateQueries({ queryKey: ["copy-logics"] });
      toast.success("已复制到我的文案逻辑，可以在上方编辑了");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "复制失败");
    } finally {
      setCopying(null);
    }
  };

  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b px-5 py-3">
        <div className="text-sm font-semibold">标准文案逻辑（行业模版）</div>
        <div className="text-[11px] text-muted-foreground">
          由团宝官方维护，只读；点「复制到我的」可基于模版微调成自己的版本
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
            加载中…
          </div>
        )}
        {!isLoading && presets.length === 0 && (
          <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
            暂无可用预设
          </div>
        )}
        {presets.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-lg border bg-background p-3"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                {p.industry || "通用"}
              </span>
              <span className="truncate text-sm font-medium">{p.name}</span>
            </div>
            <p className="mt-2 line-clamp-3 flex-1 text-[11px] text-muted-foreground">
              {p.description || "（无描述）"}
            </p>
            <div className="mt-2 text-[10px] text-muted-foreground">
              {p.modules.length} 个模块
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 h-7 text-[11px]"
              disabled={copying === p.id}
              onClick={() => handleCopy(p.id)}
            >
              {copying === p.id ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              复制到我的
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
