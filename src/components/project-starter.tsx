import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardList,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { startProject } from "@/lib/projects.functions";
import { useImageAttachments } from "@/lib/use-image-attachments";
import { hasAuthSession } from "@/lib/use-current-user";

type Variant = "dark" | "light";

interface ProjectStarterProps {
  variant?: Variant;
  placeholder?: string;
  /** Where to redirect to /auth from when not signed-in. */
  authRedirect?: string;
}

const DEFAULT_PLACEHOLDER =
  "把任意与产品相关的文字或图片丢给我。可以直接拖图、粘贴图，或者写一句：云南阳光玫瑰，2 斤 39.9 / 5 斤 88，产地直发顺丰冷链。";

export function ProjectStarter({
  variant = "dark",
  placeholder = DEFAULT_PLACEHOLDER,
  authRedirect = "/app",
}: ProjectStarterProps) {
  const navigate = useNavigate();
  const start = useServerFn(startProject);
  const [mode, setMode] = useState<"draft" | "plan">("draft");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const img = useImageAttachments();

  const submit = async () => {
    const value = text.trim();
    const imageUrls = img.getReadyUrls();
    if (img.uploading) {
      toast.error("图片还在上传，稍等片刻");
      return;
    }
    if (value.length < 4 && imageUrls.length === 0) {
      toast.error("再多说两句吧，或者拖一张商品图过来");
      return;
    }
    if (!hasAuthSession()) {
      toast.info("请先登录");
      navigate({ to: "/auth", search: { redirect: authRedirect } });
      return;
    }
    setLoading(true);
    try {
      const res = await start({
        data: {
          description: value || "（仅图片，无文字描述）",
          mode,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        },
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `tuanbao.chat.${res.id}`,
          JSON.stringify(res.seedMessages),
        );
        if (res.autoUserPrompt) {
          window.sessionStorage.setItem(
            `tuanbao.boot.${res.id}`,
            res.autoUserPrompt,
          );
        }
      }
      toast.success(`已识别为「${res.category}」，跳转工作台…`);
      navigate({ to: "/app/project/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "开团失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  const togglePlan = () => {
    setMode((m) => {
      const next = m === "plan" ? "draft" : "plan";
      if (next === "plan") toast.success("已开启计划模式：团宝会先反问澄清");
      else toast("已关闭计划模式");
      return next;
    });
  };

  const isDark = variant === "dark";

  const outerClass = isDark
    ? "rounded-3xl border bg-[oklch(0.16_0.012_50/0.7)] p-3 shadow-[0_30px_80px_-20px_oklch(0_0_0/0.6)] backdrop-blur-xl transition"
    : "rounded-3xl border bg-card p-3 shadow-[var(--shadow-card,0_10px_30px_-12px_oklch(0_0_0/0.18))] transition";

  const innerClass = isDark
    ? "relative rounded-2xl border border-white/10 bg-[oklch(0.13_0.012_50)] p-3 focus-within:border-[oklch(0.7_0.19_45/0.5)]"
    : "relative rounded-2xl border bg-background p-3 focus-within:border-[oklch(0.7_0.19_45/0.5)]";

  const textareaClass = isDark
    ? "block w-full resize-none bg-transparent text-sm leading-relaxed text-white placeholder:text-white/35 focus:outline-none"
    : "block w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none";

  const addImgBtnClass = isDark
    ? "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white/65 hover:bg-white/5 hover:text-white"
    : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground";

  const hintClass = isDark
    ? "hidden text-[11px] text-white/35 sm:inline"
    : "hidden text-[11px] text-muted-foreground sm:inline";

  return (
    <div
      {...img.dragHandlers}
      className={
        outerClass +
        " " +
        (img.dragActive
          ? "border-[oklch(0.7_0.19_45)] ring-4 ring-[oklch(0.7_0.19_45/0.2)]"
          : isDark
            ? "border-white/10"
            : "border-border")
      }
    >
      <div className={innerClass}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={img.onPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={4}
          disabled={loading}
          placeholder={placeholder}
          className={textareaClass}
        />
        {img.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {img.attachments.map((a) => (
              <div
                key={a.id}
                className={
                  "group relative h-16 w-16 overflow-hidden rounded-lg border " +
                  (isDark
                    ? "border-white/10 bg-black/40"
                    : "border-border bg-muted")
                }
              >
                <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                {a.uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-black/50">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
                {a.error && (
                  <div className="absolute inset-0 grid place-items-center bg-[oklch(0.55_0.2_25/0.85)] text-[10px] text-white">
                    失败
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => img.remove(a.id)}
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void img.addFiles(e.target.files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={addImgBtnClass}
            >
              <ImagePlus className="h-3.5 w-3.5" /> 加图片
            </button>
            <span className={hintClass}>或直接拖入 / 粘贴</span>
          </div>
          <div className="flex items-center gap-2">
            <PlanModeChip active={mode === "plan"} onClick={togglePlan} variant={variant} />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading}
              className="brand-glow inline-flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 团宝正在识别…
                </>
              ) : (
                <>
                  {mode === "plan" ? "先聊清楚" : "快速开团"}{" "}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
        {img.dragActive && (
          <div
            className={
              "pointer-events-none absolute inset-0 grid place-items-center rounded-2xl text-sm " +
              (isDark
                ? "bg-[oklch(0.13_0.012_50/0.85)] text-[oklch(0.86_0.14_55)]"
                : "bg-background/85 text-[oklch(0.55_0.2_35)]")
            }
          >
            松开即可加入图片
          </div>
        )}
      </div>
    </div>
  );
}

function PlanModeChip({
  active,
  onClick,
  variant,
}: {
  active: boolean;
  onClick: () => void;
  variant: Variant;
}) {
  const isDark = variant === "dark";
  return (
    <button
      type="button"
      onClick={onClick}
      title="开启后团宝会先反问澄清，再动笔"
      className={
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition " +
        (active
          ? "border-transparent bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-white shadow-[0_6px_20px_-6px_oklch(0.7_0.19_45/0.6)]"
          : isDark
            ? "border-white/25 text-white/75 hover:border-white/45 hover:text-white"
            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground")
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (active ? "bg-white" : isDark ? "bg-white/45" : "bg-muted-foreground")
        }
      />
      <ClipboardList className="h-3.5 w-3.5" />
      {active ? "计划模式 已开" : "计划模式"}
    </button>
  );
}
