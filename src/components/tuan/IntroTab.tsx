import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import {
  Image as ImageIcon,
  LayoutGrid,
  Video,
  PenSquare,
  GripVertical,
  X,
  Upload,
  ArrowLeftRight,
  Search,
  Plus,
  Sparkles,
  Play,
  Lock,
  Unlock,
  Wand2,
  Send,
  Loader2,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { InlineText, MiniBtn } from "./primitives";
import { type IntroBlock, type IntroData, blockMentionToken } from "./types";
import { AIGenerateImageDialog } from "./AIGenerateImageDialog";
import { ImageLightbox } from "./ImageLightbox";
import { uploadProductImage } from "@/lib/projects.functions";
import { imageDragBus, useImageDrag } from "@/lib/drag-image-bus";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Shared compression helpers (same approach as use-image-attachments).
async function leaderCompressImage(file: File): Promise<{ blob: Blob; mimeType: string }> {
  if (!file.type.startsWith("image/")) return { blob: file, mimeType: file.type };
  if (file.size < 400 * 1024 || file.type === "image/gif" || file.type === "image/svg+xml") {
    return { blob: file, mimeType: file.type };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, mimeType: file.type };
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!out) return { blob: file, mimeType: file.type };
    return { blob: out, mimeType: "image/jpeg" };
  } catch {
    return { blob: file, mimeType: file.type };
  }
}
function leaderBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}


type ToolType = "image_lg" | "image_sm" | "video" | "text";

const BLOCK_TOOLS: { type: ToolType; label: string; icon: typeof ImageIcon }[] = [
  { type: "image_lg", label: "大图", icon: ImageIcon },
  { type: "image_sm", label: "小图", icon: LayoutGrid },
  { type: "video", label: "视频", icon: Video },
  { type: "text", label: "文字", icon: PenSquare },
];

const MAX_SMALL_IMAGES = 9;

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Auto-resizing textarea that grows with content. Never overwrites local
 *  state while focused (prevents cursor jump / lost chars). */
function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [local]);
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flushNow = () => {
    if (t.current) clearTimeout(t.current);
    if (pending.current !== null) {
      const v = pending.current;
      pending.current = null;
      onChange(v);
    }
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={local}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        flushNow();
        onBlur?.(local);
      }}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        pending.current = v;
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => {
          pending.current = null;
          onChange(v);
        }, 250);
      }}
      className={
        "w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-[#c8c9cc] " +
        "rounded-md px-1 py-0.5 -mx-1 transition focus:bg-white focus:ring-2 focus:ring-[#07c160]/30 " +
        (className ?? "")
      }
    />
  );
}

export function IntroTab({
  intro,
  onChange,
  projectId,
  onAskAI,
  availableImages,
  onRegenerateBackground,
  backgroundGenerating,
}: {
  intro: IntroData;
  onChange: (next: IntroData) => void;
  projectId?: string;
  /** Send a natural-language instruction to 团宝 on behalf of the user.
   *  Used by the per-block "AI 丰富" popover. */
  onAskAI?: (text: string) => void;
  /** URLs of already-uploaded product images, for the "从已上传图选" picker. */
  availableImages?: string[];
  /** Trigger an AI regeneration of the leader background image. */
  onRegenerateBackground?: () => void;
  backgroundGenerating?: boolean;
}) {
  const blocks = intro.blocks ?? [];
  const setBlocks = (next: IntroBlock[]) => onChange({ ...intro, blocks: next });

  // Leader avatar upload
  const leaderAvatarRef = useRef<HTMLInputElement | null>(null);
  const leaderBgRef = useRef<HTMLInputElement | null>(null);
  const [bgPopOpen, setBgPopOpen] = useState(false);
  const uploadLeaderImage = useServerFn(uploadProductImage);
  const onPickLeaderAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { blob, mimeType } = await leaderCompressImage(file);
      const base64 = await leaderBlobToBase64(blob);
      const res = await uploadLeaderImage({
        data: { projectId, filename: file.name, mimeType, dataBase64: base64 },
      });
      onChange({ ...intro, leader_avatar: res.url });
      toast.success("头像已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    }
  };
  const onPickLeaderBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { blob, mimeType } = await leaderCompressImage(file);
      const base64 = await leaderBlobToBase64(blob);
      const res = await uploadLeaderImage({
        data: { projectId, filename: file.name, mimeType, dataBase64: base64 },
      });
      onChange({ ...intro, leader_bg_url: res.url });
      setBgPopOpen(false);
      toast.success("背景图已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    }
  };


  // AI generate-image dialog state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const aiTargetIdRef = useRef<string | null>(null);

  // Lightbox state (for preview-side images)
  const [lightbox, setLightbox] = useState<{ open: boolean; urls: string[]; index: number }>({
    open: false,
    urls: [],
    index: 0,
  });
  const openPreviewImage = (urls: string[], index: number) =>
    setLightbox({ open: true, urls, index });

  // hidden file inputs
  const fileLgRef = useRef<HTMLInputElement | null>(null);
  const fileSmRef = useRef<HTMLInputElement | null>(null);
  const fileVidRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetRef = useRef<string | null>(null);

  // Inline text editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  const pickFile = (tool: ToolType, replaceId?: string) => {
    replaceTargetRef.current = replaceId ?? null;
    if (tool === "image_lg") fileLgRef.current?.click();
    else if (tool === "image_sm") fileSmRef.current?.click();
    else if (tool === "video") fileVidRef.current?.click();
  };

  const onPickImageLg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const replaceId = replaceTargetRef.current;
    if (replaceId) {
      setBlocks(blocks.map((b) => (b.id === replaceId && b.type === "image_lg" ? { ...b, url } : b)));
    } else {
      setBlocks([...blocks, { id: genId(), type: "image_lg", url }]);
    }
  };
  const onPickImageSm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const replaceId = replaceTargetRef.current;
    if (replaceId) {
      const target = blocks.find((b) => b.id === replaceId);
      if (target && target.type === "image_sm") {
        const remaining = MAX_SMALL_IMAGES - target.urls.length;
        if (remaining <= 0) {
          toast.warning(`最多 ${MAX_SMALL_IMAGES} 张图片`);
          return;
        }
        const accepted = files.slice(0, remaining);
        if (files.length > remaining) toast.warning(`最多 ${MAX_SMALL_IMAGES} 张图片`);
        const urls = accepted.map((f) => URL.createObjectURL(f));
        setBlocks(
          blocks.map((b) =>
            b.id === replaceId && b.type === "image_sm" ? { ...b, urls: [...b.urls, ...urls] } : b,
          ),
        );
      }
    } else {
      const accepted = files.slice(0, MAX_SMALL_IMAGES);
      if (files.length > MAX_SMALL_IMAGES) toast.warning(`最多 ${MAX_SMALL_IMAGES} 张图片`);
      const urls = accepted.map((f) => URL.createObjectURL(f));
      setBlocks([...blocks, { id: genId(), type: "image_sm", urls }]);
    }
  };
  const onPickVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const replaceId = replaceTargetRef.current;
    if (replaceId) {
      setBlocks(blocks.map((b) => (b.id === replaceId && b.type === "video" ? { ...b, url } : b)));
    } else {
      setBlocks([...blocks, { id: genId(), type: "video", url }]);
    }
  };

  const onToolClick = (type: ToolType) => {
    if (type === "text") {
      const id = genId();
      setBlocks([...blocks, { id, type: "text", text: "" }]);
      setEditingId(id);
    } else {
      pickFile(type);
    }
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (editingId === id) setEditingId(null);
  };
  const toggleLock = (id: string) => {
    setBlocks(
      blocks.map((b) => (b.id === id ? ({ ...b, locked: !b.locked } as IntroBlock) : b)),
    );
  };
  const removeSmallImage = (blockId: string, idx: number) => {
    setBlocks(
      blocks.map((b) =>
        b.id === blockId && b.type === "image_sm"
          ? { ...b, urls: b.urls.filter((_, i) => i !== idx) }
          : b,
      ),
    );
  };
  const moveBlock = (id: string, dir: "up" | "down" | "top") => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const next = blocks.slice();
    const [item] = next.splice(i, 1);
    if (dir === "top") next.unshift(item);
    else if (dir === "up") next.splice(Math.max(0, i - 1), 0, item);
    else next.splice(Math.min(next.length, i + 1), 0, item);
    setBlocks(next);
  };
  const moveToIndex = (id: string, index: number) => {
    const src = blocks.findIndex((b) => b.id === id);
    if (src < 0) return;
    const next = blocks.slice();
    const [item] = next.splice(src, 1);
    const dst = src < index ? index - 1 : index;
    next.splice(Math.max(0, Math.min(next.length, dst)), 0, item);
    setBlocks(next);
  };
  const updateText = (id: string, text: string) => {
    setBlocks(blocks.map((b) => (b.id === id && b.type === "text" ? { ...b, text } : b)));
  };
  const finishEditing = (id: string, finalText: string) => {
    if (!finalText.trim()) {
      setBlocks(blocks.filter((b) => b.id !== id));
    }
    setEditingId((cur) => (cur === id ? null : cur));
  };

  // ============= Drag-to-reorder state =============
  // UX: pressing the grip immediately shrinks the WHOLE intro preview into a
  // half-width floating thumbnail anchored under the cursor. Only the preview
  // area gets a blur backdrop; the rest of the page is unaffected. Inside
  // the thumbnail, blocks slide to open a gap at the live drop position so
  // the user can land precisely.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerBlockRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) blockRefs.current.set(id, el);
    else blockRefs.current.delete(id);
  };
  // Refs to the block elements rendered INSIDE the floating thumbnail.
  // These are what we hit-test against for the drop index.
  const ghostBlockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const registerGhostRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) ghostBlockRefs.current.set(id, el);
    else ghostBlockRefs.current.delete(id);
  };
  // Scroll container inside the fixed thumbnail (for auto-scroll near edges).
  const ghostScrollRef = useRef<HTMLDivElement | null>(null);

  const GHOST_SCALE = 0.5;

  type DragState = {
    id: string;
    pointerId: number;
    // Bounding rect of the preview at drag-start (for the blur backdrop and
    // the thumbnail's fixed position/size).
    cRect: { left: number; top: number; width: number; height: number };
    // Current pointer in viewport coords.
    pointerX: number;
    pointerY: number;
    // Drop index within the compacted (others) list.
    dropIndex: number;
    // Height of the dragged block in the live preview (for the in-ghost gap).
    blockHeight: number;
  };
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const commitReorder = (id: string, dropIndex: number) => {
    const src = blocks.findIndex((b) => b.id === id);
    if (src < 0) return;
    const next = blocks.slice();
    const [item] = next.splice(src, 1);
    const clamped = Math.max(0, Math.min(next.length, dropIndex));
    next.splice(clamped, 0, item);
    setBlocks(next);
  };

  const startDrag = (id: string, e: React.PointerEvent) => {
    const container = containerRef.current;
    const el = blockRefs.current.get(id);
    if (!container || !el) return;
    const cRect = container.getBoundingClientRect();
    const bRect = el.getBoundingClientRect();
    const origIdx = blocks.findIndex((b) => b.id === id);
    setDrag({
      id,
      pointerId: e.pointerId,
      cRect: { left: cRect.left, top: cRect.top, width: cRect.width, height: cRect.height },
      pointerX: e.clientX,
      pointerY: e.clientY,
      dropIndex: origIdx < 0 ? 0 : origIdx,
      blockHeight: bRect.height,
    });
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    e.preventDefault();
  };

  useEffect(() => {
    if (!drag) return;
    const id = drag.id;
    const pid = drag.pointerId;

    const computeDropIndex = (y: number): number => {
      // Hit-test against blocks rendered INSIDE the floating thumbnail —
      // that's the surface the user actually sees and aims at.
      const others = blocks.filter((b) => b.id !== id);
      for (let i = 0; i < others.length; i++) {
        const el = ghostBlockRefs.current.get(others[i].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) return i;
      }
      return others.length;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      const dropIndex = computeDropIndex(e.clientY);
      setDrag((cur) =>
        cur ? { ...cur, pointerX: e.clientX, pointerY: e.clientY, dropIndex } : cur,
      );
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      const final = dragRef.current;
      if (final) commitReorder(final.id, final.dropIndex);
      setDrag(null);
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      setDrag(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrag(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    // Auto-scroll inside the fixed thumbnail when pointer is near its edges.
    const EDGE = 60;
    const MAX_SPEED = 14;
    let raf = 0;
    const tick = () => {
      const s = ghostScrollRef.current;
      const cur = dragRef.current;
      if (s && cur) {
        const r = s.getBoundingClientRect();
        const y = cur.pointerY;
        let dy = 0;
        if (y < r.top + EDGE) {
          dy = -MAX_SPEED * (1 - Math.max(0, (y - r.top) / EDGE));
        } else if (y > r.bottom - EDGE) {
          dy = MAX_SPEED * (1 - Math.max(0, (r.bottom - y) / EDGE));
        }
        if (dy !== 0) {
          const before = s.scrollTop;
          s.scrollTop += dy;
          if (s.scrollTop !== before) {
            // Recompute drop index against newly visible blocks, and
            // trigger a re-render so the dragged module's translateY
            // (which depends on scrollTop) follows the scroll.
            const others = blocks.filter((b) => b.id !== cur.id);
            let nextIdx = others.length;
            for (let i = 0; i < others.length; i++) {
              const el = ghostBlockRefs.current.get(others[i].id);
              if (!el) continue;
              const rr = el.getBoundingClientRect();
              if (cur.pointerY < rr.top + rr.height / 2) {
                nextIdx = i;
                break;
              }
            }
            setDrag((c) => (c ? { ...c, dropIndex: nextIdx } : c));
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);


    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.pointerId]);

  // Per-block translateY INSIDE the thumbnail — opens a gap where the
  // dragged block will land. Uses scaled block height for visual continuity.
  const ghostTranslateOf = (blockId: string): number => {
    if (!drag || blockId === drag.id) return 0;
    const others = blocks.filter((b) => b.id !== drag.id);
    const ci = others.findIndex((b) => b.id === blockId);
    if (ci < 0) return 0;
    const gap = Math.max(24, drag.blockHeight * GHOST_SCALE + 6);
    return ci >= drag.dropIndex ? gap : 0;
  };


  const openAIForBlock = (id: string, fallback: string) => {
    aiTargetIdRef.current = id;
    const b = blocks.find((x) => x.id === id);
    const text = b && b.type === "text" ? b.text : "";
    setAiPrompt((text || fallback || intro.description || intro.title || "").trim());
    setAiOpen(true);
  };
  const openAIForWhole = () => {
    aiTargetIdRef.current = null;
    setAiPrompt(
      [intro.title, intro.description].filter(Boolean).join("\n").trim() || "",
    );
    setAiOpen(true);
  };

  const handleAIComplete = (urls: string[], mode: "lg" | "sm") => {
    if (urls.length === 0) return;
    const targetId = aiTargetIdRef.current;
    const list = blocks.slice();
    let insertAfter = targetId ? list.findIndex((b) => b.id === targetId) : list.length - 1;
    if (insertAfter < 0) insertAfter = list.length - 1;
    const newBlocks: IntroBlock[] =
      mode === "sm"
        ? [{ id: genId(), type: "image_sm", urls }]
        : urls.map((url) => ({ id: genId(), type: "image_lg", url }));
    list.splice(insertAfter + 1, 0, ...newBlocks);
    setBlocks(list);
  };

  const draggedBlock = drag ? blocks.find((b) => b.id === drag.id) : null;

  // ============= Cross-pane image drag (from chat) =============
  // Subscribe to incoming chat-image drags; show drop indicator and accept drop.
  const incomingDrag = useImageDrag();
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const [incomingDropIdx, setIncomingDropIdx] = useState<number | null>(null);

  // Helper: find block index where pointer Y lands (inserts BEFORE this index).
  const computeIncomingDropIndex = (y: number): number => {
    const list = blocksRef.current;
    for (let i = 0; i < list.length; i++) {
      const el = blockRefs.current.get(list[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return list.length;
  };

  // Register the drop handler once; commit insertion when chat releases.
  useEffect(() => {
    const off = imageDragBus.registerDropHandler((x, y, url) => {
      const c = containerRef.current;
      if (!c) return false;
      const r = c.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
      const idx = computeIncomingDropIndex(y);
      const next = blocksRef.current.slice();
      next.splice(idx, 0, { id: genId(), type: "image_lg", url });
      setBlocks(next);
      toast.success("已插入大图");
      setIncomingDropIdx(null);
      return true;
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track pointer position to show insertion-line indicator.
  useEffect(() => {
    if (!incomingDrag) {
      setIncomingDropIdx(null);
      return;
    }
    const c = containerRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const inside =
      incomingDrag.x >= r.left &&
      incomingDrag.x <= r.right &&
      incomingDrag.y >= r.top &&
      incomingDrag.y <= r.bottom;
    setIncomingDropIdx(inside ? computeIncomingDropIndex(incomingDrag.y) : null);
  }, [incomingDrag]);

  // Position of the insertion line in viewport coords (rendered via portal).
  const incomingLineRect = (() => {
    if (incomingDropIdx == null) return null;
    const c = containerRef.current;
    if (!c) return null;
    const list = blocksRef.current;
    if (list.length === 0) {
      const r = c.getBoundingClientRect();
      return { left: r.left + 12, width: r.width - 24, top: r.top + r.height / 2 };
    }
    if (incomingDropIdx >= list.length) {
      const lastEl = blockRefs.current.get(list[list.length - 1].id);
      if (!lastEl) return null;
      const r = lastEl.getBoundingClientRect();
      return { left: r.left, width: r.width, top: r.bottom + 2 };
    }
    const el = blockRefs.current.get(list[incomingDropIdx].id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width, top: r.top - 2 };
  })();


  return (
    <div className="space-y-2 px-2 pb-3 pt-2">
      {/* hidden file inputs */}
      <input ref={fileLgRef} type="file" accept="image/*" className="hidden" onChange={onPickImageLg} />
      <input
        ref={fileSmRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPickImageSm}
      />
      <input ref={fileVidRef} type="file" accept="video/*" className="hidden" onChange={onPickVideo} />
      <input
        ref={leaderAvatarRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickLeaderAvatar}
      />
      <input
        ref={leaderBgRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickLeaderBg}
      />

      {/* Leader / cover card */}
      <div
        className="relative h-[130px] overflow-hidden rounded-xl bg-gradient-to-br from-[#3a3a3a] via-[#2b2b2b] to-[#1a1a1a] bg-cover bg-center"
        style={
          intro.leader_bg_url
            ? { backgroundImage: `url(${JSON.stringify(intro.leader_bg_url).slice(1, -1)})` }
            : undefined
        }
      >
        {!intro.leader_bg_url && (
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_30%,#fff_1px,transparent_1px),radial-gradient(circle_at_70%_60%,#fff_1px,transparent_1px)] [background-size:60px_60px]" />
        )}
        {intro.leader_bg_url && <div className="absolute inset-0 bg-black/25" />}
        {backgroundGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-[11px] text-white">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 正在生成背景图…
          </div>
        )}

        <Popover open={bgPopOpen} onOpenChange={setBgPopOpen}>
          <PopoverTrigger asChild>
            <button className="absolute right-3 top-3 rounded-md border border-white/60 bg-black/20 px-2 py-1 text-[11px] text-white backdrop-blur">
              设置背景图
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            <div className="space-y-1 text-[12px]">
              <button
                onClick={() => {
                  setBgPopOpen(false);
                  onRegenerateBackground?.();
                }}
                disabled={!onRegenerateBackground || backgroundGenerating}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#07c160]" /> AI 重新生成
              </button>
              <button
                onClick={() => {
                  setBgPopOpen(false);
                  leaderBgRef.current?.click();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" /> 上传新图
              </button>
              {availableImages && availableImages.length > 0 && (
                <div>
                  <div className="px-2 pb-1 pt-2 text-[11px] text-muted-foreground">
                    从已上传图片中选择
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 px-1">
                    {availableImages.slice(0, 12).map((url) => (
                      <button
                        key={url}
                        onClick={() => {
                          onChange({ ...intro, leader_bg_url: url });
                          setBgPopOpen(false);
                        }}
                        className="aspect-square overflow-hidden rounded border hover:ring-2 hover:ring-[#07c160]"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="absolute bottom-3 left-3 flex items-end gap-2">
          <button
            onClick={() => leaderAvatarRef.current?.click()}
            className="group relative grid h-12 w-12 place-items-center overflow-hidden rounded-md bg-white text-[10px] text-[#969799]"
            title="点击更换头像"
          >
            {intro.leader_avatar ? (
              <img src={intro.leader_avatar} alt="头像" className="h-full w-full object-cover" />
            ) : (
              "头像"
            )}
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <div className="max-w-[180px] truncate text-[14px] font-medium text-white drop-shadow">
            <InlineText
              value={intro.leader_name ?? ""}
              onChange={(v) => onChange({ ...intro, leader_name: v })}
              placeholder="团长名"
              className="text-white placeholder:text-white/60"
            />
          </div>
        </div>
      </div>


      {/* Intro card */}
      <div
        ref={containerRef}
        className="relative rounded-xl bg-white p-3"
        style={
          drag
            ? { filter: "blur(2px) saturate(0.85)", pointerEvents: "none", transition: "filter 160ms" }
            : { transition: "filter 160ms" }
        }
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-[#1a1a1a]">团购介绍</div>
          <div className="flex items-center gap-1.5">
            {projectId && (
              <button
                onClick={openAIForWhole}
                className="flex items-center gap-1 rounded-md border border-[#07c160] bg-[#07c160]/10 px-2 py-0.5 text-[11px] text-[#07c160] hover:bg-[#07c160]/15"
              >
                <Sparkles className="h-3 w-3" />
                AI 生图
              </button>
            )}
            <button
              onClick={() => toast.info("素材导入：即将上线")}
              className="rounded-md border border-[#07c160] px-2 py-0.5 text-[11px] text-[#07c160]"
            >
              素材导入
            </button>
            <button
              onClick={() => toast.info("复制已有团购：即将上线")}
              className="rounded-md border border-[#07c160] px-2 py-0.5 text-[11px] text-[#07c160]"
            >
              复制已有团购
            </button>
          </div>
        </div>

        <div className={blocks.length > 0 ? "border-b border-[#f0f1f2] py-2" : "py-2"}>
          <AutoTextarea
            value={intro.title ?? ""}
            onChange={(v) => onChange({ ...intro, title: v })}
            placeholder="请输入团购活动标题"
            className="text-[15px] font-semibold text-[#1a1a1a] placeholder:font-normal placeholder:text-[#c8c9cc]"
          />
        </div>


        {blocks.length > 0 && (
          <div className="space-y-3">
            {blocks.map((b, i) => (
              <BlockCard
                key={b.id}
                refCb={registerBlockRef(b.id)}
                block={b}
                isFirst={i === 0}
                isLast={i === blocks.length - 1}
                isDragging={drag?.id === b.id}
                isEditing={editingId === b.id}
                dragOffset={0}
                anyDragging={!!drag}
                onMove={(dir) => moveBlock(b.id, dir)}
                onRemove={() => removeBlock(b.id)}
                onToggleLock={() => toggleLock(b.id)}
                onUploadReplace={() => {
                  if (b.type === "image_lg") pickFile("image_lg", b.id);
                  else if (b.type === "image_sm") pickFile("image_sm", b.id);
                  else if (b.type === "video") pickFile("video", b.id);
                }}
                onStartEditText={() => b.type === "text" && setEditingId(b.id)}
                onChangeText={(v) => updateText(b.id, v)}
                onFinishEditText={(v) => finishEditing(b.id, v)}
                onRemoveSmallImage={(idx) => removeSmallImage(b.id, idx)}
                onPointerDownDrag={(e) => startDrag(b.id, e)}
                onAIGenerate={
                  projectId && b.type === "text"
                    ? () => openAIForBlock(b.id, b.text)
                    : undefined
                }
                onEnrich={
                  onAskAI && b.type === "text"
                    ? (prompt) => {
                        const token = blockMentionToken(blocks, i);
                        onAskAI(`${token} ${prompt}`.trim());
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* Block tools */}
        <div
          className={
            blocks.length === 0
              ? "mt-2 grid grid-cols-4 gap-2 py-6"
              : "mt-4 grid grid-cols-4 gap-2"
          }
        >
          {BLOCK_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const big = blocks.length === 0;
            return (
              <button
                key={tool.label}
                onClick={() => onToolClick(tool.type)}
                className={
                  "group flex flex-col items-center rounded-lg transition-all duration-150 hover:bg-[#07c160]/10 hover:text-[#07c160] hover:scale-[1.03] active:scale-[0.97] " +
                  (big
                    ? "gap-2 p-4 text-[13px] text-[#646566]"
                    : "gap-1 p-2 text-[11px] text-[#646566]")
                }
              >
                <Icon
                  className={
                    "transition-colors group-hover:text-[#07c160] " +
                    (big ? "h-7 w-7" : "h-5 w-5")
                  }
                  strokeWidth={1.5}
                />
                {tool.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drag: localized frosted backdrop + fixed half-width thumbnail.
          Only the dragged module moves inside the (fixed) thumbnail;
          others slide to open a gap; auto-scrolls near top/bottom edges. */}
      {drag && draggedBlock &&
        createPortal(
          (() => {
            const VIEWPORT_PAD = 16;
            const viewportHeight = typeof window === "undefined" ? drag.cRect.height : window.innerHeight;
            const maxAvailableHeight = Math.max(200, viewportHeight - VIEWPORT_PAD * 2);
            const ghostHeight = Math.min(Math.max(200, drag.cRect.height - 16), maxAvailableHeight);
            const desiredTop = drag.cRect.top + 8;
            const ghostTop = Math.min(
              Math.max(VIEWPORT_PAD, desiredTop),
              Math.max(VIEWPORT_PAD, viewportHeight - VIEWPORT_PAD - ghostHeight),
            );
            const halfW = drag.cRect.width * 0.5;
            const fullW = halfW / GHOST_SCALE;
            const left = drag.cRect.left + (drag.cRect.width - halfW) / 2;

            return <>
            {/* Frosted glass — covers ONLY the preview editor area */}
            <div
              className="pointer-events-none fixed z-40 animate-in fade-in duration-150"
              style={{
                left: drag.cRect.left,
                top: ghostTop,
                width: drag.cRect.width,
                height: ghostHeight,
                background: "rgba(255,255,255,0.35)",
                backdropFilter: "blur(8px) saturate(1.05)",
                WebkitBackdropFilter: "blur(8px) saturate(1.05)",
                borderRadius: 12,
              }}
            />
            {/* Fixed half-width thumbnail centered over the preview area.
                Inner content is rendered at full width then visually scaled
                so text/images/spacing all shrink proportionally. */}
            {(
                <div
                  className="fixed z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden rounded-xl bg-white/98 shadow-2xl ring-1 ring-black/10"
                  style={{
                    left,
                    top: ghostTop,
                    width: halfW,
                    height: ghostHeight,
                  }}
                >
                  <div
                    ref={ghostScrollRef}
                    className="h-full overflow-y-auto"
                    style={{ scrollBehavior: "auto" }}
                  >
                    {/* Scaled inner content */}
                    <div
                      style={{
                        width: fullW,
                        transform: `scale(${GHOST_SCALE})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <div className="p-3">
                        <div className="mb-2 truncate text-[15px] font-semibold text-[#1a1a1a]">
                          {intro.title || "团购介绍"}
                        </div>
                        <div className="relative space-y-3">

                          {blocks.map((b) => {
                            const isMe = b.id === drag.id;
                            if (isMe) {
                              // The dragged block — floats vertically with
                              // the pointer (in scaled coords) and is
                              // visually highlighted.
                              const scrollEl = ghostScrollRef.current;
                              const baseTop = scrollEl
                                ? scrollEl.getBoundingClientRect().top
                                : ghostTop;
                              const yInScaled =
                                (drag.pointerY - baseTop + (scrollEl?.scrollTop ?? 0)) /
                                  GHOST_SCALE -
                                drag.blockHeight / 2;
                              return (
                                <div
                                  key={b.id}
                                  style={{
                                    transform: `translateY(${yInScaled}px)`,
                                    transition: "none",
                                    position: "absolute",
                                    left: 12,
                                    right: 12,
                                    top: 0,
                                    zIndex: 50,
                                    opacity: 1,
                                    outline: "2px dashed #07c160",
                                    background: "#ffffff",
                                    borderRadius: 10,
                                    padding: 10,
                                    boxShadow:
                                      "0 16px 36px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
                                    pointerEvents: "none",
                                  }}
                                >

                                  <BlockGhost block={b} />
                                </div>
                              );
                            }
                            return (
                              <div
                                key={b.id}
                                ref={registerGhostRef(b.id)}
                                style={{
                                  transform: `translateY(${ghostTranslateOf(b.id)}px)`,
                                  transition:
                                    "transform 220ms cubic-bezier(.2,.8,.2,1)",
                                  position: "relative",
                                  zIndex: 1,
                                  background: "#ffffff",
                                  borderRadius: 10,
                                  padding: 10,
                                  boxShadow:
                                    "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                                }}
                              >

                                <BlockGhost block={b} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </>;
          })(),
          document.body,
        )}



      {projectId && (
        <AIGenerateImageDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          projectId={projectId}
          defaultPrompt={aiPrompt}
          onComplete={handleAIComplete}
        />
      )}
    </div>
  );
}

function BlockLabel({ type }: { type: IntroBlock["type"] }) {
  const map = { text: "文字", image_lg: "大图", image_sm: "小图", video: "视频" } as const;
  return <div className="text-[13px] font-medium text-[#1a1a1a]">{map[type]}</div>;
}

function BlockCard({
  refCb,
  block,
  isFirst,
  isLast,
  isDragging,
  isEditing,
  dragOffset,
  anyDragging,
  onMove,
  onRemove,
  onToggleLock,
  onUploadReplace,
  onStartEditText,
  onChangeText,
  onFinishEditText,
  onRemoveSmallImage,
  onPointerDownDrag,
  onAIGenerate,
  onEnrich,
}: {
  refCb: (el: HTMLDivElement | null) => void;
  block: IntroBlock;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  isEditing: boolean;
  dragOffset: number;
  anyDragging: boolean;
  onMove: (dir: "up" | "down" | "top") => void;
  onRemove: () => void;
  onToggleLock: () => void;
  onUploadReplace: () => void;
  onStartEditText: () => void;
  onChangeText: (v: string) => void;
  onFinishEditText: (v: string) => void;
  onRemoveSmallImage: (idx: number) => void;
  onPointerDownDrag: (e: React.PointerEvent) => void;
  onAIGenerate?: () => void;
  /** Per-block "AI 丰富" — receives the user's enrichment prompt;
   *  parent assembles the @mention token. */
  onEnrich?: (prompt: string) => void;
}) {
  const isSmFull = block.type === "image_sm" && block.urls.length >= MAX_SMALL_IMAGES;
  const locked = !!block.locked;

  return (
    <div
      ref={refCb}
      style={{
        transform: `translateY(${dragOffset}px)`,
        transition: "transform 220ms cubic-bezier(.2,.8,.2,1)",
        visibility: isDragging ? "hidden" : undefined,
      }}
      className={
        "border-b border-[#f0f1f2] pb-3 last:border-b-0 last:pb-0 " +
        (locked ? "rounded-md ring-1 ring-amber-400/60 bg-amber-50/40 px-2" : "")
      }
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BlockLabel type={block.type} />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={onPointerDownDrag}
            title="按住拖动排序"
            style={{ touchAction: "none" }}
            className="cursor-grab select-none rounded-md border border-[#dcdee0] bg-white px-1.5 py-0.5 text-[#646566] hover:border-[#07c160] hover:text-[#07c160] active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {onAIGenerate && !anyDragging && (
            <button
              type="button"
              onClick={locked ? () => toast.info("已锁定，先解锁再让团宝改") : onAIGenerate}
              title={locked ? "已锁定 — 先解锁" : "根据文字 AI 生图"}
              disabled={locked}
              className={
                "flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] " +
                (locked
                  ? "border-[#dcdee0] bg-[#f4f5f7] text-[#c8c9cc] cursor-not-allowed"
                  : "border-[#07c160] bg-[#07c160]/10 text-[#07c160] hover:bg-[#07c160]/20")
              }
            >
              <Sparkles className="h-3 w-3" />
              生图
            </button>
          )}
          {onEnrich && !anyDragging && !locked && (
            <EnrichPopover onSend={onEnrich} />
          )}
          <button
            type="button"
            onClick={onToggleLock}
            title={locked ? "解锁 — 团宝可以修改" : "锁定 — 团宝不会改这段"}
            className={
              "flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] " +
              (locked
                ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-[#dcdee0] bg-white text-[#646566] hover:border-amber-400 hover:text-amber-700")
            }
          >
            {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {locked ? "已锁定" : "锁定"}
          </button>
          <MiniBtn onClick={() => onMove("up")} disabled={isFirst}>上移</MiniBtn>
          <MiniBtn onClick={() => onMove("down")} disabled={isLast}>下移</MiniBtn>
          <MiniBtn onClick={() => onMove("top")} disabled={isFirst}>置顶</MiniBtn>
          <MiniBtn onClick={onRemove}>删除</MiniBtn>
        </div>
      </div>

      {block.type === "text" && (
        isEditing ? (
          <AutoTextarea
            autoFocus
            value={block.text}
            onChange={onChangeText}
            onBlur={(v) => onFinishEditText(v)}
            placeholder="请输入文字内容（支持换行）"
            className="rounded-md border border-[#07c160]/40 bg-white px-2 py-1.5 text-[13px] text-[#323233]"
          />
        ) : (
          <button
            type="button"
            onClick={onStartEditText}
            className="w-full whitespace-pre-wrap rounded-md border border-transparent px-1 py-0.5 text-left text-[13px] text-[#323233] hover:border-[#dcdee0]"
          >
            {block.text || <span className="text-[#c8c9cc]">点击编辑文字</span>}
          </button>
        )
      )}

      {block.type === "image_lg" && (
        block.url ? (
          <div className="relative w-full overflow-hidden rounded-md bg-[#fafbfc]">
            <img src={block.url} alt="" className="block h-auto w-full" />
            <button
              onClick={onUploadReplace}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur hover:bg-black/65"
            >
              <Upload className="h-3 w-3" />
              替换
            </button>
          </div>
        ) : (
          <button
            onClick={onUploadReplace}
            className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-[#dcdee0] bg-[#fafbfc] text-[12px] text-[#969799]"
          >
            + 添加大图
          </button>
        )
      )}

      {block.type === "image_sm" && (
        <div className="grid grid-cols-3 gap-1">
          {block.urls.map((u, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-[#fafbfc]">
              <img src={u} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => onRemoveSmallImage(i)}
                className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {!isSmFull && (
            <button
              onClick={onUploadReplace}
              className="flex aspect-square items-center justify-center rounded-md border border-dashed border-[#dcdee0] bg-[#fafbfc] text-[16px] text-[#969799] hover:border-[#07c160] hover:text-[#07c160]"
            >
              +
            </button>
          )}
        </div>
      )}

      {block.type === "video" && (
        block.url ? (
          <div className="relative w-full overflow-hidden rounded-md bg-black">
            <video src={block.url} className="block h-auto w-full" controls />
            <button
              onClick={onUploadReplace}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white backdrop-blur hover:bg-black/65"
            >
              <Upload className="h-3 w-3" />
              替换
            </button>
          </div>
        ) : (
          <button
            onClick={onUploadReplace}
            className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-[#dcdee0] bg-[#fafbfc] text-[12px] text-[#969799]"
          >
            + 添加视频
          </button>
        )
      )}
    </div>
  );
}

export function ProductEntryCard({ count }: { count: number }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="text-[15px] font-semibold text-[#1a1a1a]">团购商品</div>
          <button
            onClick={() => toast.info("切换旧版：即将上线")}
            className="flex items-center gap-0.5 text-[11px] text-[#969799]"
          >
            <ArrowLeftRight className="h-3 w-3" />
            切换旧版
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => toast.info("素材导入：即将上线")}
            className="rounded-md border border-[#07c160] px-2 py-0.5 text-[11px] text-[#07c160]"
          >
            素材导入
          </button>
          <button
            onClick={() => toast.info("从商品库导入：即将上线")}
            className="rounded-md border border-[#07c160] px-2 py-0.5 text-[11px] text-[#07c160]"
          >
            从商品库导入
          </button>
        </div>
      </div>
      <div className="mb-2 flex h-9 items-center gap-1.5 rounded-md bg-[#f4f5f7] px-3 text-[12px] text-[#c8c9cc]">
        <Search className="h-3.5 w-3.5" />
        搜索商品名称、规格
      </div>
      <div className="flex h-10 items-center justify-center rounded-md border border-[#07c160] text-[13px] text-[#07c160]">
        <Plus className="mr-1 h-4 w-4" /> 添加商品 {count > 0 && `（已 ${count}）`}
      </div>
    </div>
  );
}

/** Compact preview rendered inside the floating drag ghost. */
function BlockGhost({ block }: { block: IntroBlock }) {
  return (
    <div>
      {block.type === "text" && (
        <div className="whitespace-pre-wrap text-[13px] leading-snug text-[#323233] line-clamp-3">
          {block.text || <span className="text-[#c8c9cc]">（空文字）</span>}
        </div>
      )}
      {block.type === "image_lg" && (
        block.url ? (
          <img src={block.url} alt="" className="block h-auto w-full rounded-md" />
        ) : (
          <div className="grid aspect-[16/10] w-full place-items-center rounded-md bg-[#fafbfc] text-[12px] text-[#c8c9cc]">大图</div>
        )
      )}
      {block.type === "image_sm" && (
        <div className="grid grid-cols-3 gap-1">
          {block.urls.slice(0, 9).map((u, i) => (
            <div key={i} className="aspect-square overflow-hidden rounded bg-[#fafbfc]">
              <img src={u} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}
      {block.type === "video" && (
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
          {block.url ? (
            <video src={block.url} className="h-full w-full object-cover" muted />
          ) : null}
          <div className="absolute inset-0 grid place-items-center">
            <Play className="h-6 w-6 text-white/85" fill="currentColor" />
          </div>
        </div>
      )}
    </div>
  );
}

const ENRICH_PRESETS = ["更生动", "更短一点", "更专业", "加入痛点"];

function EnrichPopover({ onSend }: { onSend: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const submit = (prompt: string) => {
    const v = prompt.trim();
    if (!v) return;
    onSend(v);
    setText("");
    setOpen(false);
    toast.success("已发给团宝");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="让团宝单独丰富这一段"
          className="flex items-center gap-0.5 rounded-md border border-[#ff8a3d] bg-[#ff8a3d]/10 px-1.5 py-0.5 text-[11px] text-[#d96b1f] hover:bg-[#ff8a3d]/20"
        >
          <Wand2 className="h-3 w-3" />
          AI 丰富
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2 text-[12px] font-medium text-foreground">
          让团宝只改这一段
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {ENRICH_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => submit(p)}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:border-[#ff8a3d] hover:text-[#d96b1f]"
            >
              {p}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="其他要求…（例如：加一句产地）"
          className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-[12px] outline-none focus:border-[#ff8a3d]/60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(text);
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => submit(text)}
            disabled={!text.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#ff9a4d] to-[#d96b1f] px-2.5 py-1 text-[11px] font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-3 w-3" /> 发给团宝
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}



