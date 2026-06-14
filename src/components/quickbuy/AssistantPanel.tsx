import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Download, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { readAuthToken } from "@/lib/use-current-user";

const suggestions = [
  "导出本周的订单",
  "今天卖了多少？",
  "查 138 开头的客户",
  "批量上传单号",
];

type AnyPart = { type: string; text?: string; input?: unknown; output?: unknown; result?: unknown };

export function AssistantPanel({ compact = false }: { compact?: boolean }) {
  const [transport] = useState(() => new DefaultChatTransport({
    api: "/api/quickbuy-chat",
    headers: (): Record<string, string> => {
      const t = readAuthToken();
      return t ? { "x-tuan-session": t } : {};
    },
  }));
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  const handleSend = () => {
    const t = input.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 30);
  };
  const quickSend = (text: string) => {
    if (busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex items-center gap-2 border-b px-3 py-2", compact ? "text-xs" : "text-sm")}>
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">团宝 · AI 助手</div>
          <div className="truncate text-[10px] text-muted-foreground">一句话查/导/改订单</div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="text-xs text-muted-foreground">用自然语言管订单</div>
            <div className="space-y-1.5 px-1 text-left">
              {[
                "导出本月所有已付款订单",
                "今天卖了多少，几单待发货？",
                "把订单 OXXX 标记已付款",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => quickSend(s)}
                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-left text-[11px] hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => <MessageItem key={m.id} message={m} compact={compact} />)}
            {busy && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                团宝思考中…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t p-2">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          rows={2}
          placeholder="比如：导出本周已发货订单"
          className="resize-none border-0 px-2 py-1.5 text-xs shadow-none focus-visible:ring-0"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 overflow-hidden">
            {suggestions.slice(0, compact ? 2 : 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || busy}
            size="sm"
            className="h-7 gap-1 bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 text-xs hover:brightness-110"
          >
            <Send className="h-3 w-3" /> 发送
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageItem({ message, compact }: { message: { id: string; role: string; parts: unknown[] }; compact: boolean }) {
  const isUser = message.role === "user";
  const parts = (message.parts ?? []) as AnyPart[];
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] space-y-1.5 rounded-xl px-2.5 py-1.5",
          compact ? "text-[11px]" : "text-xs",
          isUser ? "bg-emerald-600 text-white" : "bg-muted",
        )}
      >
        {parts.map((p, i) => {
          if (p.type === "text" && p.text) {
            return <div key={i} className="whitespace-pre-wrap leading-relaxed">{p.text}</div>;
          }
          if (typeof p.type === "string" && p.type.startsWith("tool-")) {
            return <ToolPart key={i} part={p} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

function ToolPart({ part }: { part: AnyPart }) {
  const toolName = part.type?.replace(/^tool-/, "") ?? "";
  const output = (part.output ?? part.result) as
    | { csvBase64?: string; filename?: string; count?: number; success?: number; failed?: number; slug?: string; url?: string; error?: string; orders?: unknown[] }
    | undefined;

  const handleDownload = () => {
    if (!output?.csvBase64 || !output.filename) return;
    const bin = atob(output.csvBase64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = output.filename; a.click();
    URL.revokeObjectURL(url);
    toast.success("已下载");
  };

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1 text-[10px] text-amber-900">
      <div className="font-medium">🔧 {toolName}</div>
      {output?.error && <div className="text-red-600">{output.error}</div>}
      {output?.csvBase64 && (
        <button onClick={handleDownload} className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-white">
          <Download className="h-2.5 w-2.5" /> 下载 {output.filename}（{output.count}）
        </button>
      )}
      {typeof output?.success === "number" && (
        <div>成功 {output.success} · 失败 {output.failed ?? 0}</div>
      )}
      {output?.slug && (
        <div>已开团：<a href={output.url} target="_blank" rel="noreferrer" className="underline">/g/{output.slug}</a></div>
      )}
      {Array.isArray(output?.orders) && output.orders.length > 0 && (
        <div>共 {output.orders.length} 条</div>
      )}
    </div>
  );
}
