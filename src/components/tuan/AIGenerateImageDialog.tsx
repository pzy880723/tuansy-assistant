import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
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

const COUNT_OPTIONS = [1, 3, 6, 9] as const;

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
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { attachments, addFiles, remove, clear } = useImageAttachments({
    projectId,
  });

  useEffect(() => {
    if (open) {
      setPrompt(defaultPrompt ?? "");
      setCount(3);
      clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPrompt]);

  const referenceUrls = attachments
    .filter((a) => !a.uploading && a.url)
    .map((a) => a.url as string);
  const stillUploading = attachments.some((a) => a.uploading);

  const onSubmit = async () => {
    const p = prompt.trim();
    if (!p) {
      toast.warning("请填写图片描述");
      return;
    }
    if (stillUploading) {
      toast.warning("参考图正在上传中，请稍候");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          count,
          referenceImages: referenceUrls.length > 0 ? referenceUrls : undefined,
          projectId,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "生图失败");
        if (res.status === 402) toast.error("AI 额度不足，请联系管理员充值");
        else if (res.status === 429) toast.error("请求太频繁，请稍后再试");
        else toast.error(text || "生图失败");
        return;
      }
      const data = (await res.json()) as { urls?: string[] };
      const urls = data.urls ?? [];
      if (urls.length === 0) {
        toast.error("没有生成任何图片");
        return;
      }
      if (urls.length < count) {
        toast.warning(`成功生成 ${urls.length}/${count} 张`);
      } else {
        toast.success(`已生成 ${urls.length} 张图`);
      }
      onComplete(urls);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[#07c160]" />
            AI 快速生图
          </DialogTitle>
          <DialogDescription className="text-xs">
            根据文字描述生成商品配图，可上传参考图保持风格一致
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prompt */}
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

          {/* Count */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#646566]">生成数量</label>
            <div className="flex gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-[13px] transition",
                    count === n
                      ? "border-[#07c160] bg-[#07c160]/10 text-[#07c160]"
                      : "border-[#dcdee0] text-[#646566] hover:border-[#07c160]/50",
                  )}
                >
                  {n} 张
                </button>
              ))}
            </div>
          </div>

          {/* Reference images */}
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-8"
          >
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || stillUploading}
            className="h-8 bg-[#07c160] hover:bg-[#06ae56]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                开始生成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
