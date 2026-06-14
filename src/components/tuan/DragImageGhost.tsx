import { createPortal } from "react-dom";
import { useImageDrag } from "@/lib/drag-image-bus";

/** Floating image thumbnail that follows the cursor during a cross-pane drag. */
export function DragImageGhost() {
  const drag = useImageDrag();
  if (!drag || typeof document === "undefined") return null;
  const SIZE = 96;
  return createPortal(
    <div
      className="pointer-events-none fixed z-[300] overflow-hidden rounded-lg border-2 border-[#07c160] bg-white shadow-2xl"
      style={{
        left: drag.x - SIZE / 2,
        top: drag.y - SIZE / 2,
        width: SIZE,
        height: SIZE,
        transform: "rotate(-3deg)",
      }}
    >
      <img src={drag.url} alt="" className="h-full w-full object-cover" draggable={false} />
    </div>,
    document.body,
  );
}
