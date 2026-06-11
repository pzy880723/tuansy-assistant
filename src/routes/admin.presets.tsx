import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Plus, Loader2, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  adminListPresets,
  adminUpsertPreset,
  adminDeletePreset,
} from "@/lib/admin.functions";
import { CopyLogicEditor } from "@/components/copy-logic/CopyLogicEditor";
import type { PresetCopyLogic } from "@/lib/presets.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/presets")({
  component: PresetsPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function PresetsPage() {
  const list = useServerFn(adminListPresets);
  const upsert = useServerFn(adminUpsertPreset);
  const remove = useServerFn(adminDeletePreset);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-presets"],
    queryFn: () => list(),
  });
  const presets = data?.presets ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && presets.length > 0) setSelectedId(presets[0].id);
  }, [presets, selectedId]);
  const selected = presets.find((p) => p.id === selectedId) ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-presets"] });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");

  const createPreset = async () => {
    const name = newName.trim() || "新预设";
    try {
      const res = await upsert({
        data: {
          slug: `${slugify(name) || "preset"}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          industry: newIndustry.trim(),
          description: "",
          modules: [],
          sort_order: (presets[presets.length - 1]?.sort_order ?? 0) + 10,
          is_published: true,
        },
      });
      setCreating(false);
      setNewName("");
      setNewIndustry("");
      await refresh();
      setSelectedId(res.preset.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "新建失败");
    }
  };

  const upsertMut = useMutation({
    mutationFn: async (p: PresetCopyLogic) =>
      upsert({
        data: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          industry: p.industry,
          description: p.description,
          modules: p.modules,
          sort_order: p.sort_order,
          is_published: p.is_published,
        },
      }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "保存失败"),
    onSuccess: () => refresh(),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("已删除");
      setSelectedId(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "删除失败"),
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">预设文案逻辑</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            管理面向所有用户的标准行业模版；用户端只读，可一键复制到自己的文案逻辑里再调整。
          </p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" /> 新增预设
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增预设文案逻辑</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">名称</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="如：服装文案"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">行业</label>
                <Input
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  placeholder="如：服装 / 食品 / 3C 数码"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreating(false)}>
                取消
              </Button>
              <Button onClick={createPreset}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border bg-card">
          {isLoading && (
            <div className="grid place-items-center py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!isLoading && presets.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              还没有预设。点右上角新增一个吧。
            </div>
          )}
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                "flex w-full items-start gap-2 border-b px-4 py-3 text-left text-sm transition hover:bg-muted/60",
                selectedId === p.id && "bg-muted/80",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{p.name}</span>
                  {!p.is_published && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      未上架
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {p.industry || "未分类"} · {p.modules.length} 模块
                </div>
              </div>
            </button>
          ))}
        </aside>

        <section className="rounded-xl border bg-card">
          {!selected ? (
            <div className="grid h-64 place-items-center text-xs text-muted-foreground">
              选择左侧任一预设开始编辑
            </div>
          ) : (
            <PresetEditor
              key={selected.id}
              preset={selected}
              onSave={(patch) =>
                upsertMut.mutate({ ...selected, ...patch })
              }
              onDelete={() => {
                if (!window.confirm(`确认删除「${selected.name}」？`)) return;
                removeMut.mutate(selected.id);
              }}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function PresetEditor({
  preset,
  onSave,
  onDelete,
}: {
  preset: PresetCopyLogic;
  onSave: (patch: Partial<PresetCopyLogic>) => void;
  onDelete: () => void;
}) {
  const [slug, setSlug] = useState(preset.slug);
  const [industry, setIndustry] = useState(preset.industry);
  const [sortOrder, setSortOrder] = useState(preset.sort_order);
  const [isPublished, setIsPublished] = useState(preset.is_published);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queue = (patch: Partial<PresetCopyLogic>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(patch), 700);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">slug</label>
          <Input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              queue({ slug: e.target.value });
            }}
            className="mt-1 h-8 font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">行业</label>
          <Input
            value={industry}
            onChange={(e) => {
              setIndustry(e.target.value);
              queue({ industry: e.target.value });
            }}
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">排序</label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => {
              const v = Number(e.target.value) || 0;
              setSortOrder(v);
              queue({ sort_order: v });
            }}
            className="mt-1 h-8 text-xs"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[11px] font-medium text-muted-foreground">上架</label>
          <div className="mt-2 flex items-center gap-2">
            <Switch
              checked={isPublished}
              onCheckedChange={(v) => {
                setIsPublished(v);
                queue({ is_published: v });
              }}
            />
            <span className="text-xs text-muted-foreground">
              {isPublished ? "用户端可见" : "仅后台可见"}
            </span>
          </div>
        </div>
      </div>

      <CopyLogicEditor
        value={{
          name: preset.name,
          description: preset.description,
          modules: preset.modules,
        }}
        onChange={(next) => queue(next)}
      />

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-[11px] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" />
          预设对所有用户只读；用户可一键复制到自己的文案逻辑里再调整
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 gap-1 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> 删除此预设
        </Button>
      </div>
    </div>
  );
}
