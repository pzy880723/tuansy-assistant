import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
  QrCode,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  generateModulesFromText,
  type CopyModule,
  type CopyModuleType,
} from "@/lib/copy-logics.functions";
import { MobileUploadQRDialog } from "./MobileUploadQRDialog";


export const MODULE_TYPE_LABEL: Record<CopyModuleType, string> = {
  title: "标题",
  paragraph: "正文段",
  image_large: "大图",
  image_grid: "九宫格",
  video: "视频",
  params: "参数表",
};
export const MODULE_TYPE_COLOR: Record<CopyModuleType, string> = {
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

export type CopyLogicEditorValue = {
  name: string;
  description: string;
  modules: CopyModule[];
};

/**
 * Reusable controlled editor for a copy logic (user-side or admin-side).
 * Caller owns persistence (onChange is debounced upstream as needed).
 */
export function CopyLogicEditor({
  value,
  onChange,
  readOnly = false,
  projectId,
}: {
  value: CopyLogicEditorValue;
  onChange: (next: CopyLogicEditorValue) => void;
  readOnly?: boolean;
  projectId?: string;
}) {
  const [name, setName] = useState(value.name);
  const [description, setDescription] = useState(value.description);
  const [modules, setModules] = useState<CopyModule[]>(value.modules);
  const [genLoading, setGenLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);


  // Resync when external value changes (e.g. selection swap)
  const lastSig = useRef<string>("");
  const sig = `${value.name}::${value.description.length}::${value.modules.length}`;
  useEffect(() => {
    if (sig !== lastSig.current) {
      setName(value.name);
      setDescription(value.description);
      setModules(value.modules);
      lastSig.current = sig;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const emit = (patch: Partial<CopyLogicEditorValue>) => {
    const next: CopyLogicEditorValue = {
      name: patch.name ?? name,
      description: patch.description ?? description,
      modules: patch.modules ?? modules,
    };
    onChange(next);
  };

  const genMods = useServerFn(generateModulesFromText);

  const runGen = async () => {
    if (!description.trim()) {
      toast.error("先填写自然语言描述");
      return;
    }
    setGenLoading(true);
    try {
      const { modules: m } = await genMods({
        data: { name, description: description.trim() },
      });
      setModules(m);
      emit({ modules: m });
      toast.success(`已生成 ${m.length} 个模块`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenLoading(false);
    }
  };

  const updateModule = (id: string, patch: Partial<CopyModule>) => {
    const next = modules.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setModules(next);
    emit({ modules: next });
  };
  const moveModule = (id: string, dir: "up" | "down") => {
    const i = modules.findIndex((m) => m.id === id);
    if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= modules.length) return;
    const next = modules.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setModules(next);
    emit({ modules: next });
  };
  const removeModule = (id: string) => {
    const next = modules.filter((m) => m.id !== id);
    setModules(next);
    emit({ modules: next });
  };
  const addModule = (type: CopyModuleType) => {
    const next: CopyModule[] = [
      ...modules,
      { id: rid(), type, label: MODULE_TYPE_LABEL[type], guidance: "" },
    ];
    setModules(next);
    emit({ modules: next });
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[11px] font-medium text-muted-foreground">名称</label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              emit({ name: e.target.value });
            }}
            disabled={readOnly}
            placeholder="如：服装文案"
            className="flex-1"
          />
          {projectId && !readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 text-[11px]"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="h-3.5 w-3.5" />
              扫码上传图片
            </Button>
          )}
        </div>
      </div>

      {projectId && (
        <MobileUploadQRDialog
          projectId={projectId}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      )}


      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground">
            自然语言描述这套文案逻辑
          </label>
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={runGen}
              disabled={genLoading}
            >
              {genLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowRight className="h-3 w-3" />
              )}
              生成模块清单
            </Button>
          )}
        </div>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            emit({ description: e.target.value });
          }}
          disabled={readOnly}
          placeholder="比如：服装类目主打韩系氛围感与显瘦版型。先用一句梨形身材的痛点共鸣勾住人……"
          className="min-h-[140px]"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground">
            模块清单（按顺序展示在预览里）
          </label>
        </div>
        {modules.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
            {readOnly
              ? "暂无模块"
              : "还没有模块。先写完上面的自然语言描述，点「生成模块清单」让团宝帮你拆。"}
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
                    disabled={readOnly}
                    className="h-7 flex-1 text-xs"
                    placeholder="模块名"
                  />
                  {!readOnly && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveModule(m.id, "up")}
                        disabled={i === 0}
                        className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveModule(m.id, "down")}
                        disabled={i === modules.length - 1}
                        className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeModule(m.id)}
                        className="grid h-7 w-7 place-items-center rounded text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <Textarea
                  value={m.guidance}
                  onChange={(e) => updateModule(m.id, { guidance: e.target.value })}
                  disabled={readOnly}
                  className="min-h-[68px] text-xs"
                  placeholder="这个模块具体写什么、怎么写……"
                />
              </div>
            ))}
          </div>
        )}

        {!readOnly && (
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
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <ArrowLeftIcon className="h-3 w-3" /> 从左侧任一选项添加
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
