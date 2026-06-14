import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Download, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createExportToken } from "@/lib/export-project.functions";

// Probe the installed extension via window.postMessage. Resolves to the
// extension version string when present, or null after timeout.
function pingExtension(timeoutMs = 600): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  // DOM marker fallback (set by extension bridge.js immediately on load)
  const marker = document.documentElement.getAttribute("data-tb-installed");
  if (marker) return Promise.resolve(marker);

  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const data = e.data;
      if (data && data.type === "TB_PONG") {
        window.removeEventListener("message", onMsg);
        clearTimeout(t);
        resolve(typeof data.version === "string" ? data.version : "ok");
      }
    };
    window.addEventListener("message", onMsg);
    const t = setTimeout(() => {
      window.removeEventListener("message", onMsg);
      resolve(null);
    }, timeoutMs);
    window.postMessage({ type: "TB_PING" }, "*");
  });
}

export function SyncToKttButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const create = useServerFn(createExportToken);
  const [busy, setBusy] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);

  const doSync = async () => {
    setBusy(true);
    try {
      const version = await pingExtension();
      if (!version) {
        setInstallOpen(true);
        return;
      }
      const { token } = await create({ data: { projectId } });
      window.postMessage(
        {
          type: "TB_SYNC",
          token,
          origin: window.location.origin,
          projectName: projectName || "",
        },
        "*",
      );
      toast.success("已发送到插件，正在打开快团团…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "同步失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 rounded-full px-3 text-xs"
        onClick={doSync}
        disabled={busy}
        title="一键填入快团团 PC 后台"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ExternalLink className="h-3.5 w-3.5" />
        )}
        同步到快团团
      </Button>

      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="max-w-sm gap-0 p-0">
          <DialogHeader className="border-b px-5 py-3 text-left">
            <DialogTitle className="text-sm">先安装 Chrome 插件</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4 text-xs text-muted-foreground">
            <p>
              检测到你还没装「团宝 · 快团团助手」插件。装好后回到这里点一次"同步到快团团"，
              我会自动打开快团团后台并填入项目内容。
            </p>
            <p className="text-[11px]">装完插件如果还是检测不到，请刷新这个页面。</p>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={async () => {
                const v = await pingExtension(800);
                if (v) {
                  setInstallOpen(false);
                  void doSync();
                } else {
                  toast.error("还没检测到插件，装好后请刷新页面");
                }
              }}
            >
              <RotateCw className="mr-1 h-3 w-3" /> 我已安装，重试
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => window.open("/extension", "_blank")}
            >
              <Download className="mr-1 h-3 w-3" /> 下载插件
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
