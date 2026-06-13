import { useMemo, useState } from "react";
import { Edit3, Plus, Trash2, Image as ImgIcon, GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import type { SkuItem, SpecGroup, Variant } from "../types";
import {
  MAX_SPEC_GROUPS,
  PRESET_SPEC_TYPES,
  cartesianValueIds,
  makeSpecGroup,
  makeSpecValue,
  reconcileVariants,
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
  const [variants, setVariants] = useState<Variant[]>(product.variants ?? []);
  const [showCode, setShowCode] = useState(!!product.showVariantCode);
  const [batchOpen, setBatchOpen] = useState(false);

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

  const headerName = groups.map((g) => g.name).join("/") || "规格";

  const handleDone = () => {
    const ids = cartesianValueIds(groups);
    if (groups.length > 0 && ids.length === 0) {
      toast.error("请为每个规格添加至少一个具体规格");
      return;
    }
    onSave(groups, variants);
  };

  const applyBatch = (
    selected: Record<string, Set<string>>,
    payload: { price?: string; costPrice?: string; stock?: string; stockUnlimited?: boolean },
  ) => {
    setVariants(
      variants.map((v) => {
        const matches = groups.every((g, i) => {
          const set = selected[g.id];
          return set && set.has(v.optionValueIds[i]);
        });
        if (!matches) return v;
        return {
          ...v,
          price: payload.price !== undefined && payload.price !== "" ? payload.price : v.price,
          costPrice:
            payload.costPrice !== undefined && payload.costPrice !== ""
              ? payload.costPrice
              : v.costPrice,
          stock: payload.stockUnlimited
            ? ""
            : payload.stock !== undefined && payload.stock !== ""
              ? payload.stock
              : v.stock,
        };
      }),
    );
    setBatchOpen(false);
    toast.success("已批量设置");
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

        {/* detail variants */}
        {variants.length > 0 && (
          <div className="mx-2 mt-3 rounded-xl bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[15px] font-semibold">详细规格</div>
              <button
                onClick={() => setBatchOpen(true)}
                className="text-[13px] font-medium text-[#07c160]"
              >
                批量设置
              </button>
            </div>
            <div className="mb-3 flex items-center justify-between border-b border-[#f0f1f2] pb-2.5">
              <div className="text-[13px] text-[#1a1a1a]">{headerName}</div>
              <label className="flex items-center gap-1.5 text-[12px] text-[#646566]">
                <input
                  type="radio"
                  checked={showCode}
                  onClick={() => setShowCode(!showCode)}
                  onChange={() => {}}
                  className="h-3 w-3 accent-[#07c160]"
                />
                显示商品编码
              </label>
            </div>

            {/* column headers */}
            <div className="mb-2 grid grid-cols-[1fr_1fr_1fr_56px] gap-2 px-0.5 text-[11px] text-[#969799]">
              <span>
                价格<span className="text-[#fa5151]">*</span>
              </span>
              <span>成本价</span>
              <span>库存</span>
              <span>图片</span>
            </div>

            <div className="space-y-3">
              {variants.map((v) => (
                <div key={v.id}>
                  <div className="mb-1.5 text-[13px] font-medium text-[#1a1a1a]">
                    {groups
                      .map(
                        (g, i) =>
                          g.values.find((x) => x.id === v.optionValueIds[i])?.label || "—",
                      )
                      .join("/")}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1fr_56px] gap-2">
                    <input
                      value={v.price}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x) => (x.id === v.id ? { ...x, price: e.target.value } : x)),
                        )
                      }
                      placeholder="请输入"
                      className="h-9 rounded-md border border-[#ebedf0] bg-white px-2 text-[13px] outline-none focus:border-[#07c160]"
                    />
                    <input
                      value={v.costPrice ?? ""}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x) =>
                            x.id === v.id ? { ...x, costPrice: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder="请输入"
                      className="h-9 rounded-md border border-[#ebedf0] bg-white px-2 text-[13px] outline-none focus:border-[#07c160]"
                    />
                    <input
                      value={v.stock}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x) => (x.id === v.id ? { ...x, stock: e.target.value } : x)),
                        )
                      }
                      placeholder="不限"
                      className="h-9 rounded-md border border-[#ebedf0] bg-white px-2 text-[13px] outline-none focus:border-[#07c160]"
                    />
                    <button
                      onClick={() => toast.info("规格图：即将上线")}
                      className="grid h-9 w-14 place-items-center rounded-md border border-dashed border-[#c8c9cc] text-[#c8c9cc]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {showCode && (
                    <input
                      value={v.code ?? ""}
                      onChange={(e) =>
                        setVariants(
                          variants.map((x) => (x.id === v.id ? { ...x, code: e.target.value } : x)),
                        )
                      }
                      placeholder="商品编码"
                      className="mt-1.5 h-8 w-full rounded-md border border-[#ebedf0] bg-white px-2 text-[12px] outline-none focus:border-[#07c160]"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {batchOpen && (
        <BatchSettingSheet
          groups={groups}
          onClose={() => setBatchOpen(false)}
          onApply={applyBatch}
        />
      )}
    </div>
  );
}

function BatchSettingSheet({
  groups,
  onClose,
  onApply,
}: {
  groups: SpecGroup[];
  onClose: () => void;
  onApply: (
    selected: Record<string, Set<string>>,
    payload: { price?: string; costPrice?: string; stock?: string; stockUnlimited?: boolean },
  ) => void;
}) {
  const [selected, setSelected] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const g of groups) init[g.id] = new Set();
    return init;
  });
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unlimited, setUnlimited] = useState(false);

  const toggle = (gid: string, vid: string) => {
    setSelected((prev) => {
      const set = new Set(prev[gid]);
      if (set.has(vid)) set.delete(vid);
      else set.add(vid);
      return { ...prev, [gid]: set };
    });
  };
  const toggleAll = (gid: string) => {
    const g = groups.find((x) => x.id === gid);
    if (!g) return;
    setSelected((prev) => {
      const set = prev[gid];
      const all = g.values.length > 0 && set.size === g.values.length;
      const next = new Set<string>();
      if (!all) g.values.forEach((v) => next.add(v.id));
      return { ...prev, [gid]: next };
    });
  };

  const allSelected = useMemo(() => {
    const r: Record<string, boolean> = {};
    for (const g of groups) {
      r[g.id] = g.values.length > 0 && selected[g.id]?.size === g.values.length;
    }
    return r;
  }, [groups, selected]);

  const handleConfirm = () => {
    for (const g of groups) {
      if (!selected[g.id] || selected[g.id].size === 0) {
        toast.error(`请选择「${g.name}」`);
        return;
      }
    }
    if (!price && !costPrice && !stock && !unlimited) {
      toast.error("请填写要批量设置的值");
      return;
    }
    onApply(selected, { price, costPrice, stock, stockUnlimited: unlimited });
  };

  const chipCls = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-[12px] transition ${
      active
        ? "border border-[#07c160] bg-[#e8f7ee] text-[#07c160]"
        : "border border-transparent bg-[#f4f5f7] text-[#1a1a1a]"
    }`;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85%] flex-col rounded-t-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f0f1f2] px-4 py-3">
          <div className="text-[15px] font-semibold">批量设置</div>
          <button onClick={onClose}>
            <X className="h-4 w-4 text-[#969799]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-2 text-[14px] font-semibold">
            选择规格 <span className="text-[12px] font-normal text-[#969799]">(可多选)</span>
          </div>
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="flex gap-3">
                <div className="w-10 shrink-0 pt-1.5 text-[13px] text-[#646566]">{g.name}</div>
                <div className="flex flex-1 flex-wrap gap-2">
                  <button
                    onClick={() => toggleAll(g.id)}
                    className={chipCls(allSelected[g.id])}
                  >
                    全部
                  </button>
                  {g.values.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => toggle(g.id, v.id)}
                      className={chipCls(selected[g.id]?.has(v.id) ?? false)}
                    >
                      {v.label || "—"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-3 mt-5 border-t border-[#f0f1f2]" />
          <div className="mb-3 text-[14px] font-semibold">对已选规格批量设置</div>
          <div className="space-y-3">
            <Row label="价格">
              <div className="flex flex-1 items-center rounded-md border border-[#ebedf0] px-2">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="请输入价格"
                  className="h-9 flex-1 bg-transparent text-[13px] outline-none"
                />
                <span className="text-[12px] text-[#969799]">元</span>
              </div>
            </Row>
            <Row label="成本价">
              <div className="flex flex-1 items-center rounded-md border border-[#ebedf0] px-2">
                <input
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="请输入成本价"
                  className="h-9 flex-1 bg-transparent text-[13px] outline-none"
                />
                <span className="text-[12px] text-[#969799]">元</span>
              </div>
            </Row>
            <Row label="库存">
              <input
                value={unlimited ? "" : stock}
                disabled={unlimited}
                onChange={(e) => setStock(e.target.value)}
                placeholder="请输入库存"
                className="h-9 flex-1 rounded-md border border-[#ebedf0] bg-white px-2 text-[13px] outline-none focus:border-[#07c160] disabled:bg-[#f7f8fa]"
              />
              <label className="ml-2 flex shrink-0 items-center gap-1 text-[12px] text-[#646566]">
                <input
                  type="radio"
                  checked={unlimited}
                  onClick={() => setUnlimited(!unlimited)}
                  onChange={() => {}}
                  className="h-3 w-3 accent-[#07c160]"
                />
                不限
              </label>
            </Row>
            <Row label="图片">
              <button
                onClick={() => toast.info("规格图：即将上线")}
                className="grid h-12 w-12 place-items-center rounded-md border border-dashed border-[#c8c9cc] text-[#c8c9cc]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </Row>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          className="m-0 h-12 w-full bg-[#07c160] text-[15px] font-medium text-white active:bg-[#06ad56]"
        >
          确定
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <div className="w-12 shrink-0 text-[13px] text-[#646566]">{label}</div>
      {children}
    </div>
  );
}
