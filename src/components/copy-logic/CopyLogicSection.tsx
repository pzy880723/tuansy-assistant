import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  listCopyLogics,
  upsertCopyLogic,
  deleteCopyLogic,
  setActiveCopyLogic,
  generateModulesFromText,
  generateTextFromModules,
  DEFAULT_FORMATTING,
  type CopyLogic,
  type CopyModule,
  type CopyModuleType,
  type CopyFormatting,
} from "@/lib/copy-logics.functions";
import { cn } from "@/lib/utils";



const MODULE_TYPE_LABEL: Record<CopyModuleType, string> = {
  title: "标题",
  paragraph: "正文段",
  image_large: "大图",
  image_grid: "九宫格",
  video: "视频",
  params: "参数表",
};
const MODULE_TYPE_COLOR: Record<CopyModuleType, string> = {
  title: "bg-amber-100 text-amber-700",
  paragraph: "bg-slate-100 text-slate-700",
  image_large: "bg-blue-100 text-blue-700",
  image_grid: "bg-indigo-100 text-indigo-700",
  video: "bg-purple-100 text-purple-700",
  params: "bg-emerald-100 text-emerald-700",
};

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

export function CopyLogicSection({ embedded = false, projectId }: { embedded?: boolean; projectId?: string }) {
  const list = useServerFn(listCopyLogics);
  const upsert = useServerFn(upsertCopyLogic);
  const remove = useServerFn(deleteCopyLogic);
  const setActive = useServerFn(setActiveCopyLogic);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["copy-logics"],
    queryFn: () => list(),
  });
  const logics = data?.logics ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && logics.length > 0) setSelectedId(logics[0].id);
    if (selectedId && !logics.find((l) => l.id === selectedId)) {
      setSelectedId(logics[0]?.id ?? null);
    }
  }, [logics, selectedId]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["copy-logics"] });

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const createLogic = async () => {
    const name = newName.trim() || "未命名文案逻辑";
    try {
      const res = await upsert({
        data: { name, description: "", modules: [], is_active: logics.length === 0 },
      });
      setNewName("");
      setCreating(false);
      await refresh();
      setSelectedId(res.logic.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "新建失败");
    }
  };

  const selected = logics.find((l) => l.id === selectedId) ?? null;

  return (
    <section className={cn("rounded-xl border bg-card", embedded && "rounded-none border-0")}>
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div>
          <div className="text-sm font-semibold">文案编辑逻辑</div>
          <div className="text-[11px] text-muted-foreground">
            可同时启用多条，团宝会按商品品类自动挑一条来写。修改即时自动保存，团宝下一条回复就会用最新版。
          </div>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-3.5 w-3.5" /> 新增文案逻辑
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增文案逻辑</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <label className="text-xs font-medium">名称</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：服装文案、生鲜文案"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreating(false)}>
                取消
              </Button>
              <Button onClick={createLogic}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="border-r md:max-h-[70vh] md:overflow-y-auto">
          {isLoading && (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              加载中…
            </div>
          )}
          {!isLoading && logics.length === 0 && (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">
              还没有文案逻辑，点右上角新增一个吧
            </div>
          )}
          {logics.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedId(l.id)}
              className={cn(
                "flex w-full items-center gap-2 border-b px-4 py-3 text-left text-sm transition hover:bg-muted/60",
                selectedId === l.id && "bg-muted/80",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {l.modules.length} 个模块
                </div>
              </div>
              {l.is_active && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                  <Check className="h-2.5 w-2.5" /> 已启用
                </span>
              )}
            </button>
          ))}
        </aside>

        <div className="md:max-h-[70vh] md:overflow-y-auto">
          {selected ? (
            <LogicEditor
              key={selected.id}
              logic={selected}
              projectId={projectId}

              onSave={async (patch) => {
                try {
                  await upsert({
                    data: {
                      id: selected.id,
                      name: patch.name ?? selected.name,
                      description: patch.description ?? selected.description,
                      modules: patch.modules ?? selected.modules,
                      ...(patch.formatting !== undefined
                        ? { formatting: patch.formatting }
                        : {}),
                    },
                  });
                  await refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "保存失败");
                }
              }}
              onActivate={async () => {
                const nextActive = !selected.is_active;
                try {
                  await setActive({ data: { id: selected.id, active: nextActive } });
                  await refresh();
                  toast.success(nextActive ? "已启用" : "已停用");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "切换失败");
                }
              }}
              onDelete={async () => {
                if (!window.confirm(`确认删除「${selected.name}」？`)) return;
                try {
                  await remove({ data: { id: selected.id } });
                  await refresh();
                  toast.success("已删除");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "删除失败");
                }
              }}
            />
          ) : (
            <div className="grid h-full place-items-center py-16 text-xs text-muted-foreground">
              选择左侧任一文案逻辑开始编辑
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LogicEditor({
  logic,
  onSave,
  onActivate,
  onDelete,
  projectId,
}: {
  logic: CopyLogic;
  onSave: (patch: {
    name?: string;
    description?: string;
    modules?: CopyModule[];
    formatting?: CopyFormatting;
  }) => Promise<void>;
  onActivate: () => Promise<void>;
  onDelete: () => Promise<void>;
  projectId?: string;
}) {
  const [name, setName] = useState(logic.name);

  const [description, setDescription] = useState(logic.description);
  const [modules, setModules] = useState<CopyModule[]>(logic.modules);
  const [formatting, setFormatting] = useState<CopyFormatting>(
    { ...DEFAULT_FORMATTING, ...(logic.formatting ?? {}) },
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [genModules, setGenModules] = useState(false);
  const [genText, setGenText] = useState(false);



  const genMods = useServerFn(generateModulesFromText);
  const genTxt = useServerFn(generateTextFromModules);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = (patch: {
    name?: string;
    description?: string;
    modules?: CopyModule[];
    formatting?: CopyFormatting;
  }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onSave(patch);
      setLastSavedAt(Date.now());
    }, 800);
  };

  const updateFormatting = (patch: Partial<CopyFormatting>) => {
    const next = { ...formatting, ...patch };
    setFormatting(next);
    queueSave({ formatting: next });
  };

  const updateModule = (id: string, patch: Partial<CopyModule>) => {
    const next = modules.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setModules(next);
    queueSave({ modules: next });
  };
  const moveModule = (id: string, dir: "up" | "down") => {
    const i = modules.findIndex((m) => m.id === id);
    if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= modules.length) return;
    const next = modules.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setModules(next);
    queueSave({ modules: next });
  };
  const removeModule = (id: string) => {
    const next = modules.filter((m) => m.id !== id);
    setModules(next);
    queueSave({ modules: next });
  };
  const addModule = (type: CopyModuleType) => {
    const next: CopyModule[] = [
      ...modules,
      { id: rid(), type, label: MODULE_TYPE_LABEL[type], guidance: "" },
    ];
    setModules(next);
    queueSave({ modules: next });
  };

  const runGenModules = async () => {
    const text = description.trim();
    if (!text) {
      toast.error("先填写自然语言描述");
      return;
    }
    setGenModules(true);
    try {
      const { modules: m } = await genMods({ data: { name, description: text } });
      setModules(m);
      queueSave({ modules: m });
      toast.success(`已生成 ${m.length} 个模块`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenModules(false);
    }
  };

  const runGenText = async () => {
    if (modules.length === 0) {
      toast.error("先添加至少一个模块");
      return;
    }
    setGenText(true);
    try {
      const { description: d } = await genTxt({ data: { name, modules } });
      setDescription(d);
      queueSave({ description: d });
      toast.success("已回写自然语言描述");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenText(false);
    }
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-[11px] font-medium text-muted-foreground">名称</label>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              queueSave({ name: e.target.value });
            }}
            placeholder="如：服装文案"
            className="mt-1"
          />
        </div>
        <div className="flex flex-col items-end gap-1 pt-5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">启用</span>
            <Switch checked={logic.is_active} onCheckedChange={() => onActivate()} />
          </div>
          {lastSavedAt && (
            <div className="text-[10px] text-muted-foreground">
              已保存 {new Date(lastSavedAt).toLocaleTimeString().slice(0, 5)}
            </div>
          )}
        </div>
      </div>




      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground">
            自然语言描述这套文案逻辑
          </label>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={runGenModules}
            disabled={genModules}
          >
            {genModules ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowRight className="h-3 w-3" />
            )}
            生成模块清单
          </Button>
        </div>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            queueSave({ description: e.target.value });
          }}
          placeholder="比如：服装类目主打韩系氛围感与显瘦版型……"
          className="min-h-[140px]"
        />
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <div className="mb-2 text-[11px] font-medium text-muted-foreground">
          排版预设（团宝写文案时自动套用，省得每次都讲）
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">段落模式</span>
            <select
              value={formatting.paragraphMode}
              onChange={(e) =>
                updateFormatting({
                  paragraphMode: e.target.value as CopyFormatting["paragraphMode"],
                })
              }
              className="h-7 rounded border bg-background px-2 text-[11px]"
            >
              <option value="natural">自然分段</option>
              <option value="one-sentence-per-line">一句一段</option>
              <option value="period-only">句号分段</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">段间空行</span>
            <select
              value={formatting.lineGap}
              onChange={(e) =>
                updateFormatting({ lineGap: Number(e.target.value) as 0 | 1 | 2 })
              }
              className="h-7 rounded border bg-background px-2 text-[11px]"
            >
              <option value={0}>0 行</option>
              <option value={1}>1 行</option>
              <option value={2}>2 行</option>
            </select>
          </label>
          <BlankLinesField
            label="首行空行"
            value={formatting.headBlankLines ?? 0}
            onChange={(v) => updateFormatting({ headBlankLines: v })}
          />
          <BlankLinesField
            label="尾行空行"
            value={formatting.tailBlankLines ?? 0}
            onChange={(v) => updateFormatting({ tailBlankLines: v })}
          />
          <label className="flex items-center justify-between gap-2 text-[11px] sm:col-span-2">
            <span className="text-muted-foreground">Emoji 浓度</span>
            <select
              value={formatting.emojiDensity}
              onChange={(e) =>
                updateFormatting({
                  emojiDensity: e.target.value as CopyFormatting["emojiDensity"],
                })
              }
              className="h-7 rounded border bg-background px-2 text-[11px]"
            >
              <option value="none">无 Emoji</option>
              <option value="light">适量（每段 ≤1 个）</option>
              <option value="rich">丰富（标题+段首）</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground">
            模块清单（按顺序展示在预览里）
          </label>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11px]"
            onClick={runGenText}
            disabled={genText}
          >
            {genText ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowLeftIcon className="h-3 w-3" />
            )}
            回写到自然语言
          </Button>
        </div>

        {modules.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
            还没有模块。先写完上面的自然语言描述，点「生成模块清单」让团宝帮你拆。
          </div>
        ) : (
          <div className="space-y-2">
            {modules.map((m, i) => (
              <div key={m.id} className="rounded-md border bg-background p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      MODULE_TYPE_COLOR[m.type],
                    )}
                  >
                    {MODULE_TYPE_LABEL[m.type]}
                  </span>
                  <Input
                    value={m.label}
                    onChange={(e) => updateModule(m.id, { label: e.target.value })}
                    className="h-7 flex-1 text-xs"
                    placeholder="模块名"
                  />
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveModule(m.id, "up")}
                      disabled={i === 0}
                      className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="上移"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveModule(m.id, "down")}
                      disabled={i === modules.length - 1}
                      className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                      title="下移"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeModule(m.id)}
                      className="grid h-7 w-7 place-items-center rounded text-destructive hover:bg-destructive/10"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <Textarea
                  value={m.guidance}
                  onChange={(e) => updateModule(m.id, { guidance: e.target.value })}
                  placeholder="这个模块具体写什么、怎么写……"
                  className="min-h-[68px] text-xs"
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-[11px] text-muted-foreground">+ 添加：</span>
          {(
            ["title", "paragraph", "image_large", "image_grid", "video", "params"] as CopyModuleType[]
          ).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addModule(t)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] transition hover:border-primary/60 hover:text-primary",
                MODULE_TYPE_COLOR[t],
              )}
            >
              {MODULE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-[11px] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" />
          激活的逻辑会被团宝在写文案时优先遵守
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 gap-1 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> 删除此逻辑
        </Button>
      </div>
    </div>
  );
}

function BlankLinesField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const presets = [1, 2, 3];
  const isPreset = presets.includes(value);
  const [custom, setCustom] = useState(!isPreset);
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <select
          value={custom ? "custom" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom") {
              setCustom(true);
            } else {
              setCustom(false);
              onChange(Number(v));
            }
          }}
          className="h-7 rounded border bg-background px-2 text-[11px]"
        >
          <option value="1">1 行</option>
          <option value="2">2 行</option>
          <option value="3">3 行</option>
          <option value="custom">自定义</option>
        </select>
        {custom && (
          <input
            type="number"
            min={0}
            max={10}
            value={value}
            onChange={(e) => {
              const n = Math.max(0, Math.min(10, Number(e.target.value) || 0));
              onChange(n);
            }}
            className="h-7 w-14 rounded border bg-background px-2 text-[11px]"
          />
        )}
      </div>
    </div>
  );
}
