import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ExternalLink, ImagePlus, Send, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProject, updateProject } from "@/lib/projects.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/project/$id")({
  head: () => ({ meta: [{ title: "编辑项目 — 团宝助手" }] }),
  component: ProjectEditor,
});

type Sku = { name: string; price: string; stock: string };
type ProductData = {
  title?: string;
  subtitle?: string;
  cover?: string | null;
  skus?: Sku[];
  tags?: string[];
};

function ProjectEditor() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const get = useServerFn(getProject);
  const update = useServerFn(updateProject);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => get({ data: { id } }),
  });

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState<"idle" | "saving" | "saved">("idle");
  const nameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.project) setName(data.project.name);
  }, [data?.project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      update({ data: { id, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const handleNameChange = (v: string) => {
    setName(v);
    setSavingName("saving");
    if (nameDebounce.current) clearTimeout(nameDebounce.current);
    nameDebounce.current = setTimeout(async () => {
      await updateMut.mutateAsync({ name: v || "未命名项目" });
      setSavingName("saved");
      setTimeout(() => setSavingName("idle"), 1500);
    }, 600);
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="text-sm text-muted-foreground">加载中…</div>
      </main>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Editor header */}
      <div className="flex items-center gap-3 border-b bg-background/80 px-5 py-2.5 backdrop-blur">
        <Link
          to="/app"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 项目
        </Link>
        <div className="h-4 w-px bg-border" />
        <input
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground"
          placeholder="未命名项目"
        />
        <SaveBadge state={savingName} />
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => toast.info("同步导出页即将上线")}
        >
          <ExternalLink className="h-3.5 w-3.5" /> 同步到快团团
        </Button>
      </div>

      {/* Split layout */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <ChatPane projectId={id} />
        <PreviewPane projectId={id} project={data?.project} />
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {state === "saving" ? (
        <>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> 保存中
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-[oklch(0.65_0.18_145)]" /> 已保存
        </>
      )}
    </span>
  );
}

/* ============== LEFT: AI Chat Pane (skeleton) ============== */

type Msg = { role: "user" | "ai"; text: string };

function ChatPane({ projectId }: { projectId: string }) {
  const storageKey = `tuanbao.chat.${projectId}`;
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, storageKey]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "ai",
        text: "（AI 引擎即将接入）收到，我会读取右侧预览并据此调整。先在右侧直接点击就能改字、改图、改 SKU。",
      },
    ]);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col border-b bg-card md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">AI 对话</div>
        <div className="ml-auto text-[11px] text-muted-foreground">
          会话保存在本浏览器
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.length === 0 && <ChatEmpty onPick={setInput} />}
        {messages.map((m, i) => (
          <MessageRow key={i} msg={m} />
        ))}
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => toast.info("拖入或选择图片即将上线")}
            aria-label="上传图片"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="告诉 AI 你想怎么改 (Enter 发送 · Shift+Enter 换行)"
            className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <Button
            size="sm"
            onClick={send}
            disabled={!input.trim()}
            className="h-8 rounded-lg bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] text-white hover:brightness-110"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatEmpty({ onPick }: { onPick: (s: string) => void }) {
  const samples = [
    "生成一段「产地直发、顺丰冷链」的卖点段落",
    "把价格档位改成 2 斤 39.9、5 斤 88",
    "封面图换成更有食欲的暖色调",
    "加一个「坏果包赔」的服务标签",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-white shadow-[0_12px_28px_oklch(0.7_0.19_45/0.4)]">
        <MessageSquare className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-semibold">和 AI 一起编排你的团购</h3>
      <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
        右侧是真实的快团团预览。点击直接改，或者用自然语言告诉 AI 怎么改。
      </p>
      <div className="mt-6 grid w-full max-w-sm gap-2">
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] px-3.5 py-2 text-sm text-white shadow-sm">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-[10px] font-bold text-white">
        AI
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 text-sm leading-relaxed">
        {msg.text}
      </div>
    </div>
  );
}

/* ============== RIGHT: 快团团 Mock Preview ============== */

type Tab = "intro" | "product" | "settings";

function PreviewPane({
  projectId,
  project,
}: {
  projectId: string;
  project: { id: string; product?: ProductData } | undefined;
}) {
  const [tab, setTab] = useState<Tab>("product");
  const qc = useQueryClient();
  const update = useServerFn(updateProject);

  const product: ProductData =
    (project?.product as ProductData | undefined) ?? {
      title: "云南阳光玫瑰 · 现摘现发",
      subtitle: "产地直采 · 顺丰冷链 · 坏果包赔",
      skus: [
        { name: "2 斤装", price: "39.9", stock: "100" },
        { name: "5 斤装", price: "88.0", stock: "50" },
      ],
      tags: ["顺丰", "冷链", "坏果包赔"],
    };

  const patchProduct = async (next: ProductData) => {
    await update({ data: { id: projectId, patch: { product: next } } });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[oklch(0.97_0.01_70)]">
      <div className="flex items-center justify-between border-b bg-background px-4 py-2.5">
        <div className="inline-flex rounded-full border bg-muted/50 p-0.5 text-sm">
          {(
            [
              { v: "intro", label: "团购介绍" },
              { v: "product", label: "团购商品" },
              { v: "settings", label: "团购设置" },
            ] as const
          ).map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition",
                tab === t.v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          点击任意元素直接编辑 ↓
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <PhoneFrame>
          {tab === "intro" && <IntroMock />}
          {tab === "product" && (
            <ProductMock product={product} onChange={patchProduct} />
          )}
          {tab === "settings" && <SettingsMock />}
        </PhoneFrame>
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[390px]">
      <div className="overflow-hidden rounded-[36px] border-[10px] border-[oklch(0.18_0.012_50)] bg-white shadow-[0_30px_60px_-20px_oklch(0_0_0/0.35)]">
        <div className="flex items-center justify-between bg-[oklch(0.18_0.012_50)] px-5 py-1.5 text-[10px] text-white/80">
          <span>9:41</span>
          <span>•••</span>
        </div>
        <div className="bg-white">{children}</div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        快团团 · 商品详情预览
      </p>
    </div>
  );
}

/* ---- Intro mock ---- */
function IntroMock() {
  return (
    <div className="space-y-3 p-3">
      <EditableBlock label="活动标题" defaultValue="🍇 云南阳光玫瑰开团 · 限时 48 小时" className="text-base font-bold" />
      <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-[oklch(0.88_0.06_85)] to-[oklch(0.7_0.15_45)]" />
      <EditableBlock
        label="正文"
        defaultValue="云南海拔 1800 米葡萄园直采，皮薄肉脆，咬下去一口爆汁。今年第一批头茬果，限量预定！"
        className="text-sm leading-relaxed text-[oklch(0.3_0.025_50)]"
        multiline
      />
      <div className="flex flex-wrap gap-1.5">
        {["产地直发", "顺丰冷链", "坏果包赔"].map((t) => (
          <span key={t} className="rounded-full bg-[oklch(0.97_0.04_70)] px-2 py-0.5 text-[10px] font-medium text-[oklch(0.62_0.22_35)]">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- Product mock ---- */
function ProductMock({
  product,
  onChange,
}: {
  product: ProductData;
  onChange: (next: ProductData) => void;
}) {
  return (
    <div>
      <div className="relative aspect-[4/3] bg-gradient-to-br from-[oklch(0.88_0.06_85)] to-[oklch(0.7_0.15_45)]">
        <button
          className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur"
          onClick={() => toast.info("图片编辑即将上线")}
        >
          更换封面
        </button>
      </div>
      <div className="space-y-3 p-3">
        <EditableBlock
          label="商品标题"
          defaultValue={product.title ?? ""}
          className="text-base font-bold"
          onSave={(v) => onChange({ ...product, title: v })}
        />
        <EditableBlock
          label="副标题"
          defaultValue={product.subtitle ?? ""}
          className="text-xs text-[oklch(0.5_0.03_60)]"
          onSave={(v) => onChange({ ...product, subtitle: v })}
        />

        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.5_0.03_60)]">
            规格 / SKU
          </div>
          {(product.skus ?? []).map((sku, i) => (
            <SkuEditableRow
              key={i}
              sku={sku}
              onChange={(next) => {
                const skus = [...(product.skus ?? [])];
                skus[i] = next;
                onChange({ ...product, skus });
              }}
            />
          ))}
          <button
            className="w-full rounded-lg border border-dashed py-1.5 text-xs text-[oklch(0.5_0.03_60)] hover:border-[oklch(0.7_0.19_45)] hover:text-[oklch(0.62_0.22_35)]"
            onClick={() =>
              onChange({
                ...product,
                skus: [...(product.skus ?? []), { name: "新规格", price: "0", stock: "0" }],
              })
            }
          >
            + 增加规格
          </button>
        </div>

        <button className="mt-2 h-10 w-full rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-sm font-bold text-white shadow-[0_8px_24px_oklch(0.7_0.19_45/0.4)]">
          参 团 购 买
        </button>
      </div>
    </div>
  );
}

function SkuEditableRow({ sku, onChange }: { sku: Sku; onChange: (s: Sku) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[oklch(0.97_0.015_70)] px-2.5 py-2">
      <input
        value={sku.name}
        onChange={(e) => onChange({ ...sku, name: e.target.value })}
        className="flex-1 min-w-0 bg-transparent text-xs font-medium outline-none focus:bg-white focus:ring-1 focus:ring-[oklch(0.7_0.19_45/0.4)] rounded px-1.5 py-0.5"
      />
      <div className="flex items-center text-xs font-bold text-[oklch(0.62_0.22_35)]">
        <span className="text-[10px]">¥</span>
        <input
          value={sku.price}
          onChange={(e) => onChange({ ...sku, price: e.target.value })}
          className="w-14 bg-transparent text-right outline-none focus:bg-white focus:ring-1 focus:ring-[oklch(0.7_0.19_45/0.4)] rounded px-1 py-0.5"
        />
      </div>
      <span className="text-[10px] text-[oklch(0.5_0.03_60)]">库</span>
      <input
        value={sku.stock}
        onChange={(e) => onChange({ ...sku, stock: e.target.value })}
        className="w-10 bg-transparent text-right text-[10px] text-[oklch(0.5_0.03_60)] outline-none focus:bg-white focus:ring-1 focus:ring-[oklch(0.7_0.19_45/0.4)] rounded px-1 py-0.5"
      />
    </div>
  );
}

/* ---- Settings mock ---- */
function SettingsMock() {
  const rows = [
    { k: "团购时间", v: "立即开始 · 48 小时后结束" },
    { k: "发货方式", v: "顺丰快递（包邮）" },
    { k: "运费模板", v: "默认模板" },
    { k: "售后服务", v: "坏果包赔 · 24 小时内反馈" },
  ];
  return (
    <div className="space-y-2 p-3">
      {rows.map((r) => (
        <button
          key={r.k}
          onClick={() => toast.info(`「${r.k}」设置即将上线`)}
          className="flex w-full items-center justify-between rounded-xl bg-[oklch(0.97_0.015_70)] px-3 py-3 text-left transition hover:bg-[oklch(0.97_0.04_70)]"
        >
          <span className="text-xs font-semibold text-[oklch(0.3_0.025_50)]">{r.k}</span>
          <span className="text-xs text-[oklch(0.5_0.03_60)]">{r.v} ›</span>
        </button>
      ))}
    </div>
  );
}

/* ---- Editable block primitive ---- */
function EditableBlock({
  label,
  defaultValue,
  className,
  multiline,
  onSave,
}: {
  label: string;
  defaultValue: string;
  className?: string;
  multiline?: boolean;
  onSave?: (v: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => setValue(defaultValue), [defaultValue]);
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className="group relative">
      <Tag
        value={value}
        onChange={(e) => setValue((e.target as HTMLInputElement).value)}
        onBlur={() => onSave?.(value)}
        aria-label={label}
        rows={multiline ? 3 : undefined}
        className={cn(
          "w-full resize-none rounded-lg bg-transparent px-2 py-1 outline-none transition hover:bg-[oklch(0.97_0.015_70)] focus:bg-white focus:ring-1 focus:ring-[oklch(0.7_0.19_45/0.4)]",
          className,
        )}
      />
      <span className="pointer-events-none absolute -top-4 left-2 hidden text-[9px] uppercase tracking-wider text-[oklch(0.5_0.03_60)] group-focus-within:block">
        {label}
      </span>
    </div>
  );
}
