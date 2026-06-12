import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Minus, Plus, RefreshCw, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { readAuthToken } from "@/lib/use-current-user";
import { uploadAiGeneratedImage } from "@/lib/image-gen.functions";
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
  previewUrl?: string;
  isFinal?: boolean;
  error?: string;
  variantSeed: string;
  startedAt: number;
  hasPartial?: boolean;
};

type ImageStreamPayload = {
  type?: string;
  b64_json?: string;
};

function genSeed() {
  return Math.random().toString(36).slice(2, 8);
}

function userFacingError(status: number, text: string) {
  if (status === 401) return "登录状态失效，请刷新页面重新登录";
  if (status === 402) return "AI 额度已用完，请联系管理员充值";
  if (status === 429) return "请求太频繁，请稍后再试";
  return `生图失败 (${status}): ${text.slice(0, 160) || "请稍后重试"}`;
}

async function readImageStream(
  res: Response,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<string> {
  if (!res.body) throw new Error("生图流为空");
  let buffer = "";
  let finalB64 = "";
  let sawCompleted = false;

  const consumeBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    let eventName = "";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const raw = dataLines.join("\n");
    if (!raw || raw === "[DONE]") return;
    let payload: ImageStreamPayload;
    try {
      payload = JSON.parse(raw) as ImageStreamPayload;
    } catch {
      return;
    }
    const type = eventName || payload.type || "";
    if (
      type !== "image_generation.partial_image" &&
      type !== "image_generation.completed"
    ) return;
    if (!payload.b64_json) return;
    const isFinal = type === "image_generation.completed";
    if (isFinal) {
      finalB64 = payload.b64_json;
      sawCompleted = true;
    }
    flushSync(() => onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal));
  };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      blocks.forEach(consumeBlock);
    }
    if (buffer.trim()) consumeBlock(buffer);
  } finally {
    reader.cancel().catch(() => undefined);
  }
  if (!sawCompleted || !finalB64) throw new Error("图片生成中断，请重试");
  return finalB64;
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
  onComplete: (urls: string[], mode: "lg" | "sm") => void;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [count, setCount] = useState<number>(3);
  const [countInput, setCountInput] = useState<string>("3");
  const [phase, setPhase] = useState<"form" | "generating">("form");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<"lg" | "sm">("lg");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { attachments, addFiles, remove, clear } = useImageAttachments({ projectId });
  const uploadGenerated = useServerFn(uploadAiGeneratedImage);

  useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt ?? "");
      setCount(3);
      setCountInput("3");
      setPhase("form");
      setSlots([]);
      setDragId(null);
      setSaveMode("lg");
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
      const token = readAuthToken();
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-tuan-session": token } : {}),
        },
        body: JSON.stringify({
          prompt: p,
          referenceImages: referenceUrls.length > 0 ? referenceUrls : undefined,
          projectId,
          variant,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "生图失败");
        const msg = userFacingError(res.status, text);
        toast.error(msg);
        setSlots((cur) =>
          cur.map((s) =>
            s.id === slotId ? { ...s, status: "error", error: msg } : s,
          ),
        );
        return;
      }
      const finalB64 = await readImageStream(res, (dataUrl, isFinal) => {
        setSlots((cur) =>
          cur.map((s) =>
            s.id === slotId ? { ...s, previewUrl: dataUrl, isFinal, hasPartial: true } : s,
          ),
        );
      });
      const { url } = await uploadGenerated({ data: { b64: finalB64, projectId } });
      setSlots((cur) =>
        cur.map((s) =>
          s.id === slotId ? { ...s, status: "done", url, previewUrl: undefined, isFinal: true } : s,
        ),
      );
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg || "生图失败，请重试");
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
      startedAt: Date.now(),
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
          ? {
              ...s,
              status: "loading",
              error: undefined,
              url: undefined,
              previewUrl: undefined,
              isFinal: false,
              variantSeed: newSeed,
              startedAt: Date.now(),
              hasPartial: false,
            }
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
    onComplete(urls, saveMode);
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
                    {slot.status === "loading" && (
                      <>
                        {slot.previewUrl && (
                          <img
                            src={slot.previewUrl}
                            alt=""
                            className={cn(
                              "h-full w-full object-cover transition-[filter,opacity] duration-500",
                              slot.isFinal ? "blur-0 opacity-100" : "blur-xl opacity-80",
                            )}
                          />
                        )}
                        <div className="absolute inset-0">
                          <TechLoader translucent={Boolean(slot.previewUrl)} startedAt={slot.startedAt} hasPartial={Boolean(slot.hasPartial)} />
                        </div>
                      </>
                    )}
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
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[#fff5f5] px-2 text-center">
                        <button
                          type="button"
                          onClick={() => regenerateSlot(slot.id)}
                          className="flex items-center gap-1 text-[12px] font-medium text-[#ee0a24] hover:underline"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          生成失败 · 点击重试
                        </button>
                        {slot.error && (
                          <div
                            title={slot.error}
                            className="line-clamp-2 max-w-full px-1 text-[10px] leading-tight text-[#ee0a24]/70"
                          >
                            {slot.error}
                          </div>
                        )}
                      </div>
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

/** Siri / Apple-Intelligence style liquid loader with progress + thinking phrases. */
const THINKING_PHRASES = [
  { at: 0, text: "正在阅读你的描述…" },
  { at: 2200, text: "拆解段落，理解商品要点…" },
  { at: 5000, text: "搜索相似商品的视觉特征…" },
  { at: 8500, text: "构思画面构图与镜头…" },
  { at: 12000, text: "铺设光影与材质…" },
  { at: 16000, text: "绘制主体细节…" },
  { at: 21000, text: "微调色彩与质感…" },
  { at: 26000, text: "即将完成…" },
];

function easeProgress(elapsedMs: number): number {
  // Smooth curve: 0→35% by 6s, 35→75% by 18s, then asymptotic toward 90%.
  if (elapsedMs <= 6000) return (elapsedMs / 6000) * 35;
  if (elapsedMs <= 18000) return 35 + ((elapsedMs - 6000) / 12000) * 40;
  return 75 + (1 - Math.exp(-(elapsedMs - 18000) / 12000)) * 15;
}

function TechLoader({
  translucent = false,
  startedAt,
  hasPartial = false,
}: {
  translucent?: boolean;
  startedAt: number;
  hasPartial?: boolean;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const elapsed = Math.max(0, tick - startedAt);
  const baseProgress = easeProgress(elapsed);
  const progress = Math.min(95, hasPartial ? Math.max(baseProgress, 82) : baseProgress);

  // Pick a phrase. If a partial frame arrived, jump to "绘制主体细节…".
  let phraseIdx = 0;
  for (let i = 0; i < THINKING_PHRASES.length; i++) {
    if (elapsed >= THINKING_PHRASES[i].at) phraseIdx = i;
  }
  if (hasPartial && phraseIdx < 5) phraseIdx = 5;
  const phrase = THINKING_PHRASES[phraseIdx].text;

  const labelColor = translucent ? "rgba(255,255,255,0.92)" : "rgba(60, 40, 90, 0.72)";
  const subColor = translucent ? "rgba(255,255,255,0.6)" : "rgba(60, 40, 90, 0.45)";
  const trackBg = translucent ? "rgba(255,255,255,0.18)" : "rgba(60, 40, 90, 0.10)";

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", translucent && "bg-white/20 backdrop-blur-sm")}
      style={{ background: translucent ? undefined : "oklch(0.99 0.005 270)" }}
    >
      {/* Liquid color blobs */}
      <div className="siri-blob siri-blob-a" />
      <div className="siri-blob siri-blob-b" />
      <div className="siri-blob siri-blob-c" />

      {/* Rainbow conic ring (blurred halo) */}
      <div className="absolute inset-0 grid place-items-center" style={{ transform: "translateY(-10px)" }}>
        <div className="relative h-14 w-14">
          <div
            className="absolute inset-0 rounded-full siri-spin"
            style={{
              background:
                "conic-gradient(from 0deg, #ff6ec7, #b388ff, #6ec1ff, #4cc9f0, #ffd166, #ff6ec7)",
              filter: "blur(10px) saturate(160%)",
              opacity: 0.9,
            }}
          />
          <div
            className="absolute inset-1.5 rounded-full siri-spin-rev"
            style={{
              background:
                "conic-gradient(from 180deg, transparent 0deg, #ffffffcc 20deg, transparent 80deg, #ffffff99 200deg, transparent 260deg)",
              mask: "radial-gradient(circle, transparent 58%, #000 60%)",
              WebkitMask: "radial-gradient(circle, transparent 58%, #000 60%)",
            }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <div
              className="h-3 w-3 rounded-full bg-white siri-breathe"
              style={{ boxShadow: "0 0 24px 6px rgba(255,255,255,0.9), 0 0 8px rgba(170,120,255,0.7)" }}
            />
          </div>
        </div>
      </div>

      {/* Soft noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Thinking phrase + progress bar */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5">
        <div className="relative h-4 overflow-hidden">
          <div
            key={phraseIdx}
            className="absolute inset-0 flex items-center justify-center text-[11px] font-medium tracking-wide animate-in fade-in slide-in-from-bottom-1 duration-500"
            style={{ color: labelColor, textShadow: translucent ? "0 1px 6px rgba(0,0,0,0.35)" : "none" }}
          >
            {phrase}
          </div>
        </div>
        <div
          className="mt-1.5 h-[2px] w-full overflow-hidden rounded-full"
          style={{ background: trackBg }}
        >
          <div
            className="h-full rounded-full siri-shimmer"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #ff6ec7, #b388ff 40%, #6ec1ff 70%, #4cc9f0)",
              boxShadow: "0 0 8px rgba(179,136,255,0.6)",
              transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>
        <div
          className="mt-1 text-center text-[9px] tabular-nums tracking-[0.25em]"
          style={{ color: subColor }}
        >
          {Math.round(progress)}%
        </div>
      </div>


      <style>{`
        .siri-blob {
          position: absolute;
          width: 75%;
          height: 75%;
          border-radius: 9999px;
          filter: blur(34px) saturate(150%);
          mix-blend-mode: screen;
          opacity: 0.95;
          will-change: transform;
        }
        .siri-blob-a {
          left: -15%;
          top: -10%;
          background: radial-gradient(circle, #ff6ec7 0%, transparent 60%);
          animation: siri-blob-a 9s ease-in-out infinite;
        }
        .siri-blob-b {
          right: -20%;
          top: 5%;
          background: radial-gradient(circle, #8a5cf6 0%, transparent 60%);
          animation: siri-blob-b 11s ease-in-out infinite;
        }
        .siri-blob-c {
          left: 10%;
          bottom: -25%;
          background: radial-gradient(circle, #4cc9f0 0%, transparent 60%);
          animation: siri-blob-c 10s ease-in-out infinite;
        }
        @keyframes siri-blob-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20%, 15%) scale(1.15); }
        }
        @keyframes siri-blob-b {
          0%, 100% { transform: translate(0, 0) scale(1.05); }
          50% { transform: translate(-15%, 20%) scale(0.95); }
        }
        @keyframes siri-blob-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15%, -20%) scale(1.1); }
        }
        @keyframes siri-spin-kf { to { transform: rotate(360deg); } }
        @keyframes siri-spin-rev-kf { to { transform: rotate(-360deg); } }
        .siri-spin { animation: siri-spin-kf 6s linear infinite; }
        .siri-spin-rev { animation: siri-spin-rev-kf 4s linear infinite; }
        @keyframes siri-breathe-kf {
          0%, 100% { opacity: 0.7; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        .siri-breathe { animation: siri-breathe-kf 2.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
