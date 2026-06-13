import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, Copy, RefreshCw, ExternalLink } from "lucide-react";
import { createExportToken } from "@/lib/export-project.functions";

function buildUrl(token: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://tuansy-assistant.lovable.app";
  return `${origin}/api/public/export-project?token=${token}`;
}

export function ExportToKttDialog({ projectId }: { projectId: string }) {
  const create = useServerFn(createExportToken);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await create({ data: { projectId } });
      setToken(res.token);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} 已复制`);
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !token) void generate();
        if (!v) setToken(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          title="生成导出链接，配合 Chrome 插件填入快团团后台"
          className="inline-flex h-7 items-center gap-1 rounded-md border bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] px-2 text-[11px] font-medium text-white shadow-[0_2px_8px_-2px_oklch(0.7_0.19_45/0.5)] transition hover:brightness-110"
        >
          <Send className="h-3 w-3" /> 发送到快团团
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-5 py-3 text-left">
          <DialogTitle className="text-sm">发送到快团团</DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            装好「团宝 · 快团团自动填入」Chrome 插件后，把下面的链接粘贴进去，就能一键填入后台。
          </p>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4 text-xs">
          {loading && (
            <div className="rounded-md border bg-muted px-3 py-4 text-center text-muted-foreground">
              生成中…
            </div>
          )}
          {token && (
            <>
              <div>
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">导出链接</div>
                <div className="flex items-stretch gap-1">
                  <input
                    readOnly
                    value={buildUrl(token)}
                    className="flex-1 rounded-md border bg-muted px-2 py-1.5 font-mono text-[10px]"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-auto px-2"
                    onClick={() => copy(buildUrl(token), "链接")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">仅 Token（可选）</div>
                <div className="flex items-stretch gap-1">
                  <input
                    readOnly
                    value={token}
                    className="flex-1 rounded-md border bg-muted px-2 py-1.5 font-mono text-[10px]"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-auto px-2"
                    onClick={() => copy(token, "Token")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                ⏱️ 30 分钟内有效。过期后回到这里重新生成即可。
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <a
                  href="/extension"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> 下载/安装插件
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setToken(null);
                    void generate();
                  }}
                >
                  <RefreshCw className="mr-1 h-3 w-3" /> 重新生成
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
