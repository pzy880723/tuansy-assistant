import { useState } from "react";
import {
  Image as ImageIcon,
  LayoutGrid,
  Video,
  PenSquare,
  Tag as TagIcon,
  UserPlus,
  ShieldCheck,
  ArrowLeftRight,
  Search,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { InlineText, MiniBtn } from "./primitives";
import type { IntroBlock, IntroData } from "./types";

const BLOCK_TOOLS = [
  { type: "image_lg" as const, label: "大图", icon: ImageIcon },
  { type: "image_sm" as const, label: "小图", icon: LayoutGrid },
  { type: "video" as const, label: "视频", icon: Video },
  { type: "text" as const, label: "文字", icon: PenSquare },
  { type: "tag" as const, label: "标签", icon: TagIcon },
  { type: "fan" as const, label: "加粉", icon: UserPlus },
  { type: "promise" as const, label: "承诺", icon: ShieldCheck },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultBlock(type: IntroBlock["type"]): IntroBlock {
  const id = genId();
  if (type === "text") return { id, type, text: "" };
  if (type === "image_lg") return { id, type, url: null };
  if (type === "image_sm") return { id, type, urls: [] };
  if (type === "video") return { id, type, url: null };
  return { id, type: "tag", tags: [] };
}

export function IntroTab({
  intro,
  onChange,
}: {
  intro: IntroData;
  onChange: (next: IntroData) => void;
}) {
  const blocks = intro.blocks ?? [];

  const setBlocks = (next: IntroBlock[]) => onChange({ ...intro, blocks: next });

  const addBlock = (type: IntroBlock["type"]) => setBlocks([...blocks, defaultBlock(type)]);
  const removeBlock = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));
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
  const updateBlock = (id: string, patch: Partial<IntroBlock>) =>
    setBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as IntroBlock) : b)));

  return (
    <div className="space-y-2 px-2 pb-3 pt-2">
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

        <div className="border-b border-[#f0f1f2] py-2">
          <InlineText
            value={intro.title ?? ""}
            onChange={(v) => onChange({ ...intro, title: v })}
            placeholder="请输入团购活动标题"
            className="text-[14px] font-medium text-[#1a1a1a]"
          />
        </div>
        <div className="py-2">
          <InlineText
            multiline
            rows={3}
            value={intro.description ?? ""}
            onChange={(v) => onChange({ ...intro, description: v })}
            placeholder="请输入团购活动内容"
            className="text-[13px] text-[#323233]"
          />
        </div>

        {/* Block tools */}
        <div className="mt-4 grid grid-cols-5 gap-y-3">
          {BLOCK_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.label}
                onClick={() => {
                  if (tool.type === "fan" || tool.type === "promise") {
                    toast.info(`${tool.label}：即将上线`);
                    return;
                  }
                  addBlock(tool.type);
                }}
                className="flex flex-col items-center gap-1 text-[11px] text-[#646566]"
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                {tool.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Existing blocks */}
      {blocks.length > 0 && (
        <div className="space-y-2 rounded-xl bg-white p-3">
          {blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
              onMove={(dir) => moveBlock(b.id, dir)}
              onRemove={() => removeBlock(b.id)}
              onAdd={() => addBlock("text")}
              onUpdate={(patch) => updateBlock(b.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BlockLabel({ type }: { type: IntroBlock["type"] }) {
  const map = { text: "文字", image_lg: "大图", image_sm: "小图", video: "视频", tag: "标签" };
  return <div className="text-[13px] font-medium text-[#1a1a1a]">{map[type]}</div>;
}

function BlockCard({
  block,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onAdd,
  onUpdate,
}: {
  block: IntroBlock;
  isFirst: boolean;
  isLast: boolean;
  onMove: (dir: "up" | "down" | "top") => void;
  onRemove: () => void;
  onAdd: () => void;
  onUpdate: (patch: Partial<IntroBlock>) => void;
}) {
  return (
    <div className="border-b border-[#f0f1f2] pb-3 last:border-b-0 last:pb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <BlockLabel type={block.type} />
        <div className="flex gap-1">
          <MiniBtn onClick={() => onMove("up")} disabled={isFirst}>上移</MiniBtn>
          <MiniBtn onClick={() => onMove("down")} disabled={isLast}>下移</MiniBtn>
          <MiniBtn onClick={() => onMove("top")} disabled={isFirst}>置顶</MiniBtn>
          <MiniBtn onClick={onAdd}>添加</MiniBtn>
          <MiniBtn onClick={onRemove}>删除</MiniBtn>
        </div>
      </div>
      {block.type === "text" && (
        <InlineText
          multiline
          rows={2}
          value={block.text}
          onChange={(v) => onUpdate({ text: v })}
          placeholder="请输入团购活动内容"
          className="text-[13px] text-[#323233]"
        />
      )}
      {block.type === "image_lg" && (
        <button
          onClick={() => toast.info("上传图片：即将上线")}
          className="flex aspect-[16/10] w-full items-center justify-center rounded-md border border-dashed border-[#dcdee0] bg-[#fafbfc] text-[12px] text-[#969799]"
        >
          + 添加大图
        </button>
      )}
      {block.type === "image_sm" && (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => toast.info("上传图片：即将上线")}
              className="flex aspect-square items-center justify-center rounded-md border border-dashed border-[#dcdee0] bg-[#fafbfc] text-[11px] text-[#969799]"
            >
              +
            </button>
          ))}
        </div>
      )}
      {block.type === "video" && (
        <button
          onClick={() => toast.info("上传视频：即将上线")}
          className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-[#dcdee0] bg-[#fafbfc] text-[12px] text-[#969799]"
        >
          + 添加视频
        </button>
      )}
      {block.type === "tag" && (
        <TagBlockEditor tags={block.tags} onChange={(tags) => onUpdate({ tags })} />
      )}
    </div>
  );
}

function TagBlockEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t, i) => (
        <button
          key={i}
          onClick={() => onChange(tags.filter((_, j) => j !== i))}
          className="rounded-full bg-[#07c160]/10 px-2 py-0.5 text-[11px] text-[#07c160]"
        >
          # {t} ×
        </button>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) {
            onChange([...tags, draft.trim()]);
            setDraft("");
          }
        }}
        placeholder="输入标签 回车"
        className="min-w-[100px] flex-1 bg-transparent px-1 text-[11px] outline-none placeholder:text-[#c8c9cc]"
      />
    </div>
  );
}

/** The "团购商品" entry card that lives at the bottom of intro tab. */
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
