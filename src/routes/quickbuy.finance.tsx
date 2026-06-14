import { createFileRoute } from "@tanstack/react-router";
import { Wallet, TrendingUp, ArrowDownToLine, Users, Lock } from "lucide-react";

export const Route = createFileRoute("/quickbuy/finance")({
  component: FinancePage,
});

function FinancePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">资金分润</h1>
        <p className="text-sm text-muted-foreground">即将上线 · 当前为团长自收款模式，不涉及平台资金</p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
            <Lock className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <div className="font-semibold">当前阶段（一期）</div>
            <p className="mt-1 text-muted-foreground">
              团宝速购采用「团长自收款」模式：买家通过微信/转账直接付款给您，您在订单管理里手动标记付款状态。
              这一期不涉及平台资金，无需开通商户号，所有交易都属于您和买家之间。
            </p>
            <div className="mt-3 font-semibold">二期将开放</div>
            <p className="mt-1 text-muted-foreground">
              微信 JSAPI 在线支付 · 平台代收 · 收入流水 · 退款管理 · 团长账户余额 · 提现到银行卡 · 多级分销分润 · 平台抽佣可配置。
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <DisabledCard icon={Wallet} label="账户余额" value="¥ ——" />
        <DisabledCard icon={TrendingUp} label="本月收入" value="¥ ——" />
        <DisabledCard icon={ArrowDownToLine} label="可提现" value="¥ ——" />
        <DisabledCard icon={Users} label="分销下级" value="——" />
      </div>

      <div className="rounded-2xl border bg-card p-5 opacity-60">
        <h2 className="mb-3 text-sm font-semibold">流水（占位）</h2>
        <div className="py-12 text-center text-xs text-muted-foreground">敬请期待</div>
      </div>
    </div>
  );
}

function DisabledCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="relative rounded-xl border bg-card p-4 opacity-60">
      <div className="absolute right-2 top-2 text-[9px] text-muted-foreground">敬请期待</div>
      <Icon className="mb-2 h-4 w-4 text-muted-foreground" />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-muted-foreground">{value}</div>
    </div>
  );
}
