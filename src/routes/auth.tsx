import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Smartphone, QrCode, Loader2 } from "lucide-react";
import {
  sendSmsCode,
  verifySmsCode,
  wechatMockLogin,
} from "@/lib/auth.functions";
import { notifyAuthChange } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clearAuthCookies, notifyAuthChange, readAuthCookieError, writePublicUserCookie } from "@/lib/use-current-user";

const SearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({ meta: [{ title: "登录 — 团宝助手" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [tab, setTab] = useState<"phone" | "wechat">("phone");
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const sessionError = readAuthCookieError();
  const safeRedirect = redirect && redirect !== "/auth" && !redirect.startsWith("/auth?") ? redirect : "/app";
  const goNext = () => navigate({ to: safeRedirect, replace: true });

  const resetSession = () => {
    clearAuthCookies();
    notifyAuthChange();
    toast.success("已清理旧会话，请重新登录一次");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-[oklch(0.97_0.02_55)] to-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-base font-bold text-white shadow">
            团
          </span>
          <div>
            <div className="text-base font-semibold tracking-tight">团宝助手</div>
            <div className="text-xs text-muted-foreground">登录后开始创建你的团购</div>
          </div>
        </div>

        {sessionError ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
            <div>{sessionError}</div>
            <button type="button" onClick={resetSession} className="mt-1 font-medium underline underline-offset-2">
              重新登录
            </button>
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          {(
            [
              { k: "phone", label: "手机验证码", icon: Smartphone },
              { k: "wechat", label: "微信扫码", icon: QrCode },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs transition",
                tab === t.k
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "phone" ? <PhoneForm onSuccess={goNext} /> : <WechatForm onSuccess={goNext} />}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          开发期为模拟登录：验证码固定 <span className="font-mono font-semibold text-foreground">123456</span>；微信扫码点一下即可。
        </p>
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

  const handleSend = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error("请输入正确的手机号");
      return;
    }
    try {
      await send({ data: { phone } });
      toast.success("验证码已发送（开发期固定 123456）");
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
      toast.error(e instanceof Error ? e.message : "发送失败");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("请输入 6 位验证码");
      return;
    }
    setSubmitting(true);
    try {
      const res = await verify({ data: { phone, code } });
      writePublicUserCookie({
        id: res.user.id,
        nickname: res.user.nickname,
        phone: res.user.phone ?? null,
        wechat: !!res.user.wechat_openid,
      });
      notifyAuthChange();
      toast.success("登录成功");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">手机号</label>
        <Input
          inputMode="numeric"
          maxLength={11}
          placeholder="请输入手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          className="h-10"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">验证码</label>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="6 位验证码"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-10 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            disabled={countdown > 0}
            onClick={handleSend}
            className="h-10 shrink-0 px-3 text-xs"
          >
            {countdown > 0 ? `${countdown}s` : "获取验证码"}
          </Button>
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="h-10 w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "登录"}
      </Button>
    </form>
  );
}

function WechatForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useServerFn(wechatMockLogin);
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await login();
      writePublicUserCookie({
        id: res.user.id,
        nickname: res.user.nickname,
        phone: res.user.phone ?? null,
        wechat: !!res.user.wechat_openid,
      });
      notifyAuthChange();
      toast.success("微信登录成功");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="grid h-44 place-items-center rounded-xl border-2 border-dashed border-border bg-muted/40">
        <div className="text-center">
          <QrCode className="mx-auto h-16 w-16 text-muted-foreground/60" />
          <p className="mt-2 text-xs text-muted-foreground">微信扫码占位（开发期）</p>
        </div>
      </div>
      <Button onClick={handleClick} disabled={loading} className="h-10 w-full" variant="secondary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "模拟扫码成功"}
      </Button>
    </div>
  );
}
