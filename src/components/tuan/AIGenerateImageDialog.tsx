import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus, RefreshCw, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useImageAttachments } from "@/lib/use-image-attachments";
import { cn } from "@/lib/utils";

const VARIATION_HINTS = [
  "换一个角度",
  "换一种光线氛围",
  "换一种构图",
  "换一种背景",
  "换一种色调",
  "增加细节层次",
];

type Slot = {
  id: string;
  status: "loading" | "done" | "error";
  url?: string;
  error?: string;
  variantSeed: string;
};

function genSeed() {
  return Math.random().toString(36).slice(2, 8);
}

export function AIGenerateImageDialog({
  open,
  onOpenChange,
  projectId,
  defaultPrompt,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  defaultPrompt?: string;
  onComplete: (urls: string[]) => void;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [count, setCount] = useState<number>(3);
  const [countInput, setCountInput] = useState<string>("3");
  const [phase, setPhase] = useState<"form" | "generating">("form");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { attachments, addFiles, remove, clear } = useImageAttachments({ projectId });

  useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt ?? "");
      setCount(3);
      setCountInput("3");
      setPhase("form");
      setSlots([]);
      setDragId(null);
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPrompt]);

  const referenceUrls = attachments
    .filter((a) => !a.uploading && a.url)
    .map((a) => a.url as string);
  const stillUploading = attachments.some((a) => a.uploading);

  const clamp = (n: number) => Math.max(1, Math.min(9, Math.round(n)));

  /** Fires a single generation request and updates the slot in place. */
  const runOneGeneration = async (
    slotId: string,
    p: string,
    variant: string | undefined,
  ): Promise<void> => {
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          count: 1,
          referenceImages: referenceUrls.length > 0 ? referenceUrls : undefined,
          projectId,
          variant,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "生图失败");
        if (res.status === 402) toast.error("AI 额度不足，请联系管理员充值");
        else if (res.status === 429) toast.error("请求太频繁，请稍后再试");
        setSlots((cur) =>
          cur.map((s) =>
            s.id === slotId ? { ...s, status: "error", error: text || "生图失败" } : s,
          ),
        );
        return;
      }
      const data = (await res.json()) as { urls?: string[] };
      const url = data.urls?.[0];
      if (!url) {
        setSlots((cur) =>
          cur.map((s) => (s.id === slotId ? { ...s, status: "error", error: "空数据" } : s)),
        );
        return;
      }
      setSlots((cur) =>
        cur.map((s) => (s.id === slotId ? { ...s, status: "done", url } : s)),
      );
    } catch (e) {
      const msg = (e as Error).message;
      setSlots((cur) =>
        cur.map((s) => (s.id === slotId ? { ...s, status: "error", error: msg } : s)),
      );
    }
  };

  const onStart = () => {
    const p = prompt.trim();
    if (!p) return toast.warning("请填写图片描述");
    if (stillUploading) return toast.warning("参考图正在上传中，请稍候");
    const n = clamp(count);
    const initial: Slot[] = Array.from({ length: n }, () => ({
      id: crypto.randomUUID(),
      status: "loading" as const,
      variantSeed: genSeed(),
    }));
    setSlots(initial);
    setPhase("generating");
    initial.forEach((s, i) => {
      void runOneGeneration(s.id, p, undefined);
      // also fire-and-forget — order doesn't matter
      void i; // satisfies eslint unused
    });
  };

  const regenerateSlot = (slotId: string) => {
    const newSeed = genSeed();
    const hint = VARIATION_HINTS[Math.floor(Math.random() * VARIATION_HINTS.length)];
    const variant = `${hint} (seed: ${newSeed})`;
    setSlots((cur) =>
      cur.map((s) =>
        s.id === slotId
          ? { ...s, status: "loading", error: undefined, url: undefined, variantSeed: newSeed }
          : s,
      ),
    );
    void runOneGeneration(slotId, prompt.trim(), variant);
  };

  const removeSlot = (slotId: string) => {
    setSlots((cur) => (cur.length <= 1 ? cur : cur.filter((s) => s.id !== slotId)));
  };

  const reorderSlots = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setSlots((cur) => {
      const src = cur.findIndex((s) => s.id === sourceId);
      const dst = cur.findIndex((s) => s.id === targetId);
      if (src < 0 || dst < 0) return cur;
      const next = cur.slice();
      const [item] = next.splice(src, 1);
      next.splice(dst, 0, item);
      return next;
    });
  };

  const anyLoading = slots.some((s) => s.status === "loading");
  const doneSlots = slots.filter((s) => s.status === "done");
  const doneCount = doneSlots.length;

  const confirmInsert = () => {
    if (anyLoading) return;
    if (doneCount === 0) {
      toast.warning("没有可插入的图片");
      return;
    }
    const urls = slots.filter((s) => s.status === "done").map((s) => s.url as string);
    onComplete(urls);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[#07c160]" />
            AI 快速生图
          </DialogTitle>
          <DialogDescription className="text-xs">
            {phase === "form"
              ? "根据文字描述生成商品配图，可上传参考图保持风格一致"
              : `正在生成 ${doneCount}/${slots.length} 张 · 可拖动排序、单张重新生成`}
          </DialogDescription>
        </DialogHeader>

        {phase === "form" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#646566]">图片描述</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="例如：阳光下的草莓果园特写，鲜红饱满，自然光"
                className="w-full resize-none rounded-md border border-[#dcdee0] bg-white px-2.5 py-2 text-[13px] outline-none focus:border-[#07c160] focus:ring-2 focus:ring-[#07c160]/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#646566]">生成数量（1–9 张）</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const n = clamp(count - 1);
                    setCount(n);
                    setCountInput(String(n));
                  }}
                  className="grid h-8 w-8 place-items-center rounded-md border border-[#dcdee0] text-[#646566] hover:border-[#07c160] hover:text-[#07c160]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={countInput}
                  onChange={(e) => {
                    setCountInput(e.target.value);
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 1 && n <= 9) setCount(clamp(n));
                  }}
                  onBlur={() => {
                    const n = clamp(Number(countInput) || count);
                    setCount(n);
                    setCountInput(String(n));
                  }}
                  className="h-8 w-16 rounded-md border border-[#dcdee0] bg-white text-center text-[13px] outline-none focus:border-[#07c160] focus:ring-2 focus:ring-[#07c160]/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = clamp(count + 1);
                    setCount(n);
                    setCountInput(String(n));
                  }}
                  className="grid h-8 w-8 place-items-center rounded-md border border-[#dcdee0] text-[#646566] hover:border-[#07c160] hover:text-[#07c160]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] text-[#969799]">最多 9 张</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#646566]">
                  参考商品图（可选，最多 3 张）
                </label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={attachments.length >= 3}
                  className="flex items-center gap-1 text-[11px] text-[#07c160] hover:underline disabled:cursor-not-allowed disabled:text-[#c8c9cc]"
                >
                  <Upload className="h-3 w-3" />
                  上传
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {attachments.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="relative h-16 w-16 overflow-hidden rounded-md border border-[#ebedf0] bg-[#fafbfc]"
                    >
                      <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                      {a.uploading && (
                        <div className="absolute inset-0 grid place-items-center bg-black/40">
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(a.id)}
                        className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-[#dcdee0] bg-[#fafbfc] px-3 py-3 text-center text-[11px] text-[#969799]">
                  不传参考图也行，AI 会根据描述发挥
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto pr-1">
              {slots.map((slot, idx) => {
                const draggable = slot.status === "done" && !anyLoading;
                return (
                  <div
                    key={slot.id}
                    draggable={draggable}
                    onDragStart={() => draggable && setDragId(slot.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => {
                      if (slot.status === "done" && !anyLoading) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId && slot.status === "done") reorderSlots(dragId, slot.id);
                      setDragId(null);
                    }}
                    className={cn(
                      "group relative aspect-[16/10] overflow-hidden rounded-lg border bg-[#fafbfc] transition",
                      slot.status === "done"
                        ? "border-[#ebedf0] hover:border-[#07c160]/60"
                        : "border-transparent",
                      dragId === slot.id && "opacity-50",
                      draggable && "cursor-grab active:cursor-grabbing",
                    )}
                  >
                    {slot.status === "loading" && <TechLoader />}
                    {slot.status === "done" && slot.url && (
                      <>
                        <img
                          src={slot.url}
                          alt=""
                          className="h-full w-full animate-in fade-in zoom-in-95 object-cover duration-300"
                        />
                        <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/55 via-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => regenerateSlot(slot.id)}
                            title="重新生成"
                            className="flex items-center gap-0.5 rounded-md bg-white/95 px-1.5 py-1 text-[10px] text-[#323233] shadow hover:bg-white"
                          >
                            <RefreshCw className="h-3 w-3" />
                            重生
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSlot(slot.id)}
                            title="删除"
                            className="grid h-6 w-6 place-items-center rounded-md bg-white/95 text-[#ee0a24] shadow hover:bg-white"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="absolute left-1.5 top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-black/55 px-1.5 text-[10px] font-medium text-white">
                          {idx + 1}
                        </div>
                      </>
                    )}
                    {slot.status === "error" && (
                      <button
                        type="button"
                        onClick={() => regenerateSlot(slot.id)}
                        className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#fff5f5] text-[11px] text-[#ee0a24] hover:bg-[#ffeded]"
                      >
                        <RefreshCw className="h-4 w-4" />
                        生成失败 · 点击重试
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!anyLoading && doneCount < slots.length && (
              <div className="text-center text-[11px] text-[#969799]">
                有 {slots.length - doneCount} 张生成失败，可点击重试或删除
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {phase === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8">
                取消
              </Button>
              <Button
                onClick={onStart}
                disabled={stillUploading}
                className="h-8 bg-[#07c160] hover:bg-[#06ae56]"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                开始生成
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="h-8">
                取消
              </Button>
              <Button
                onClick={confirmInsert}
                disabled={anyLoading || doneCount === 0}
                className="h-8 bg-[#07c160] hover:bg-[#06ae56]"
              >
                {anyLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    生成中 {doneCount}/{slots.length}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    确认插入 {doneCount} 张
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Tech-style animated loading placeholder. */
function TechLoader() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#0f1c2c] via-[#0a1220] to-[#0f1c2c]">
      {/* grid pattern */}
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(7,193,96,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(7,193,96,0.4)_1px,transparent_1px)] [background-size:18px_18px]" />
      {/* shimmer */}
      <div className="tech-shimmer absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-[#07c160]/25 to-transparent" />
      {/* rings */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative h-14 w-14">
          <svg
            viewBox="0 0 56 56"
            className="absolute inset-0 h-full w-full animate-spin text-[#07c160]"
            style={{ animationDuration: "2.4s" }}
          >
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="6 10"
              opacity="0.7"
            />
          </svg>
          <svg
            viewBox="0 0 56 56"
            className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] animate-spin text-[#3ee08a]"
            style={{ animationDuration: "1.6s", animationDirection: "reverse" }}
          >
            <circle
              cx="28"
              cy="28"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 6"
              opacity="0.8"
            />
          </svg>
          <div
            className="absolute inset-0 grid place-items-center text-[#07c160]"
            style={{ filter: "drop-shadow(0 0 6px rgba(7,193,96,0.85))" }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-1.5 text-center text-[10px] tracking-widest text-[#07c160]/80">
        AI 绘制中…
      </div>
      <style>{`
        @keyframes tech-shimmer-anim {
          0% { transform: translateX(0) skewX(-12deg); }
          100% { transform: translateX(400%) skewX(-12deg); }
        }
        .tech-shimmer { animation: tech-shimmer-anim 1.8s linear infinite; }
      `}</style>
    </div>
  );
}
