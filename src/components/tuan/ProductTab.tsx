import { Plus, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { InlineText, MiniBtn, SettingRow } from "./primitives";
import { ProductEntryCard } from "./IntroTab";
import type { SkuItem, SettingsData } from "./types";
import { SETTING_DEFAULTS } from "./types";

export function ProductTab({
  skus,
  onChange,
  settings,
  onOpenSetting,
}: {
  skus: SkuItem[];
  onChange: (next: SkuItem[]) => void;
  settings: SettingsData;
  onOpenSetting: (key: string, title: string, options?: string[]) => void;
}) {
  const update = (i: number, patch: Partial<SkuItem>) =>
    onChange(skus.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  const remove = (i: number) => onChange(skus.filter((_, j) => j !== i));

  const add = (after?: number) => {
    const next: SkuItem = { name: "新商品", price: "0", stock: "100", spec: "" };
    if (after === undefined) onChange([...skus, next]);
    else {
      const copy = skus.slice();
      copy.splice(after + 1, 0, next);
      onChange(copy);
    }
  };

  const val = (k: string) => String(settings[k] ?? SETTING_DEFAULTS[k] ?? "");

  return (
    <div className="space-y-2 px-2 pb-3 pt-2">
      {/* Product cards */}
      <div className="rounded-xl bg-white p-3">
        {skus.length === 0 && (
          <div className="py-8 text-center text-[12px] text-[#969799]">还没有商品，点击下方添加</div>
        )}
        {skus.map((sku, i) => (
          <div key={i} className="relative mb-3 rounded-md bg-[#fafbfc] p-2">
            <div className="absolute right-2 top-2 flex gap-1">
              <MiniBtn onClick={() => add(i)}>添加</MiniBtn>
              <MiniBtn onClick={() => remove(i)}>删除</MiniBtn>
            </div>
            <div className="flex gap-2.5">
              <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-[#e5e6e8] to-[#c8c9cc]">
                {sku.image ? (
                  <img src={sku.image} alt={sku.name} className="h-full w-full object-cover" />
                ) : (
                  <button
                    onClick={() => toast.info("上传商品图：即将上线")}
                    className="grid h-full w-full place-items-center text-[10px] text-white/80"
                  >
                    + 图片
                  </button>
                )}
                <div className="absolute bottom-0 left-0 bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
                  剩 {sku.stock || "0"} 件
                </div>
              </div>
              <div className="min-w-0 flex-1 pr-16">
                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <InlineText
                      value={sku.name}
                      onChange={(v) => update(i, { name: v })}
                      placeholder="商品名称"
                      className="text-[13px] font-medium text-[#1a1a1a]"
                    />
                  </div>
                  <Edit3 className="mt-1 h-3.5 w-3.5 shrink-0 text-[#07c160]" />
                </div>
                <div className="mt-1 flex items-baseline text-[#fa5151]">
                  <span className="text-[11px] font-bold">¥</span>
                  <InlineText
                    value={sku.price}
                    onChange={(v) => update(i, { price: v })}
                    placeholder="0"
                    className="text-[17px] font-bold"
                  />
                </div>
                <InlineText
                  value={sku.spec ?? ""}
                  onChange={(v) => update(i, { spec: v })}
                  placeholder="规格描述（颜色、尺码等）"
                  className="text-[11px] text-[#969799]"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => add()}
          className="flex h-10 w-full items-center justify-center rounded-md border border-[#07c160] text-[13px] text-[#07c160] transition active:bg-[#07c160]/5"
        >
          <Plus className="mr-1 h-4 w-4" /> 添加商品
        </button>
      </div>

      {/* Mini settings card */}
      <div className="rounded-xl bg-white">
        <div className="border-b border-[#f0f1f2] px-4 pb-2.5 pt-3.5 text-[15px] font-semibold text-[#1a1a1a]">
          团购设置
        </div>
        <SettingRow
          label="物流方式"
          value={val("delivery_method")}
          onClick={() => onOpenSetting("delivery_method", "物流方式", ["快递", "自提", "同城配送"])}
        />
        <div className="mx-4 h-px bg-[#f0f1f2]" />
        <SettingRow
          label="发货时间"
          value={val("shipping_time")}
          valueClassName={val("shipping_time").includes("未") ? "text-[#fa9d3b]" : ""}
          onClick={() => onOpenSetting("shipping_time", "发货时间")}
        />
        <div className="mx-4 h-px bg-[#f0f1f2]" />
        <SettingRow
          label="团购时间"
          value={val("group_period")}
          onClick={() => onOpenSetting("group_period", "团购时间")}
        />
        <div className="mx-4 h-px bg-[#f0f1f2]" />
        <SettingRow
          label="开团通知推送"
          value={val("notify_targets")}
          onClick={() => onOpenSetting("notify_targets", "开团通知推送", ["全部订阅成员", "仅老客户", "不推送"])}
        />
        <div className="mx-4 h-px bg-[#f0f1f2]" />
        <button
          onClick={() => toast.info("到「设置」标签查看更多")}
          className="flex w-full items-center justify-between px-4 py-3.5"
        >
          <div className="text-left">
            <div className="text-[14px] text-[#1a1a1a]">更多团购设置</div>
            <div className="text-[11px] text-[#969799]">优惠设置、帮卖设置、隐私设置</div>
          </div>
          <span className="text-[#c8c9cc]">∨</span>
        </button>
      </div>
    </div>
  );
}
