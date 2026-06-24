import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function MobileUploadQRDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [url, setUrl] = useState<string>("");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    const u = `${window.location.origin}/m/inbox?project=${projectId}`;
    setUrl(u);
    QRCode.toDataURL(u, { width: 440, margin: 1, errorCorrectionLevel: "M" })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [open, projectId]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // 关闭弹窗时刷新当前项目的素材库，把刚扫码上传的图拉出来
      qc.invalidateQueries({ queryKey: ["project-assets", projectId] });
    }
    onOpenChange(next);
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("链接已复制");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>扫码用手机上传图片</DialogTitle>
          <DialogDescription>
            用微信/相机扫一扫，手机选图后会自动进入本项目的素材库。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="grid h-[220px] w-[220px] place-items-center rounded-md border bg-white p-2">
            {dataUrl ? (
              <img src={dataUrl} alt="扫码上传二维码" className="h-full w-full" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="text-[11px] text-muted-foreground text-center">
            手机和电脑可以是不同网络，扫码后需登录同一账号。
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={copy}
            disabled={!url}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            复制链接
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
