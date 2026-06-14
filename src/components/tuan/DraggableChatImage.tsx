import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { imageDragBus } from "@/lib/drag-image-bus";

/** Chat-side AI-generated image thumbnail.
 *  - Click (no drag): opens lightbox via onPreview.
 *  - Drag (move ≥5px): starts cross-pane image drag via imageDragBus.
 *    Right-side preview hit-tests and inserts an image_lg block on drop.
 */
export function DraggableChatImage({
  url,
  onPreview,
  className,
  imgClassName,
  alt = "",
}: {
  url: string;
  onPreview: () => void;
  className?: string;
  imgClassName?: string;
  alt?: string;
}) {
  const startRef = useRef<{ x: number; y: number; pid: number } | null>(null);
  const draggingRef = useRef(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, pid: e.pointerId };
    draggingRef.current = false;

    const onMove = (ev: PointerEvent) => {
      if (!startRef.current || ev.pointerId !== startRef.current.pid) return;
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      if (!draggingRef.current && Math.hypot(dx, dy) > 5) {
        draggingRef.current = true;
        imageDragBus.start(url, ev.clientX, ev.clientY);
      }
      if (draggingRef.current) imageDragBus.move(ev.clientX, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      const wasDragging = draggingRef.current;
      const start = startRef.current;
      startRef.current = null;
      draggingRef.current = false;
      if (wasDragging) {
        imageDragBus.tryDrop(ev.clientX, ev.clientY);
        imageDragBus.end();
      } else if (start && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) {
        onPreview();
      }
    };
    const onCancel = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      startRef.current = null;
      draggingRef.current = false;
      imageDragBus.end();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      style={{ touchAction: "none" }}
      title="点击放大 · 按住拖到右侧预览插入"
      className={cn(
        "group relative block overflow-hidden rounded-lg border bg-background cursor-grab active:cursor-grabbing focus:outline-none",
        className,
      )}
    >
      <img
        src={url}
        alt={alt}
        draggable={false}
        className={cn("h-full w-full object-cover select-none", imgClassName)}
      />
      <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
        点击看大图 · 拖到右侧
      </span>
    </button>
  );
}
