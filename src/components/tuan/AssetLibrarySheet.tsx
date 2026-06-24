import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Images, Check, Plus, Trash2, Loader2, Smartphone, Sparkles, Upload, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  listProjectAssets,
  appendImagesToPreview,
  deleteProjectAsset,
} from "@/lib/projects.functions";
import { cn } from "@/lib/utils";
import { MobileUploadQRDialog } from "@/components/copy-logic/MobileUploadQRDialog";
import { Button } from "@/components/ui/button";


type AssetSource = "manual" | "ai" | "inbox";
type Asset = {
  id: string;
  url: string;
  source: AssetSource;
  created_at: string;
  used_in_preview: boolean;
};

const sourceMeta: Record<AssetSource, { label: string; icon: typeof Smartphone; color: string }> = {
  manual: { label: "上传", icon: Upload, color: "bg-slate-500/85" },
  ai: { label: "AI", icon: Sparkles, color: "bg-[#07c160]/90" },
  inbox: { label: "手机", icon: Smartphone, color: "bg-indigo-500/90" },
};

export function AssetLibraryButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const listFn = useServerFn(listProjectAssets);
  const { data } = useQuery({
    queryKey: ["project-assets", projectId],
    queryFn: () => listFn({ data: { projectId } }),
    staleTime: 10_000,
  });
  const total = data?.assets.length ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          title="项目素材库"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Images className="h-3.5 w-3.5" />
          <span>素材库</span>
          {total > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-foreground">
              {total}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b px-5 py-3.5">
          <SheetTitle className="flex items-center gap-2 pr-8 text-base">
            <Images className="h-4 w-4" /> 项目素材库
            {total > 0 && (
              <span className="text-xs font-normal text-muted-foreground">共 {total} 张</span>
            )}
          </SheetTitle>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              手机收料 / AI 生图 / 上传的图片都在这里
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="h-3.5 w-3.5" />
              扫码手机上传
            </Button>
          </div>
        </SheetHeader>
        <AssetLibraryBody
          projectId={projectId}
          assets={data?.assets ?? []}
          onClose={() => setOpen(false)}
        />
        <MobileUploadQRDialog
          projectId={projectId}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      </SheetContent>
    </Sheet>
  );
}


function AssetLibraryBody({
  projectId,
  assets,
  onClose,
}: {
  projectId: string;
  assets: Asset[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const appendFn = useServerFn(appendImagesToPreview);
  const deleteFn = useServerFn(deleteProjectAsset);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = (tab: "all" | AssetSource) =>
    tab === "all" ? assets : assets.filter((a) => a.source === tab);

  const insert = async (a: Asset) => {
    if (busyId) return;
    setBusyId(a.id);
    try {
      await appendFn({ data: { projectId, urls: [a.url] } });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["project-assets", projectId] });
      toast.success("已插入到预览末尾");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "插入失败");
    } finally {
      setBusyId(null);
    }
  };

  const useInEditor = async (a: Asset) => {
    try {
      await navigator.clipboard.writeText(a.url);
      toast.success("已复制图片地址，可在编辑页选择「从已上传图片中选择」插入");
      onClose();
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const remove = async (a: Asset) => {
    setBusyId(a.id);
    try {
      await deleteFn({ data: { id: a.id } });
      qc.invalidateQueries({ queryKey: ["project-assets", projectId] });
      toast.success("已从素材库移除");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  };

  const count = (s: "all" | AssetSource) => filtered(s).length;

  return (
    <Tabs defaultValue="all" className="flex flex-1 flex-col overflow-hidden">
      <TabsList className="m-3 mb-2 grid grid-cols-4">
        <TabsTrigger value="all">全部 {count("all") > 0 && `(${count("all")})`}</TabsTrigger>
        <TabsTrigger value="inbox">
          手机 {count("inbox") > 0 && `(${count("inbox")})`}
        </TabsTrigger>
        <TabsTrigger value="ai">AI {count("ai") > 0 && `(${count("ai")})`}</TabsTrigger>
        <TabsTrigger value="manual">
          上传 {count("manual") > 0 && `(${count("manual")})`}
        </TabsTrigger>
      </TabsList>
      {(["all", "inbox", "ai", "manual"] as const).map((t) => (
        <TabsContent key={t} value={t} className="mt-0 flex-1 overflow-y-auto px-3 pb-4">
          <AssetGrid
            items={filtered(t)}
            busyId={busyId}
            onInsert={insert}
            onUseInEditor={useInEditor}
            onRemove={remove}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function AssetGrid({
  items,
  busyId,
  onInsert,
  onUseInEditor,
  onRemove,
}: {
  items: Asset[];
  busyId: string | null;
  onInsert: (a: Asset) => void;
  onUseInEditor: (a: Asset) => void;
  onRemove: (a: Asset) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="grid h-full place-items-center py-16 text-center text-xs text-muted-foreground">
        <div>
          <Images className="mx-auto mb-2 h-6 w-6 opacity-50" />
          <div>暂无素材</div>
          <div className="mt-1 text-[11px]">手机收料、AI 生图、聊天上传的图片都会出现在这里</div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((a) => {
        const meta = sourceMeta[a.source];
        const Icon = meta.icon;
        const busy = busyId === a.id;
        return (
          <div
            key={a.id}
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            <img src={a.url} alt="" className="h-full w-full object-cover" />
            {/* Source badge */}
            <span
              className={cn(
                "absolute left-1 top-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium text-white",
                meta.color,
              )}
            >
              <Icon className="h-2.5 w-2.5" /> {meta.label}
            </span>
            {a.used_in_preview && (
              <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-[#07c160] px-1 py-0.5 text-[9px] font-medium text-white">
                <Check className="h-2.5 w-2.5" /> 已用
              </span>
            )}
            {/* Hover actions */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 opacity-0 transition group-hover:opacity-100">
              <button
                disabled={busy}
                onClick={() => onInsert(a)}
                title="追加到商品预览图片列表的末尾"
                className="inline-flex w-[88%] items-center justify-center gap-1 rounded bg-[#07c160] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#06ad56] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                追加到预览末尾
              </button>
              <button
                disabled={busy}
                onClick={() => onUseInEditor(a)}
                className="w-[88%] rounded bg-white/95 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-white"
              >
                复制地址去编辑页
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-white/80 hover:text-white"
                  >
                    <Trash2 className="h-2.5 w-2.5" /> 删除
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>从素材库移除这张图？</AlertDialogTitle>
                    <AlertDialogDescription>
                      仅从素材库移除；如果预览中已使用，不会影响预览中的图片。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onRemove(a)}>删除</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        );
      })}
    </div>
  );
}
