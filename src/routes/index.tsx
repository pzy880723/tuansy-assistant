import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { startProject } from "@/lib/projects.functions";
import { useImageAttachments } from "@/lib/use-image-attachments";
import { ArrowRight, Sparkles, Wand2, Layers, Boxes, Send, ImagePlus, MessageSquare, Loader2, ClipboardList, X } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "团宝助手 — AI 驱动的快团团商品工作台" },
      {
        name: "description",
        content:
          "上传商品图片，自然语言对话，AI 自动生成介绍、规格、SKU，一键同步到快团团。专为团长打造的智能内容工作台。",
      },
      { property: "og:title", content: "团宝助手 — AI 驱动的快团团商品工作台" },
      {
        property: "og:description",
        content: "上传图片，对话改稿，一键同步快团团。",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="surface-ink min-h-screen">
      <TopNav />
      <Hero />
      <Logos />
      <Features />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[oklch(0.13_0.012_50/0.8)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-sm font-bold text-white shadow-[0_4px_16px_oklch(0.7_0.19_45/0.5)]">
            团
          </span>
          <span className="font-semibold tracking-tight">团宝助手</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          <a href="#features" className="hover:text-white">产品能力</a>
          <a href="#how" className="hover:text-white">工作流程</a>
          <Link to="/extension" className="hover:text-white">Chrome 插件</Link>
        </nav>
        <Link
          to="/app"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-[oklch(0.15_0.02_50)] transition hover:bg-white/90"
        >
          进入工作台 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero-bg relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 pt-20 pb-24 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 backdrop-blur">
            <Sparkles className="h-3 w-3 text-[oklch(0.78_0.18_55)]" />
            为快团团团长打造的 AI 工作台
          </div>
          <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            开团，<span className="text-gradient-brand">从一句话开始</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-white/65 md:text-lg">
            把任意与产品相关的文字丢给我，我帮你想清楚、写明白，再一键同步到快团团。
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl">
          <HeroStarter />
          <p className="mt-3 text-center text-xs text-white/40">
            AI 会自动识别品类，生成项目并跳转到工作台 · <Link to="/app" className="underline-offset-4 hover:text-white/70 hover:underline">不急，先逛逛工作台</Link>
          </p>
        </div>

        {/* Mock product window */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-x-10 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,oklch(0.7_0.19_45/0.35),transparent)]" />
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}

function HeroStarter() {
  const navigate = useNavigate();
  const start = useServerFn(startProject);
  const [mode, setMode] = useState<"draft" | "plan">("draft");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const img = useImageAttachments();

  const submit = async () => {
    const value = text.trim();
    const imageUrls = img.getReadyUrls();
    if (img.uploading) {
      toast.error("图片还在上传，稍等片刻");
      return;
    }
    if (value.length < 4 && imageUrls.length === 0) {
      toast.error("再多说两句吧，或者拖一张商品图过来");
      return;
    }
    setLoading(true);
    try {
      const res = await start({
        data: {
          description: value || "（仅图片，无文字描述）",
          mode,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        },
      });
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `tuanbao.chat.${res.id}`,
          JSON.stringify(res.seedMessages),
        );
        if (res.autoUserPrompt) {
          window.sessionStorage.setItem(`tuanbao.boot.${res.id}`, res.autoUserPrompt);
        }
      }
      toast.success(`已识别为「${res.category}」，跳转工作台…`);
      navigate({ to: "/app/project/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "开团失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  const togglePlan = () => {
    setMode((m) => {
      const next = m === "plan" ? "draft" : "plan";
      if (next === "plan") toast.success("已开启计划模式：AI 会先反问澄清");
      else toast("已关闭计划模式");
      return next;
    });
  };

  return (
    <div
      {...img.dragHandlers}
      className={
        "rounded-3xl border bg-[oklch(0.16_0.012_50/0.7)] p-3 shadow-[0_30px_80px_-20px_oklch(0_0_0/0.6)] backdrop-blur-xl transition " +
        (img.dragActive
          ? "border-[oklch(0.7_0.19_45)] ring-4 ring-[oklch(0.7_0.19_45/0.2)]"
          : "border-white/10")
      }
    >
      <div className="relative rounded-2xl border border-white/10 bg-[oklch(0.13_0.012_50)] p-3 focus-within:border-[oklch(0.7_0.19_45/0.5)]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={img.onPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={4}
          disabled={loading}
          placeholder="把任意与产品相关的文字或图片丢给我。可以直接拖图、粘贴图，或者写一句：云南阳光玫瑰，2 斤 39.9 / 5 斤 88，产地直发顺丰冷链。"
          className="block w-full resize-none bg-transparent text-sm leading-relaxed text-white placeholder:text-white/35 focus:outline-none"
        />
        {img.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {img.attachments.map((a) => (
              <div
                key={a.id}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-black/40"
              >
                <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                {a.uploading && (
                  <div className="absolute inset-0 grid place-items-center bg-black/50">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
                {a.error && (
                  <div className="absolute inset-0 grid place-items-center bg-[oklch(0.55_0.2_25/0.85)] text-[10px] text-white">
                    失败
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => img.remove(a.id)}
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="移除"
                >
                  <X className="h-3 w-3" />
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-white/65 hover:bg-white/5 hover:text-white"
            >
              <ImagePlus className="h-3.5 w-3.5" /> 加图片
            </button>
            <span className="hidden text-[11px] text-white/35 sm:inline">或直接拖入 / 粘贴</span>
          </div>
          <div className="flex items-center gap-2">
            <PlanModeChip active={mode === "plan"} onClick={togglePlan} />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={loading}
              className="brand-glow inline-flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI 正在识别…
                </>
              ) : (
                <>
                  {mode === "plan" ? "先聊清楚" : "快速开团"} <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
        {img.dragActive && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-[oklch(0.13_0.012_50/0.85)] text-sm text-[oklch(0.86_0.14_55)]">
            松开即可加入图片
          </div>
        )}
      </div>
    </div>
  );
}

function PlanModeChip({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="开启后 AI 会先反问澄清，再动笔"
      className={
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition " +
        (active
          ? "border-transparent bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-white shadow-[0_6px_20px_-6px_oklch(0.7_0.19_45/0.6)]"
          : "border-white/25 text-white/75 hover:border-white/45 hover:text-white")
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " + (active ? "bg-white" : "bg-white/45")
        }
      />
      <ClipboardList className="h-3.5 w-3.5" />
      {active ? "计划模式 已开" : "计划模式"}
    </button>
  );
}



function ProductMockup() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.16_0.012_50)] shadow-[0_40px_120px_-20px_oklch(0_0_0/0.6)]">
      <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.65_0.18_25)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.16_85)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.72_0.16_145)]" />
        <span className="ml-3 text-[11px] text-white/35">tuanbao.app · 编辑「云南阳光玫瑰」</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
        {/* Chat side */}
        <div className="border-b border-white/5 p-5 md:border-b-0 md:border-r">
          <div className="space-y-3">
            <ChatBubble role="user">把封面图换得更有食欲一点，价格档位改成 2 斤装 39.9，5 斤装 88</ChatBubble>
            <ChatBubble role="ai">
              已更新封面与 2 个 SKU。要不要顺便生成一段「产地直发 · 顺丰冷链」的卖点段落？
            </ChatBubble>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2">
            <ImagePlus className="h-4 w-4 text-white/50" />
            <span className="flex-1 text-sm text-white/40">告诉团宝你想怎么改…</span>
            <button className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-white">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Preview side */}
        <div className="bg-[oklch(0.96_0.01_70)] p-5 text-[oklch(0.18_0.02_50)]">
          <div className="mx-auto max-w-[280px] overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-xl">
            <div className="aspect-[4/3] bg-gradient-to-br from-[oklch(0.85_0.08_80)] to-[oklch(0.7_0.15_45)]" />
            <div className="space-y-2 p-3.5">
              <div className="text-sm font-bold leading-snug">云南阳光玫瑰 · 现摘现发</div>
              <div className="text-[10px] text-[oklch(0.5_0.03_60)]">产地直采 · 顺丰冷链 · 坏果包赔</div>
              <div className="mt-2 space-y-1.5">
                <SkuRow name="2 斤装" price="39.9" />
                <SkuRow name="5 斤装" price="88.0" />
              </div>
              <button className="mt-2 h-8 w-full rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-xs font-semibold text-white">
                参 团
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, children }: { role: "user" | "ai"; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] px-3.5 py-2 text-sm text-white">
        {children}
      </div>
    );
  }
  return (
    <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/85">
      {children}
    </div>
  );
}

function SkuRow({ name, price }: { name: string; price: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[oklch(0.97_0.015_70)] px-2.5 py-1.5">
      <span className="text-xs">{name}</span>
      <span className="text-xs font-bold text-[oklch(0.62_0.22_35)]">¥{price}</span>
    </div>
  );
}

function Logos() {
  return (
    <section className="border-y border-white/5 bg-[oklch(0.11_0.012_50)] py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 text-xs uppercase tracking-[0.18em] text-white/35">
        <span>已被 1000+ 团长信赖</span>
        <span>·</span>
        <span>水果生鲜</span>
        <span>·</span>
        <span>零食烘焙</span>
        <span>·</span>
        <span>家居日用</span>
        <span>·</span>
        <span>美妆个护</span>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Wand2,
      title: "AI 识图填写",
      desc: "上传产品图，AI 自动识别品类、卖点、规格，自动填好商品基础信息。",
    },
    {
      icon: Layers,
      title: "介绍块编辑器",
      desc: "大图、小图、视频、文字、标签自由编排，一段话生成整段介绍。",
    },
    {
      icon: Boxes,
      title: "SKU 矩阵生成",
      desc: "输入规格组，自动生成 SKU 笛卡尔积，批量改价、改库存、套模板。",
    },
    {
      icon: MessageSquare,
      title: "对话即所得",
      desc: "右侧是真实的快团团预览，左侧自然语言告诉团宝怎么改，所改即所见。",
    },
  ];
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.78_0.18_55)]">
          核心能力
        </div>
        <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
          把繁琐的录入，<br />交给会读图的 AI
        </h2>
        <p className="mt-4 text-white/55">
          团长不用再为「写文案、配 SKU、传图片」内耗。打开团宝，开口就行。
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-7 transition hover:border-[oklch(0.7_0.19_45/0.4)] hover:bg-white/[0.04]"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[oklch(0.7_0.19_45/0.08)] blur-3xl transition group-hover:bg-[oklch(0.7_0.19_45/0.18)]" />
            <div className="relative">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.72_0.2_45)] to-[oklch(0.62_0.22_35)] text-white shadow-[0_8px_24px_oklch(0.7_0.19_45/0.4)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "上传商品图片", desc: "拖入或粘贴，多张也行。" },
    { n: "02", title: "对 AI 提需求", desc: "「便宜点的家庭装 + 顺丰发货」。" },
    { n: "03", title: "一键同步快团团", desc: "Chrome 插件自动填写，无需复制粘贴。" },
  ];
  return (
    <section id="how" className="border-t border-white/5 bg-[oklch(0.11_0.012_50)] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.78_0.18_55)]">
            工作流程
          </div>
          <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            三步，开一场新团购
          </h2>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/8 bg-white/[0.02] p-7">
              <div className="text-5xl font-bold text-gradient-brand">{s.n}</div>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-white/55">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="hero-bg border-t border-white/5">
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
          今天就让团宝陪你<br />开第一场团
        </h2>
        <p className="mt-4 text-white/60">无需注册，打开就用。</p>
        <Link
          to="/app"
          className="brand-glow mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] px-7 text-base font-semibold text-white transition hover:brightness-110"
        >
          进入工作台 <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-xs text-white/40 md:flex-row">
        <div>© {new Date().getFullYear()} 团宝助手 · 让团宝替团长省心</div>
        <div className="flex items-center gap-5">
          <Link to="/extension" className="hover:text-white/70">Chrome 插件</Link>
          <Link to="/app" className="hover:text-white/70">工作台</Link>
        </div>
      </div>
    </footer>
  );
}
