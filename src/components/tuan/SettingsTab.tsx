import { HelpCircle } from "lucide-react";
import { SettingRow } from "./primitives";
import type { SettingsData } from "./types";
import { SETTING_DEFAULTS } from "./types";

type RowSpec = {
  key: string;
  label: string;
  badge?: string;
  options?: string[];
  warn?: boolean;
};

const GROUPS: { title: string; help?: string; rows: RowSpec[] }[] = [
  {
    title: "团购设置",
    rows: [
      { key: "delivery_method", label: "物流方式", options: ["快递", "自提", "同城配送"] },
      { key: "shipping_time", label: "发货时间", warn: true },
      { key: "group_period", label: "团购时间" },
      { key: "notify_targets", label: "开团通知推送", options: ["全部订阅成员", "仅老客户", "不推送"] },
    ],
  },
  {
    title: "帮卖设置",
    help: "了解帮卖",
    rows: [
      { key: "resell_copy", label: "复制我的团进行帮卖" },
      { key: "resell_share", label: "分享我的团进行帮卖" },
      { key: "resell_assets", label: "添加团购素材" },
      { key: "resell_leaderboard", label: "设置帮卖龙虎榜" },
    ],
  },
  {
    title: "优惠设置",
    help: "玩法介绍",
    rows: [
      { key: "first_order_discount", label: "团首单优惠", badge: "设置加曝光" },
      { key: "full_reduce", label: "团满减优惠" },
      { key: "multi_discount", label: "多件多折" },
      { key: "surprise_redpack", label: "团惊喜红包", badge: "设置加曝光" },
    ],
  },
  {
    title: "营销设置",
    rows: [
      { key: "free_share", label: "设置立享免单" },
      { key: "group_buy", label: "设置拼团商品" },
      { key: "lottery", label: "设置抽奖" },
      { key: "tiered_price", label: "阶梯价" },
      { key: "gifts", label: "设置赠品" },
    ],
  },
  {
    title: "隐私设置",
    rows: [
      {
        key: "forward_setting",
        label: "团购转发设置",
        options: ["所有人均可转发", "仅自己可转发"],
      },
      {
        key: "follower_display",
        label: "跟团用户显示",
        options: ["只显示匿名头像", "显示真实头像"],
      },
      { key: "admin", label: "团管理员" },
    ],
  },
  {
    title: "其他设置",
    rows: [
      { key: "allow_coupon", label: "允许使用优惠券", badge: "新", options: ["允许", "不允许"] },
      { key: "min_order", label: "起购规则设置" },
      {
        key: "show_stock",
        label: "允许向用户展示库存",
        options: ["小于等于20件允许展示", "全部展示", "不展示"],
      },
      { key: "allow_user_copy", label: "允许用户复制团购", options: ["允许", "不允许"] },
      { key: "recommend", label: "设置推荐团购" },
      { key: "allow_copy_code", label: "允许复制商品编码", options: ["允许", "不允许"] },
      { key: "category", label: "团购分类" },
      { key: "follow_tip", label: "跟团提示" },
    ],
  },
];

export function SettingsTab({
  settings,
  onOpenSetting,
}: {
  settings: SettingsData;
  onOpenSetting: (key: string, title: string, options?: string[]) => void;
}) {
  const val = (k: string) => String(settings[k] ?? SETTING_DEFAULTS[k] ?? "");

  return (
    <div className="space-y-2 px-2 pb-3 pt-2">
      {GROUPS.map((g) => (
        <div key={g.title} className="rounded-xl bg-white">
          <div className="flex items-center justify-between border-b border-[#f0f1f2] px-4 pb-2.5 pt-3.5">
            <div className="text-[15px] font-semibold text-[#1a1a1a]">{g.title}</div>
            {g.help && (
              <div className="flex items-center gap-0.5 text-[11px] text-[#969799]">
                {g.help} <HelpCircle className="h-3 w-3" />
              </div>
            )}
          </div>
          {g.rows.map((r, i) => (
            <div key={r.key}>
              {i > 0 && <div className="mx-4 h-px bg-[#f0f1f2]" />}
              <SettingRow
                label={r.label}
                badge={r.badge}
                value={val(r.key) || (r.key === "follow_tip" ? "输入提醒，用户跟团时可见提醒" : "")}
                valueClassName={r.warn && val(r.key).includes("未") ? "text-[#fa9d3b]" : ""}
                onClick={() => onOpenSetting(r.key, r.label, r.options)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
