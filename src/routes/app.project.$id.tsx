import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Check,
  History,
  ImagePlus,
  RotateCcw,
  Send,
  Wrench,
  Loader2,
  ClipboardList,
  X,
} from "lucide-react";
import tuanbaoAvatar from "@/assets/tuanbao-avatar.png.asset.json";
import { useImageAttachments } from "@/lib/use-image-attachments";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getProject, updateProject } from "@/lib/projects.functions";
import { cn } from "@/lib/utils";
import { PhoneShell as TuanPhoneShell } from "@/components/tuan/PhoneShell";
import { IntroTab, ProductEntryCard } from "@/components/tuan/IntroTab";
import { ProductTab } from "@/components/tuan/ProductTab";
import { SettingsTab } from "@/components/tuan/SettingsTab";
import { SettingSheet } from "@/components/tuan/primitives";
import type { IntroData, SkuItem, SettingsData } from "@/components/tuan/types";

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

  const get = useServerFn(getProject);

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => get({ data: { id } }),
  });


  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="text-sm text-muted-foreground">加载中…</div>
      </main>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2.75rem)] flex-col">
      {/* Split layout — header is provided by the app TopBar in /app layout */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize="38%" minSize="20%" maxSize="75%">
          <ChatPane projectId={id} project={data?.project ?? null} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="62%" minSize="25%">
          <PreviewPane
            projectId={id}
            project={
              data?.project
                ? {
                    id: data.project.id,
                    product: (data.project.product ?? undefined) as ProductData | undefined,
                    intro: (data.project.intro ?? undefined) as IntroData | undefined,
                    skus: (data.project.skus ?? undefined) as SkuItem[] | undefined,
                    settings: (data.project.settings ?? undefined) as SettingsData | undefined,
                  }
                : undefined
            }
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}


/* ============== LEFT: AI Chat Pane (live, tool-calling) ============== */

type ProjectSnapshot = {
  name?: string;
  product?: unknown;
  intro?: unknown;
  skus?: unknown;
  settings?: unknown;
};
type HistoryEntry = {
  id: string;
  ts: number;
  label: string;
  snapshot: ProjectSnapshot;
  messageIndex: number;
};

function ChatPane({
  projectId,
  project,
}: {
  projectId: string;
  project: ProjectSnapshot | null;
}) {
  const storageKey = `tuanbao.chat.${projectId}`;
  const historyKey = `tuanbao.history.${projectId}`;
  const qc = useQueryClient();
  const update = useServerFn(updateProject);
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<ProjectSnapshot | null>(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const initial: UIMessage[] = (() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as UIMessage[]) : [];
    } catch {
      return [];
    }
  })();

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(historyKey);
      return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(historyKey, JSON.stringify(history));
  }, [history, historyKey]);

  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: { ...body, messages, projectId },
      }),
    }),
  ).current;

  const { messages, sendMessage, setMessages, status, error } = useChat({
    id: projectId,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message ?? "对话出错"),
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onToolCall: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  const [input, setInput] = useState("");
  const [planMode, setPlanMode] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const img = useImageAttachments({ projectId });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, storageKey]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [projectId, status]);

  const sendText = (text: string) => {
    const value = text.trim();
    const files = img.getReadyFiles();
    if (!value && files.length === 0) return;
    if (isLoading) return;
    if (img.uploading) {
      toast.error("图片还在上传，稍等一下");
      return;
    }
    const snap = projectRef.current;
    if (snap) {
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        label: value.length > 40 ? value.slice(0, 40) + "…" : value || `${files.length} 张图片`,
        snapshot: {
          name: snap.name,
          product: snap.product,
          intro: snap.intro,
          skus: snap.skus,
          settings: snap.settings,
        },
        messageIndex: messages.length,
      };
      setHistory((h) => [entry, ...h].slice(0, 30));
    }
    const payload = planMode
      ? `【计划模式】先不要直接动手撰写或调用 update_* 工具。针对下面的需求，给我抛出 3 到 5 个最该先确认的澄清问题（用一、二、三编号），等我回答后再动笔：\n${value}`
      : value;

    if (files.length > 0) {
      const parts: Array<
        { type: "text"; text: string } | { type: "file"; mediaType: string; url: string }
      > = [];
      if (payload) parts.push({ type: "text", text: payload });
      for (const f of files) parts.push({ type: "file", mediaType: f.mimeType, url: f.url });
      void sendMessage({ role: "user", parts });
    } else {
      void sendMessage({ text: payload });
    }

    if (planMode) setPlanMode(false);
    setInput("");
    img.clear();
  };


  const send = () => sendText(input);

  const togglePlan = () => {
    setPlanMode((v) => {
      const next = !v;
      if (next) toast.success("已开启计划模式：团宝会先反问澄清");
      else toast("已关闭计划模式");
      return next;
    });
  };

  // Auto-trigger the first AI write when arriving from the home "开团" dialog
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    if (typeof window === "undefined") return;
    if (isLoading) return;
    const key = `tuanbao.boot.${projectId}`;
    const boot = window.sessionStorage.getItem(key);
    if (!boot) return;
    bootedRef.current = true;
    window.sessionStorage.removeItem(key);
    void sendMessage({ text: boot });
  }, [projectId, isLoading, sendMessage]);


  const suggestions: string[] = (() => {
    if (isLoading) return [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const part = m.parts.find(
        (p) => p.type === "tool-suggest_next",
      ) as { output?: { suggestions?: string[] } } | undefined;
      const list = part?.output?.suggestions;
      if (Array.isArray(list) && list.length) return list.slice(0, 4);
      return [];
    }
    return [];
  })();

  const rollback = async (entry: HistoryEntry) => {
    try {
      await update({
        data: {
          id: projectId,
          patch: {
            name: entry.snapshot.name ?? "未命名项目",
            product: entry.snapshot.product ?? null,
            intro: entry.snapshot.intro ?? null,
            skus: entry.snapshot.skus ?? null,
            settings: entry.snapshot.settings ?? null,
          },
        },
      });
      setMessages(messages.slice(0, entry.messageIndex));
      setHistory((h) => h.filter((x) => x.ts < entry.ts));
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("已回滚到该版本");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "回滚失败");
    }
  };

  return (
    <div
      {...img.dragHandlers}
      className={
        "relative flex h-full min-h-0 flex-col border-b bg-card md:border-b-0 md:border-r " +
        (img.dragActive ? "ring-2 ring-primary/60 ring-inset" : "")
      }
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <img
          src={tuanbaoAvatar.url}
          alt="团宝"
          width={28}
          height={28}
          loading="lazy"
          className="h-7 w-7 rounded-full bg-[var(--brand-soft)] object-contain"
        />
        <div className="flex flex-col leading-tight">
          <div className="text-sm font-semibold">团宝</div>
          <div className="text-[10px] text-muted-foreground">你的开团搭子 · 随时在线</div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
            >
              <History className="h-3 w-3" /> 历史 {history.length > 0 && `(${history.length})`}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="border-b px-3 py-2 text-xs font-medium">历史回滚</div>
            <div className="max-h-80 overflow-y-auto">
              {history.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  暂无历史，发送消息后会自动记录此前版本
                </div>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{h.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(h.ts).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => rollback(h)}
                      className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      <RotateCcw className="h-3 w-3" /> 回滚
                    </button>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>


      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && !isLoading && <ChatEmpty onPick={setInput} />}
        {messages.map((m) => (
          <MessageRow key={m.id} msg={m} onAnswer={sendText} />
        ))}
        {status === "submitted" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> 团宝在想…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error.message}
          </div>
        )}
      </div>

      <div className="border-t p-3">
        {suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendText(s)}
                className="rounded-full border border-[oklch(0.85_0.08_55)] bg-[oklch(0.98_0.03_60)] px-3 py-1 text-[11px] text-[oklch(0.45_0.15_40)] transition hover:border-primary/60 hover:bg-[var(--brand-soft)] hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {img.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {img.attachments.map((a) => (
              <div
                key={a.id}
                className="group relative h-14 w-14 overflow-hidden rounded-md border bg-muted"
              >
                <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                {a.uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  </div>
                )}
                {a.error && (
                  <div className="absolute inset-0 grid place-items-center bg-destructive/80 text-[10px] text-white">
                    失败
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => img.remove(a.id)}
                  className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="移除"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void img.addFiles(e.target.files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
        <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            aria-label="上传图片"
            title="添加图片（也可直接拖入或粘贴）"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={img.onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="告诉团宝你想怎么改，或拖/粘贴图片进来 (Enter 发送)"
            className="max-h-32 min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={togglePlan}
            title="开启后团宝会先反问澄清，再动笔"
            className={
              "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium transition " +
              (planMode
                ? "border-transparent bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] text-white shadow-[0_4px_14px_-4px_oklch(0.7_0.19_45/0.55)]"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " + (planMode ? "bg-white" : "bg-muted-foreground/60")
              }
            />
            <ClipboardList className="h-3.5 w-3.5" />
            {planMode ? "计划 已开" : "计划"}
          </button>
          <Button
            size="sm"
            onClick={send}
            disabled={(!input.trim() && img.getReadyFiles().length === 0) || isLoading}
            className="h-8 rounded-lg bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] text-white hover:brightness-110"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>

        </div>
      </div>
      {img.dragActive && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/90 text-sm font-medium text-primary">
          松开即可加入图片
        </div>
      )}
    </div>
  );
}

function ChatEmpty({ onPick }: { onPick: (s: string) => void }) {
  const samples = [
    "把价格档位改成 2 斤 39.9、5 斤 88",
    "标题改成更有食欲一点",
    "副标题加上「现摘现发 24 小时直达」",
    "加一个 1 斤试吃装 19.9 元",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <img
        src={tuanbaoAvatar.url}
        alt="团宝"
        width={80}
        height={80}
        loading="lazy"
        className="h-20 w-20 drop-shadow-[0_12px_24px_oklch(0.7_0.19_45/0.35)]"
      />
      <h3 className="mt-4 text-lg font-semibold">嗨，我是团宝</h3>
      <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
        右侧是真实的快团团预览。点击直接改，或者把你想要的告诉我。
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

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type AskQuestionsOutput = {
  intro?: string;
  questions?: Array<{
    id: string;
    question: string;
    multi?: boolean;
    options: string[];
    allow_other?: boolean;
  }>;
};

function MessageRow({
  msg,
  onAnswer,
}: {
  msg: UIMessage;
  onAnswer: (text: string) => void;
}) {
  const text = msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("")
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(?!\s)/g, "$1");

  const toolParts = msg.parts.filter(
    (p) => p.type.startsWith("tool-") && p.type !== "tool-suggest_next",
  ) as ToolPart[];

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] px-3.5 py-2 text-sm text-white shadow-sm whitespace-pre-wrap">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <img
        src={tuanbaoAvatar.url}
        alt="团宝"
        width={28}
        height={28}
        loading="lazy"
        className="h-7 w-7 shrink-0 rounded-full bg-[var(--brand-soft)] object-contain"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {toolParts.map((part, i) => {
          if (part.type === "tool-ask_questions") {
            return (
              <Questionnaire
                key={i}
                data={part.output as AskQuestionsOutput | undefined}
                state={part.state}
                onAnswer={onAnswer}
              />
            );
          }
          return <ToolCard key={i} part={part} />;
        })}
        {text && (
          <div className="max-w-[95%] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}

function Questionnaire({
  data,
  state,
  onAnswer,
}: {
  data: AskQuestionsOutput | undefined;
  state: string | undefined;
  onAnswer: (text: string) => void;
}) {
  const questions = data?.questions ?? [];
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [others, setOthers] = useState<Record<string, string>>({});
  const [otherOpen, setOtherOpen] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  if (state !== "output-available" || questions.length === 0) {
    return (
      <div className="max-w-[95%] rounded-2xl border border-dashed bg-background/60 px-3.5 py-3 text-xs text-muted-foreground">
        团宝正在准备几个小问题…
      </div>
    );
  }

  const toggle = (qid: string, opt: string, multi: boolean) => {
    if (submitted) return;
    setPicks((prev) => {
      const cur = prev[qid] ?? [];
      if (multi) {
        return {
          ...prev,
          [qid]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt],
        };
      }
      return { ...prev, [qid]: cur[0] === opt ? [] : [opt] };
    });
  };

  const confirm = () => {
    if (submitted) return;
    const lines = questions.map((q, idx) => {
      const chosen = [...(picks[q.id] ?? [])];
      const other = otherOpen[q.id] ? others[q.id]?.trim() : "";
      if (other) chosen.push(other);
      const answer = chosen.length > 0 ? chosen.join(" / ") : "（跳过）";
      return `${idx + 1}. ${q.question} → ${answer}`;
    });
    setSubmitted(true);
    onAnswer(lines.join("\n"));
  };

  const skip = () => {
    if (submitted) return;
    setSubmitted(true);
    onAnswer("（先跳过这些问题，直接按你的判断来）");
  };

  return (
    <div className="max-w-[95%] overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b bg-[var(--brand-soft)]/60 px-3.5 py-2.5">
        <ClipboardList className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">{data?.intro ?? "团宝想先确认几件事"}</span>
      </div>
      <div className="space-y-3 px-3.5 py-3">
        {questions.map((q, idx) => {
          const cur = picks[q.id] ?? [];
          return (
            <div key={q.id}>
              <div className="mb-1.5 text-xs font-medium">
                <span className="text-muted-foreground">{idx + 1}.</span> {q.question}
                {q.multi && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">（可多选）</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => {
                  const active = cur.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={submitted}
                      onClick={() => toggle(q.id, opt, !!q.multi)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] transition",
                        active
                          ? "border-transparent bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] text-white shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        submitted && "opacity-60",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
                {(q.allow_other ?? true) && !otherOpen[q.id] && (
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => setOtherOpen((p) => ({ ...p, [q.id]: true }))}
                    className="rounded-full border border-dashed px-3 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    + 其他
                  </button>
                )}
              </div>
              {otherOpen[q.id] && (
                <input
                  type="text"
                  disabled={submitted}
                  value={others[q.id] ?? ""}
                  onChange={(e) =>
                    setOthers((p) => ({ ...p, [q.id]: e.target.value }))
                  }
                  placeholder="自己写一个…"
                  className="mt-1.5 w-full rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary/60"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3.5 py-2">
        {submitted ? (
          <span className="text-[11px] text-muted-foreground">已提交</span>
        ) : (
          <>
            <button
              type="button"
              onClick={skip}
              className="rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              跳过
            </button>
            <button
              type="button"
              onClick={confirm}
              className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] px-3 py-1 text-[11px] font-medium text-white shadow-sm hover:brightness-110"
            >
              <Check className="h-3 w-3" /> 确认并发送
            </button>
          </>
        )}
      </div>
    </div>
  );
}


function ToolCard({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "") || part.toolName || "tool";
  const label =
    name === "update_product" ? "更新商品信息" : name === "update_skus" ? "更新 SKU" : name;
  const isRunning = part.state === "input-streaming" || part.state === "input-available";
  const hasOutput = part.state === "output-available";
  const failed = part.state === "output-error" || !!part.errorText;

  return (
    <details className="group max-w-[95%] overflow-hidden rounded-xl border bg-background/70">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs">
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-md",
            failed
              ? "bg-destructive/15 text-destructive"
              : hasOutput
                ? "bg-[oklch(0.92_0.08_145)] text-[oklch(0.45_0.12_145)]"
                : "bg-[var(--brand-soft)] text-primary",
          )}
        >
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
        </span>
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {failed ? "失败" : hasOutput ? "已应用" : isRunning ? "执行中" : ""}
        </span>
      </summary>
      <div className="space-y-2 border-t bg-muted/30 px-3 py-2 text-[11px]">
        {part.input != null && (
          <div>
            <div className="mb-1 font-semibold text-muted-foreground">输入</div>
            <pre className="overflow-x-auto rounded bg-background p-2 leading-relaxed">
              {JSON.stringify(part.input, null, 2)}
            </pre>
          </div>
        )}
        {part.output != null && (
          <div>
            <div className="mb-1 font-semibold text-muted-foreground">结果</div>
            <pre className="overflow-x-auto rounded bg-background p-2 leading-relaxed">
              {JSON.stringify(part.output, null, 2)}
            </pre>
          </div>
        )}
        {part.errorText && (
          <div className="text-destructive">{part.errorText}</div>
        )}
      </div>
    </details>
  );
}

/* ============== RIGHT: 快团团 Mock Preview ============== */


type Tab = "intro" | "product" | "settings";

function PreviewPane({
  projectId,
  project,
}: {
  projectId: string;
  project:
    | {
        id: string;
        product?: ProductData;
        intro?: IntroData;
        skus?: SkuItem[];
        settings?: SettingsData;
      }
    | undefined;
}) {
  const [tab, setTab] = useState<Tab>("intro");
  const qc = useQueryClient();
  const update = useServerFn(updateProject);

  const intro: IntroData = project?.intro ?? { title: "", description: "", blocks: [] };
  // Derive sku list: prefer project.skus (jsonb array), fall back to product.skus, fall back to a seeded one.
  const rawSkus: SkuItem[] =
    (project?.skus && Array.isArray(project.skus) ? (project.skus as SkuItem[]) : null) ??
    (project?.product?.skus as SkuItem[] | undefined) ??
    [];
  const settings: SettingsData = project?.settings ?? {};

  const debouncedPatch = useRef<{ patch: Record<string, unknown>; t: ReturnType<typeof setTimeout> | null }>({
    patch: {},
    t: null,
  });

  const persist = (patch: Record<string, unknown>) => {
    debouncedPatch.current.patch = { ...debouncedPatch.current.patch, ...patch };
    if (debouncedPatch.current.t) clearTimeout(debouncedPatch.current.t);
    debouncedPatch.current.t = setTimeout(async () => {
      const p = debouncedPatch.current.patch;
      debouncedPatch.current.patch = {};
      try {
        await update({ data: { id: projectId, patch: p } });
        qc.invalidateQueries({ queryKey: ["project", projectId] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    }, 500);
  };

  const setIntro = (next: IntroData) => persist({ intro: next });
  const setSkus = (next: SkuItem[]) => persist({ skus: next });
  const setSettings = (next: SettingsData) => persist({ settings: next });

  // Bottom sheet state
  const [sheet, setSheet] = useState<{
    open: boolean;
    key: string;
    title: string;
    options?: string[];
  }>({ open: false, key: "", title: "" });

  const openSetting = (key: string, title: string, options?: string[]) =>
    setSheet({ open: true, key, title, options });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[oklch(0.97_0.005_240)]">
      <div className="flex items-center justify-between border-b bg-background px-4 py-2.5">
        <div className="text-[12px] font-medium text-muted-foreground">快团团 · 高保真预览</div>
        <div className="text-[11px] text-muted-foreground">点击任意字段直接编辑</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <TuanPhoneShell tab={tab} onTabChange={setTab}>
          {tab === "intro" && (
            <div className="space-y-2">
              <IntroTab intro={intro} onChange={setIntro} />
              <div className="px-2 pb-3">
                <ProductEntryCard count={rawSkus.length} />
              </div>
            </div>
          )}
          {tab === "product" && (
            <ProductTab
              skus={rawSkus}
              onChange={setSkus}
              settings={settings}
              onOpenSetting={openSetting}
            />
          )}
          {tab === "settings" && (
            <SettingsTab settings={settings} onOpenSetting={openSetting} />
          )}
        </TuanPhoneShell>
      </div>

      <SettingSheet
        open={sheet.open}
        onOpenChange={(b) => setSheet((s) => ({ ...s, open: b }))}
        title={sheet.title}
        initialValue={String(settings[sheet.key] ?? "")}
        options={sheet.options}
        onSave={(v) => setSettings({ ...settings, [sheet.key]: v })}
      />
    </div>
  );
}

