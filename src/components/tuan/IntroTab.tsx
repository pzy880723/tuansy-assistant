import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
} from "lucide-react";
import { toast } from "sonner";
import { InlineText, MiniBtn } from "./primitives";
import type { IntroBlock, IntroData } from "./types";
import { AIGenerateImageDialog } from "./AIGenerateImageDialog";

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
}: {
  intro: IntroData;
  onChange: (next: IntroData) => void;
  projectId?: string;
}) {
  const blocks = intro.blocks ?? [];
  const setBlocks = (next: IntroBlock[]) => onChange({ ...intro, blocks: next });

  // AI generate-image dialog state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const aiTargetIdRef = useRef<string | null>(null);

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

  // Reorder overlay state
  const [reorderingId, setReorderingId] = useState<string | null>(null);

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

  const handleAIComplete = (urls: string[]) => {
    if (urls.length === 0) return;
    const targetId = aiTargetIdRef.current;
    const list = blocks.slice();
    let insertAfter = targetId ? list.findIndex((b) => b.id === targetId) : list.length - 1;
    if (insertAfter < 0) insertAfter = list.length - 1;

    // Try to fill an adjacent image_sm block first (limited to 9 each).
    const next = list[insertAfter + 1];
    if (next && next.type === "image_sm" && next.urls.length < MAX_SMALL_IMAGES) {
      const room = MAX_SMALL_IMAGES - next.urls.length;
      const take = urls.slice(0, room);
      const rest = urls.slice(room);
      list[insertAfter + 1] = { ...next, urls: [...next.urls, ...take] };
      if (rest.length > 0) {
        const block: IntroBlock =
          rest.length === 1
            ? { id: genId(), type: "image_lg", url: rest[0] }
            : { id: genId(), type: "image_sm", urls: rest.slice(0, MAX_SMALL_IMAGES) };
        list.splice(insertAfter + 2, 0, block);
      }
    } else {
      const block: IntroBlock =
        urls.length === 1
          ? { id: genId(), type: "image_lg", url: urls[0] }
          : { id: genId(), type: "image_sm", urls: urls.slice(0, MAX_SMALL_IMAGES) };
      list.splice(insertAfter + 1, 0, block);
    }
    setBlocks(list);
  };


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

      {/* Leader / cover card */}
      <div className="relative h-[130px] overflow-hidden rounded-xl bg-gradient-to-br from-[#3a3a3a] via-[#2b2b2b] to-[#1a1a1a]">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_30%,#fff_1px,transparent_1px),radial-gradient(circle_at_70%_60%,#fff_1px,transparent_1px)] [background-size:60px_60px]" />
        <button
          onClick={() => toast.info("设置背景图：即将上线")}
          className="absolute right-3 top-3 rounded-md border border-white/60 bg-black/20 px-2 py-1 text-[11px] text-white backdrop-blur"
        >
          设置背景图
        </button>
        <div className="absolute bottom-3 left-3 flex items-end gap-2">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-md bg-white text-[10px] text-[#969799]">
            {intro.leader_avatar ? (
              <img src={intro.leader_avatar} alt="头像" className="h-full w-full object-cover" />
            ) : (
              "头像"
            )}
          </div>
          <div className="max-w-[180px] truncate text-[14px] font-medium text-white">
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
      <div className="rounded-xl bg-white p-3">
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
                block={b}
                isFirst={i === 0}
                isLast={i === blocks.length - 1}
                isReordering={reorderingId === b.id}
                isEditing={editingId === b.id}
                onMove={(dir) => moveBlock(b.id, dir)}
                onRemove={() => removeBlock(b.id)}
                onUploadReplace={() => {
                  if (b.type === "image_lg") pickFile("image_lg", b.id);
                  else if (b.type === "image_sm") pickFile("image_sm", b.id);
                  else if (b.type === "video") pickFile("video", b.id);
                }}
                onStartEditText={() => b.type === "text" && setEditingId(b.id)}
                onChangeText={(v) => updateText(b.id, v)}
                onFinishEditText={(v) => finishEditing(b.id, v)}
                onRemoveSmallImage={(idx) => removeSmallImage(b.id, idx)}
                onStartReorder={() => setReorderingId(b.id)}
                onAIGenerate={
                  projectId && b.type === "text"
                    ? () => openAIForBlock(b.id, b.text)
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

      {reorderingId && (
        <ReorderOverlay
          blocks={blocks}
          draggingId={reorderingId}
          onCommit={(index) => {
            moveToIndex(reorderingId, index);
            setReorderingId(null);
          }}
          onCancel={() => setReorderingId(null)}
        />
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
  block,
  isFirst,
  isLast,
  isDragging,
  isEditing,
  onMove,
  onRemove,
  onUploadReplace,
  onStartEditText,
  onChangeText,
  onFinishEditText,
  onRemoveSmallImage,
  onDragStart,
  onDragEnd,
  onDropOn,
  onAIGenerate,
}: {
  block: IntroBlock;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  isEditing: boolean;
  onMove: (dir: "up" | "down" | "top") => void;
  onRemove: () => void;
  onUploadReplace: () => void;
  onStartEditText: () => void;
  onChangeText: (v: string) => void;
  onFinishEditText: (v: string) => void;
  onRemoveSmallImage: (idx: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOn: () => void;
  onAIGenerate?: () => void;
}) {
  const [draggable, setDraggable] = useState(false);
  const isSmFull = block.type === "image_sm" && block.urls.length >= MAX_SMALL_IMAGES;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => {
        setDraggable(false);
        onDragEnd();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropOn();
      }}
      className={
        "border-b border-[#f0f1f2] pb-3 last:border-b-0 last:pb-0 " +
        (isDragging ? "opacity-50" : "")
      }
    >
      <div className="mb-1.5 flex items-center justify-between">
        <BlockLabel type={block.type} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={() => setDraggable(true)}
            onTouchStart={() => setDraggable(true)}
            title="拖动排序"
            className="cursor-grab rounded-md border border-[#dcdee0] bg-white px-1.5 py-0.5 text-[#646566] hover:border-[#07c160] hover:text-[#07c160] active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          {onAIGenerate && (
            <button
              type="button"
              onClick={onAIGenerate}
              title="根据文字 AI 生图"
              className="flex items-center gap-0.5 rounded-md border border-[#07c160] bg-[#07c160]/10 px-1.5 py-0.5 text-[11px] text-[#07c160] hover:bg-[#07c160]/20"
            >
              <Sparkles className="h-3 w-3" />
              生图
            </button>
          )}
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
