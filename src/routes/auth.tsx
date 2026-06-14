import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Smartphone,
  QrCode,
  Loader2,
  ShieldCheck,
  Sparkles,
  Rocket,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  initWechatLogin,
  pollWechatLogin,
  sendSmsCode,
  signOut,
  verifySmsCode,
} from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import logoHorizontal from "@/assets/logo-horizontal.png.asset.json";
import logoMascot from "@/assets/logo-mascot.png.asset.json";
import {
  clearAuthCookies,
  notifyAuthChange,
  readAuthCookieError,
  writePublicUserCookie,
} from "@/lib/use-current-user";

const SearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "登录 — 团宝助手" },
      {
        name: "description",
        content: "登录团宝助手，AI 一句话生成团购页 + 高效团长后台。",
      },
    ],
  }),
  component: AuthPage,
});

function getSafeRedirect(redirect?: string) {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return "/";
  if (redirect === "/auth" || redirect.startsWith("/auth?")) return "/";
  return redirect;
}

function AuthPage() {
  const [tab, setTab] = useState<"phone" | "wechat">("phone");
  const [sessionError, setSessionError] = useState(() => readAuthCookieError());
  const navigate = useNavigate();
  const logout = useServerFn(signOut);
  const { redirect } = useSearch({ from: "/auth" });
  const safeRedirect = getSafeRedirect(redirect);
  const goNext = () => navigate({ to: safeRedirect, replace: true });

  const resetSession = async () => {
    try {
      await logout();
    } catch {
      /* noop */
    }
    clearAuthCookies();
    setSessionError(null);
    notifyAuthChange();
    toast.success("已清理旧会话，请重新登录一次");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[oklch(0.99_0.01_75)] text-foreground">
      {/* 背景：暖橙径向渐变 + 两个柔光光斑 */}
      <div className="pointer-events-none absolute inset-0 hero-bg" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 -left-20 h-[480px] w-[480px] rounded-full bg-[oklch(0.78_0.18_55_/_0.35)] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-[oklch(0.82_0.14_70_/_0.35)] blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 md:px-8 md:py-10 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch lg:gap-12">
        <BrandSide />

        <div className="flex flex-1 items-center justify-center">
          <div
            className={cn(
              "w-full max-w-md rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_30px_80px_-30px_rgba(255,122,45,0.45)] backdrop-blur-xl",
              "md:p-8",
              "animate-in fade-in slide-in-from-bottom-4 duration-500",
            )}
          >
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <img src={logoHorizontal.url} alt="团宝助手" className="h-9 w-auto" />
            </div>
            <div className="mb-1 text-xl font-semibold tracking-tight">
              欢迎回来 👋
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              登录后开始创建你的团购，开团、上架、收单一气呵成。
            </p>

            {sessionError ? (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
                <div>{sessionError}</div>
                <button
                  type="button"
                  onClick={resetSession}
                  className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2"
                >
                  <RefreshCw className="h-3 w-3" /> 清理旧会话
                </button>
              </div>
            ) : null}

            <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/70 bg-white/60 p-1 text-sm shadow-inner">
              {(
                [
                  { k: "phone", label: "手机验证码", icon: Smartphone },
                  { k: "wechat", label: "微信扫码", icon: QrCode },
                ] as const
              ).map((t) => {
                const active = tab === t.k;
                return (
                  <button
                    key={t.k}
                    type="button"
                    onClick={() => setTab(t.k)}
                    className={cn(
                      "relative inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm transition-all",
                      active
                        ? "bg-gradient-to-r from-[oklch(0.72_0.19_50)] to-[oklch(0.78_0.17_60)] font-medium text-white shadow-[0_8px_20px_-8px_rgba(255,122,45,0.6)]"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <t.icon className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {tab === "phone" ? (
              <PhoneForm onSuccess={goNext} />
            ) : (
              <WechatForm onSuccess={goNext} />
            )}

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              登录即表示同意
              <a className="mx-1 underline-offset-2 hover:underline" href="#">《用户协议》</a>
              与
              <a className="mx-1 underline-offset-2 hover:underline" href="#">《隐私政策》</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandSide() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br from-[oklch(0.97_0.04_70)] via-white/40 to-[oklch(0.92_0.08_55)] p-10 shadow-[0_30px_80px_-40px_rgba(255,122,45,0.4)] backdrop-blur-sm lg:flex">
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 rounded-full bg-[oklch(0.78_0.2_50_/_0.45)] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 -left-10 h-64 w-64 rounded-full bg-[oklch(0.85_0.12_75_/_0.5)] blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <img src={logoHorizontal.url} alt="团宝助手" className="h-10 w-auto" />
        <div className="mt-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-3 py-1 text-xs font-medium text-[oklch(0.45_0.15_40)] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> AI 一句话生成团购页
          </div>
          <h1 className="mt-5 text-[2.5rem] font-bold leading-tight tracking-tight">
            一句话 <span className="text-gradient-brand">开团</span>
            <br />
            收单、发货全搞定
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[oklch(0.35_0.03_50)]">
            告别复制粘贴 PDD/淘宝详情页的体力活。团宝助手帮你把商品资料一键转成可发布的团购页，
            自动整理客户订单、地址、物流。
          </p>
        </div>

        <ul className="mt-8 space-y-3">
          {[
            { icon: Rocket, title: "极速开团", desc: "AI 生成详情页 + 多规格，5 分钟上线" },
            { icon: ShieldCheck, title: "数据安全", desc: "手机/微信双因素登录，订单加密存储" },
            { icon: CheckCircle2, title: "全流程闭环", desc: "下单、改单、发货、对账一站完成" },
          ].map((f) => (
            <li key={f.title} className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/80 text-[oklch(0.6_0.2_40)] shadow-sm">
                <f.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="text-xs text-[oklch(0.4_0.03_50)]">{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-10 flex items-end justify-between">
        <div className="text-xs text-[oklch(0.4_0.03_50)]">
          <div className="font-medium">已为 1,200+ 团长服务</div>
          <div className="mt-0.5">让每一次开团，都更轻松</div>
        </div>
        <img
          src={logoMascot.url}
          alt=""
          aria-hidden
          className="h-20 w-auto select-none opacity-90 drop-shadow-[0_10px_30px_rgba(255,122,45,0.35)]"
        />
      </div>
    </div>
  );
}

function PhoneForm({ onSuccess }: { onSuccess: () => void }) {
  const send = useServerFn(sendSmsCode);
  const verify = useServerFn(verifySmsCode);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error("请输入正确的手机号");
      setError("手机号格式不正确，请检查后重新输入。");
      return;
    }
    setSending(true);
    try {
      const res = await send({ data: { phone } });
      toast.success(res.mode === "dev" ? "临时验证码为 123456" : "验证码已发送，请查收短信");
      setCountdown(60);
      const t = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e) {
      const message = e instanceof Error ? e.message : "发送失败";
      setError(`验证码发送失败：${message}`);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      toast.error("请输入 6 位验证码");
      setError("验证码需要填写 6 位数字。");
      return;
    }
    setSubmitting(true);
    try {
      const res = await verify({ data: { phone, code } });
      writePublicUserCookie(
        {
          id: res.user.id,
          nickname: res.user.nickname,
          phone: res.user.phone ?? null,
          wechat: !!res.user.wechat_openid,
          role: res.user.role,
          isAdmin: res.user.isAdmin,
        },
        res.sessionToken,
      );
      notifyAuthChange();
      toast.success("登录成功");
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "登录失败";
      setError(`登录失败：${message}`);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
          {error}
        </div>
      ) : null}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">手机号</label>
        <Input
          inputMode="numeric"
          maxLength={11}
          placeholder="请输入 11 位手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          className="h-11 rounded-xl border-white/80 bg-white/80 text-base shadow-sm"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-foreground">验证码</label>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="6 位验证码"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-11 flex-1 rounded-xl border-white/80 bg-white/80 text-base tracking-[0.4em] shadow-sm"
          />
          <Button
            type="button"
            variant="outline"
            disabled={countdown > 0 || sending}
            onClick={handleSend}
            className="h-11 shrink-0 rounded-xl border-white/80 bg-white/80 px-3 text-xs"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : countdown > 0 ? (
              `${countdown}s`
            ) : (
              "获取验证码"
            )}
          </Button>
        </div>
      </div>
      <Button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-xl bg-gradient-to-r from-[oklch(0.72_0.19_50)] to-[oklch(0.78_0.17_60)] text-base font-medium text-white shadow-[0_12px_30px_-10px_rgba(255,122,45,0.6)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-10px_rgba(255,122,45,0.7)]"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "登录 / 注册"}
      </Button>
    </form>
  );
}

function WechatForm({ onSuccess }: { onSuccess: () => void }) {
  const init = useServerFn(initWechatLogin);
  const poll = useServerFn(pollWechatLogin);
  const [state, setState] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);
  const [status, setStatus] = useState<"loading" | "waiting" | "done" | "expired" | "error">(
    "loading",
  );
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const start = async () => {
    stopPoll();
    setStatus("loading");
    setMessage(null);
    try {
      const res = await init({ data: { origin: window.location.origin } });
      setState(res.state);
      setQrUrl(res.qrUrl);
      setConfigured(res.configured);
      if (!res.configured) {
        setStatus("error");
        setMessage("微信登录尚未配置：管理员还未填写微信开放平台 AppID / AppSecret。请使用手机号登录。");
        return;
      }
      setStatus("waiting");
      pollRef.current = window.setInterval(async () => {
        try {
          const r = await poll({ data: { state: res.state } });
          if (r.status === "pending") return;
          stopPoll();
          if (r.status === "expired") {
            setStatus("expired");
            setMessage("二维码已过期，请点击刷新重新获取");
            return;
          }
          if (r.status === "error") {
            setStatus("error");
            setMessage(r.message || "登录失败");
            return;
          }
          if (r.status === "done") {
            writePublicUserCookie(
              {
                id: r.user.id,
                nickname: r.user.nickname,
                phone: r.user.phone ?? null,
                wechat: !!r.user.wechat_openid,
                role: r.user.role,
                isAdmin: r.user.isAdmin,
              },
              r.sessionToken,
            );
            notifyAuthChange();
            setStatus("done");
            toast.success("微信登录成功");
            onSuccess();
          }
        } catch {
          /* 网络抖动忽略，下次再试 */
        }
      }, 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "微信登录初始化失败";
      setStatus("error");
      setMessage(msg);
    }
  };

  useEffect(() => {
    start();
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative grid h-64 place-items-center overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-[oklch(0.97_0.03_140)] via-white to-[oklch(0.95_0.04_70)] shadow-inner">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-xs">正在准备二维码…</span>
          </div>
        )}

        {status === "waiting" && configured && qrUrl && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3">
            {/* 微信官方 qrconnect 页面直接嵌入 */}
            <iframe
              title="微信扫码登录"
              src={qrUrl}
              className="h-44 w-44 border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
            <div className="flex items-center gap-1.5 text-xs text-[oklch(0.4_0.05_140)]">
              <QrCode className="h-3.5 w-3.5" /> 请使用微信扫一扫
            </div>
          </div>
        )}

        {(status === "expired" || status === "error") && (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {message || "二维码不可用"}
            </p>
            {configured && (
              <Button
                size="sm"
                variant="outline"
                onClick={start}
                className="h-8 rounded-lg text-xs"
              >
                <RefreshCw className="mr-1 h-3 w-3" /> 重新获取
              </Button>
            )}
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-2 text-[oklch(0.55_0.18_140)]">
            <CheckCircle2 className="h-10 w-10" />
            <span className="text-sm font-medium">登录成功，正在跳转…</span>
          </div>
        )}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        扫码后将自动登录，无需输入密码。首次使用会用你的微信昵称创建账号。
      </p>
    </div>
  );
}
