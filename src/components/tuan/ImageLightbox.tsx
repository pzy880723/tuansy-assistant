import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export function ImageLightbox({
  open,
  urls,
  index,
  onIndexChange,
  onOpenChange,
}: {
  open: boolean;
  urls: string[];
  index: number;
  onIndexChange?: (i: number) => void;
  onOpenChange: (v: boolean) => void;
}) {
  const [localIdx, setLocalIdx] = useState(index);
  useEffect(() => setLocalIdx(index), [index, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, urls.length]);

  if (!open || typeof document === "undefined") return null;
  const total = urls.length;
  if (total === 0) return null;
  const cur = Math.max(0, Math.min(total - 1, localIdx));
  const url = urls[cur];

  function go(delta: number) {
    if (total <= 1) return;
    const next = (cur + delta + total) % total;
    setLocalIdx(next);
    onIndexChange?.(next);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(false);
        }}
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        title="关闭 (Esc)"
      >
        <X className="h-5 w-5" />
      </button>
      <a
        href={url}
        download
        onClick={(e) => e.stopPropagation()}
        className="absolute right-16 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        title="下载"
      >
        <Download className="h-4 w-4" />
      </a>
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12px] text-white">
            {cur + 1} / {total}
          </div>
        </>
      )}
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] object-contain animate-in zoom-in-95 duration-150"
      />
    </div>,
    document.body,
  );
}
