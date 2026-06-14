import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Download, Sparkles, Package2, Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/quickbuy/assistant")({
  component: AssistantPage,
});

const suggestions = [
  "导出本周的订单",
  "今天卖了多少？",
  "查一下手机 138 开头的客户",
  "把这批单号都传上去",
];

function AssistantPage() {
  const transport = new DefaultChatTransport({ api: "/api/quickbuy-chat" });
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const handleSend = () => {
    const t = input.trim();
    if (!t || status === "submitted" || status === "streaming") return;
    sendMessage({ text: t });
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-rows-[auto_1fr_auto] gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Bot className="h-6 w-6 text-amber-500" /> AI 助手
          </h1>
          <p className="text-sm text-muted-foreground">用自然语言查订单、导出 Excel、批量上传单号、开团</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Link to="/quickbuy/orders" className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 hover:bg-muted">
            <Package2 className="h-3 w-3" /> 看订单
          </Link>
        </div>
      </header>

      <div ref={scrollRef} className="overflow-y-auto rounded-2xl border bg-card p-4">
        {messages.length === 0 ? (
          <Welcome onPick={(s) => { setInput(s); setTimeout(() => inputRef.current?.focus(), 0); }} />
        ) : (
          <div className="space-y-4">
            {messages.map((m) => <MessageItem key={m.id} message={m} />)}
            {(status === "submitted" || status === "streaming") && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                团宝速购助手思考中…
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-3">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          rows={2}
          placeholder="比如：导出 12 月 1 到 7 号已发货的订单"
          className="resize-none border-0 px-2 text-sm shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setInput(s)} className="rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">
                {s}
              </button>
            ))}
          </div>
          <Button onClick={handleSend} disabled={!input.trim() || status === "submitted" || status === "streaming"} className="h-8 gap-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110">
            <Send className="h-3.5 w-3.5" /> 发送
          </Button>
        </div>
      </div>
    </div>
  );
}

function Welcome({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="grid h-full place-items-center py-12 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
          <Sparkles className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">用一句话管订单</h2>
          <p className="mt-1 text-sm text-muted-foreground">说出你要做的事，AI 会自动调用相应工具。</p>
        </div>
        <div className="space-y-2 text-left">
          {[
            { icon: Download, text: "导出本月所有已付款订单" },
            { icon: Upload, text: "把这两列粘贴上去，全部发货：\n2606140001  SF123\n2606140002  SF456" },
            { icon: FileSpreadsheet, text: "今天卖了多少，有几单待发货？" },
          ].map((it, i) => (
            <button key={i} onClick={() => onPick(it.text)} className="flex w-full items-start gap-2 rounded-lg border bg-background p-2.5 text-left text-xs hover:bg-muted">
              <it.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span className="whitespace-pre-wrap">{it.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type AnyPart = { type: string; text?: string; toolName?: string; input?: unknown; output?: unknown; result?: unknown };

function MessageItem({ message }: { message: { id: string; role: string; parts: unknown[] } }) {
  const isUser = message.role === "user";
  const parts = (message.parts ?? []) as AnyPart[];
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] space-y-2 rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-emerald-600 text-white" : "bg-muted"}`}>
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
  const output = (part.output ?? part.result) as { csvBase64?: string; filename?: string; count?: number; success?: number; failed?: number; orders?: unknown[]; slug?: string; url?: string; error?: string } | undefined;

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
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
      <div className="mb-1 font-medium">🔧 {toolName}</div>
      {output?.error && <div className="text-red-600">{output.error}</div>}
      {output?.csvBase64 && (
        <button onClick={handleDownload} className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-white">
          <Download className="h-3 w-3" /> 下载 {output.filename}（{output.count} 条）
        </button>
      )}
      {typeof output?.success === "number" && (
        <div>成功 {output.success} 条 · 失败 {output.failed ?? 0} 条</div>
      )}
      {output?.slug && (
        <div>已开团：<a href={output.url} target="_blank" rel="noreferrer" className="underline">/g/{output.slug}</a></div>
      )}
      {Array.isArray(output?.orders) && output.orders.length > 0 && (
        <div className="mt-1 text-amber-800">共 {output.orders.length} 条</div>
      )}
    </div>
  );
}
