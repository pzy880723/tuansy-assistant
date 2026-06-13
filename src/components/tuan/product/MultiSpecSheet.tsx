import { useState } from "react";
import { Edit3, Plus, Trash2, Image as ImgIcon, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { SkuItem, SpecGroup } from "../types";
import {
  MAX_SPEC_GROUPS,
  PRESET_SPEC_TYPES,
  cartesianValueIds,
  makeSpecGroup,
  makeSpecValue,
  reconcileVariants,
  variantLabel,
} from "./product-helpers";

/** "多规格设置" page — full-screen overlay inside the phone shell. */
export function MultiSpecSheet({
  open,
  product,
  onCancel,
  onSave,
}: {
  open: boolean;
  product: SkuItem;
  onCancel: () => void;
  onSave: (groups: SpecGroup[], variants: SkuItem["variants"]) => void;
}) {
  const [groups, setGroups] = useState<SpecGroup[]>(
    product.specGroups && product.specGroups.length > 0
      ? product.specGroups
      : [makeSpecGroup("颜色", true)],
  );
  const [variants, setVariants] = useState(product.variants ?? []);
  const [showCode, setShowCode] = useState(!!product.showVariantCode);

  // batch-setting inputs
  const [batchPrice, setBatchPrice] = useState("");
  const [batchCost, setBatchCost] = useState("");
  const [batchStock, setBatchStock] = useState("");

  if (!open) return null;

  const updateGroup = (gid: string, patch: Partial<SpecGroup>) => {
    const next = groups.map((g) => (g.id === gid ? { ...g, ...patch } : g));
    setGroups(next);
    setVariants(reconcileVariants(next, variants));
  };
  const removeGroup = (gid: string) => {
    const next = groups.filter((g) => g.id !== gid);
    setGroups(next);
    setVariants(reconcileVariants(next, variants));
  };
  const addPresetGroup = (name: string) => {
    if (groups.length >= MAX_SPEC_GROUPS) {
      toast.info(`最多 ${MAX_SPEC_GROUPS} 组规格`);
      return;
    }
    if (groups.some((g) => g.name === name)) {
      toast.info("已添加该规格");
      return;
    }
    const next = [...groups, makeSpecGroup(name, groups.length === 0)];
    setGroups(next);
    setVariants(reconcileVariants(next, variants));
  };
  const addEmptyGroup = () => {
    if (groups.length >= MAX_SPEC_GROUPS) {
      toast.info(`最多 ${MAX_SPEC_GROUPS} 组规格`);
      return;
    }
    const next = [...groups, makeSpecGroup("新规格", groups.length === 0)];
    setGroups(next);
  };
  const addValue = (gid: string, label = "") => {
    const next = groups.map((g) =>
      g.id === gid ? { ...g, values: [...g.values, makeSpecValue(label)] } : g,
    );
    setGroups(next);
    setVariants(reconcileVariants(next, variants));
  };
  const updateValue = (gid: string, vid: string, label: string) => {
    setGroups(
      groups.map((g) =>
        g.id === gid
          ? { ...g, values: g.values.map((v) => (v.id === vid ? { ...v, label } : v)) }
          : g,
      ),
    );
  };
  const removeValue = (gid: string, vid: string) => {
    const next = groups.map((g) =>
      g.id === gid ? { ...g, values: g.values.filter((v) => v.id !== vid) } : g,
    );
    setGroups(next);
    setVariants(reconcileVariants(next, variants));
  };

  const applyBatch = () => {
    if (!batchPrice && !batchCost && !batchStock) {
      toast.info("请先输入要批量设置的值");
      return;
    }
    setVariants(
      variants.map((v) => ({
        ...v,
        price: batchPrice || v.price,
        costPrice: batchCost || v.costPrice,
        stock: batchStock || v.stock,
      })),
    );
    toast.success("已批量设置");
  };

  const handleDone = () => {
    // Ensure variants are reconciled to current groups
    const ids = cartesianValueIds(groups);
    if (groups.length > 0 && ids.length === 0) {
      toast.error("请为每个规格添加至少一个具体规格");
      return;
    }
    onSave(groups, variants);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f4f5f7]">
      {/* nav */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <button onClick={onCancel} className="text-[14px] text-[#1a1a1a]">
          取消
        </button>
        <div className="text-[15px] font-semibold">多规格设置</div>
        <button onClick={handleDone} className="text-[14px] font-medium text-[#07c160]">
          完成
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-3">
        {/* tutorial banner */}
        <div className="flex items-center justify-between bg-[#fff7e6] px-4 py-2 text-[12px]">
          <span className="text-[#fa9d3b]">多规格设置教程</span>
          <span className="text-[#969799]">点击查看 &gt;</span>
        </div>

        {/* preset chips */}
        <div className="bg-white px-4 pb-3 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[14px] font-semibold">选择常用规格类型</span>
            <button
              onClick={() => toast.info("规格管理：即将上线")}
              className="text-[12px] text-[#07c160]"
            >
              管理
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_SPEC_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => addPresetGroup(t)}
                className="rounded-md bg-[#f4f5f7] px-3 py-1 text-[12px] text-[#1a1a1a] active:bg-[#e9eaec]"
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* groups */}
        <div className="space-y-2 px-2 pt-2">
          {groups.map((g, gi) => (
            <div key={g.id} className="rounded-xl bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <input
                    value={g.name}
                    onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                    className="w-20 rounded bg-transparent text-[14px] font-semibold outline-none focus:bg-[#f4f5f7]"
                  />
                  <Edit3 className="h-3.5 w-3.5 text-[#07c160]" />
                  {gi === 0 && (
                    <label className="ml-2 flex items-center gap-1 text-[11px] text-[#646566]">
                      <input
                        type="checkbox"
                        checked={!!g.hasImage}
                        onChange={(e) => updateGroup(g.id, { hasImage: e.target.checked })}
                        className="h-3 w-3"
                      />
                      <ImgIcon className="h-3 w-3" /> 添加图片
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[#969799]">
                  <button className="flex items-center gap-0.5" onClick={() => toast.info("拖拽排序：即将上线")}>
                    <GripVertical className="h-3 w-3" /> 排序
                  </button>
                  <button className="flex items-center gap-0.5" onClick={() => removeGroup(g.id)}>
                    <Trash2 className="h-3 w-3" /> 删除
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.values.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-1 rounded bg-[#e8f7ee] px-2 py-1 text-[12px] text-[#07c160]"
                  >
                    <input
                      value={v.label}
                      placeholder="规格"
                      onChange={(e) => updateValue(g.id, v.id, e.target.value)}
                      className="w-20 bg-transparent outline-none"
                    />
                    <button onClick={() => removeValue(g.id, v.id)}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addValue(g.id)}
                  className="flex items-center gap-1 rounded border border-[#dcdee0] bg-white px-2 py-1 text-[12px] text-[#646566]"
                >
                  <Plus className="h-3 w-3" /> 添加具体规格
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* add new group */}
        {groups.length < MAX_SPEC_GROUPS && (
          <button
            onClick={addEmptyGroup}
            className="mx-2 mt-2 flex w-[calc(100%-1rem)] items-center justify-center gap-1 rounded-xl border border-[#07c160] bg-white py-3 text-[14px] text-[#07c160]"
          >
            <Plus className="h-4 w-4" /> 添加新规格
          </button>
        )}

        {/* detail variants table */}
        {variants.length > 0 && (
          <div className="mx-2 mt-3 rounded-xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[14px] font-semibold">详细规格</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-[11px] text-[#646566]">
                  <input
                    type="checkbox"
                    checked={showCode}
                    onChange={(e) => setShowCode(e.target.checked)}
                    className="h-3 w-3"
                  />
                  显示商品编码
                </label>
              </div>
            </div>

            {/* batch row */}
            <div className="mb-3 rounded-lg bg-[#f4f5f7] p-2 text-[11px] text-[#646566]">
              <div className="mb-1.5">批量设置</div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  value={batchPrice}
                  onChange={(e) => setBatchPrice(e.target.value)}
                  placeholder="价格"
                  className="rounded bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-1 focus:ring-[#07c160]"
                />
                <input
                  value={batchCost}
                  onChange={(e) => setBatchCost(e.target.value)}
                  placeholder="成本"
                  className="rounded bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-1 focus:ring-[#07c160]"
                />
                <input
                  value={batchStock}
                  onChange={(e) => setBatchStock(e.target.value)}
                  placeholder="库存"
                  className="rounded bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-1 focus:ring-[#07c160]"
                />
              </div>
              <button
                onClick={applyBatch}
                className="mt-1.5 rounded bg-[#07c160] px-3 py-1 text-[11px] font-medium text-white"
              >
                应用
              </button>
            </div>

            {/* header */}
            <div className="mb-1 grid grid-cols-[1.5fr_1fr_1fr_1fr_28px] gap-1 px-1 text-[10px] text-[#969799]">
              <span>组合</span>
              <span>
                价格<span className="text-[#fa5151]">*</span>
              </span>
              <span>成本价</span>
              <span>库存</span>
              <span></span>
            </div>
            <div className="space-y-2">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr_28px] gap-1 rounded-md bg-[#fafbfc] p-1.5"
                >
                  <div className="truncate self-center text-[11px] text-[#1a1a1a]">
                    {variantLabel(groups, v) || "—"}
                  </div>
                  <input
                    value={v.price}
                    onChange={(e) =>
                      setVariants(variants.map((x) => (x.id === v.id ? { ...x, price: e.target.value } : x)))
                    }
                    placeholder="请输入"
                    className="rounded bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-1 focus:ring-[#07c160]"
                  />
                  <input
                    value={v.costPrice ?? ""}
                    onChange={(e) =>
                      setVariants(
                        variants.map((x) => (x.id === v.id ? { ...x, costPrice: e.target.value } : x)),
                      )
                    }
                    placeholder="请输入"
                    className="rounded bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-1 focus:ring-[#07c160]"
                  />
                  <input
                    value={v.stock}
                    onChange={(e) =>
                      setVariants(variants.map((x) => (x.id === v.id ? { ...x, stock: e.target.value } : x)))
                    }
                    placeholder="不限"
                    className="rounded bg-white px-1.5 py-1 text-[12px] outline-none focus:ring-1 focus:ring-[#07c160]"
                  />
                  <button
                    onClick={() => toast.info("规格图：即将上线")}
                    className="grid h-7 w-7 place-items-center self-center rounded border border-dashed border-[#c8c9cc] text-[#c8c9cc]"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  {showCode && (
                    <input
                      value={v.code ?? ""}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x) => (x.id === v.id ? { ...x, code: e.target.value } : x)),
                        )
                      }
                      placeholder="商品编码"
                      className="col-span-5 rounded bg-white px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-[#07c160]"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
