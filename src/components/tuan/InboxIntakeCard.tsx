import { useState } from "react";
import { Inbox, Loader2, Smartphone, Link as LinkIcon, FileText } from "lucide-react";
import { DraggableChatImage } from "./DraggableChatImage";
import { ImageLightbox } from "./ImageLightbox";

export type InboxItemLite = {
  id: string;
  kind: "image" | "text" | "link";
  payload: { urls?: string[]; text?: string; url?: string; title?: string };
  note?: string | null;
  created_at: string;
};

export function InboxIntakeCard({
  items,
  busy,
  onAdoptAll,
  onLibraryOnly,
  onIgnoreAll,
}: {
  items: InboxItemLite[];
  busy: "adopt" | "library" | "ignore" | null;
  onAdoptAll: () => void;
  onLibraryOnly: () => void;
  onIgnoreAll: () => void;
}) {
  const allImageUrls: string[] = [];
  for (const it of items) {
    if (it.kind === "image" && Array.isArray(it.payload.urls)) {
      for (const u of it.payload.urls) if (typeof u === "string") allImageUrls.push(u);
    }
  }
  const texts = items.filter((it) => it.kind === "text" && it.payload.text);
  const links = items.filter((it) => it.kind === "link" && it.payload.url);
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  const disabled = busy !== null;

  return (
    <div className="mx-auto w-full max-w-[95%] rounded-2xl border border-orange-200 bg-gradient-to-br from-[#fff7ed] to-white p-3.5 shadow-[0_8px_24px_-12px_rgba(234,88,12,0.25)]">
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/15 text-orange-600">
          <Smartphone className="h-3.5 w-3.5" />
        </span>
        手机收料台 · 新发来 {items.length} 条
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-600">
          <Inbox className="h-3 w-3" />
          待你确认
        </span>
      </div>

      {allImageUrls.length > 0 && (
        <div className="mb-2.5">
          <div className="mb-1.5 text-[11.5px] text-muted-foreground">
            图片 {allImageUrls.length} 张 · 点击放大，按住可拖到右侧预览
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
            {allImageUrls.map((u, i) => (
              <DraggableChatImage
                key={u + i}
                url={u}
                alt=""
                onPreview={() => setLightbox({ open: true, index: i })}
                className="aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-orange-100"
                imgClassName="h-full w-full object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {texts.length > 0 && (
        <div className="mb-2.5 space-y-1.5">
          {texts.map((it) => (
            <div
              key={it.id}
              className="flex gap-2 rounded-lg border border-orange-100 bg-white/70 p-2 text-[12px]"
            >
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
              <div className="line-clamp-4 whitespace-pre-wrap text-foreground/90">
                {it.payload.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="mb-2.5 space-y-1.5">
          {links.map((it) => (
            <a
              key={it.id}
              href={it.payload.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-orange-100 bg-white/70 p-2 text-[12px] hover:bg-white"
            >
              <LinkIcon className="h-3.5 w-3.5 shrink-0 text-orange-500" />
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium">{it.payload.title || it.payload.url}</span>
                <span className="ml-1.5 text-muted-foreground">
                  {(() => {
                    try {
                      return new URL(it.payload.url!).hostname;
                    } catch {
                      return "";
                    }
                  })()}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onAdoptAll}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] px-3.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {busy === "adopt" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          全部使用 →
        </button>
        <button
          type="button"
          disabled={disabled || allImageUrls.length === 0}
          onClick={onLibraryOnly}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 text-[12px] text-foreground hover:bg-orange-50 disabled:opacity-50"
        >
          {busy === "library" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          只入素材库
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onIgnoreAll}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {busy === "ignore" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          全部忽略
        </button>
      </div>

      <ImageLightbox
        open={lightbox.open}
        urls={allImageUrls}
        index={lightbox.index}
        onOpenChange={(open) => setLightbox((s) => ({ ...s, open }))}
        onIndexChange={(index) => setLightbox((s) => ({ ...s, index }))}
      />
    </div>
  );
}
