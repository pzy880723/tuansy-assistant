import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Camera, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { SkuItem, SpecGroup, Variant } from "../types";
import { uploadProductImage } from "@/lib/projects.functions";
import {
  MAX_IMAGES,
  MAX_TAGS,
  PRESET_CATEGORIES,
  ensureProductShape,
  priceRange,
  syncSummaryFields,
  totalStock,
  validateProduct,
} from "./product-helpers";
import { MultiSpecSheet } from "./MultiSpecSheet";

/** "添加商品 / 编辑商品" page — full-screen overlay inside the phone shell. */
export function AddProductSheet({
  open,
  initial,
  projectId,
  onCancel,
  onSave,
}: {
  open: boolean;
  initial: SkuItem | null;
  projectId: string;
  onCancel: () => void;
  onSave: (p: SkuItem) => void;
}) {
  const [p, setP] = useState<SkuItem>(() =>
    ensureProductShape(
      initial ?? { name: "", price: "", stock: "", images: [], specGroups: [], variants: [] },
    ),
  );
  const [showSpec, setShowSpec] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const upload = useServerFn(uploadProductImage);

  if (!open) return null;

  const set = (patch: Partial<SkuItem>) => setP((cur) => ({ ...cur, ...patch }));

  const handleSubmit = () => {
    const err = validateProduct(p);
    if (err) {
      toast.error(err);
      return;
    }
    onSave(syncSummaryFields(p));
  };

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const cur = p.images ?? [];
    const remaining = MAX_IMAGES - cur.length;
    if (remaining <= 0) {
      toast.info(`最多 ${MAX_IMAGES} 张图片`);
      return;
    }
    try {
      const next = [...cur];
      for (const file of files.slice(0, remaining)) {
        const base64 = await fileToBase64(file);
        const res = await upload({
          data: { projectId, filename: file.name, mimeType: file.type, dataBase64: base64 },
        });
        next.push(res.url);
      }
      set({ images: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    }
  };

  const hasSpecs = (p.specGroups ?? []).length > 0;
  const summaryPrice = hasSpecs ? priceRange(p.variants ?? []) || "—" : "";
  const summaryStock = hasSpecs ? totalStock(p.variants ?? []) : "";
  const variantSummary = hasSpecs
    ? `${(p.specGroups ?? []).map((g) => `${g.name}${g.values.length}`).join(" · ")} = ${(p.variants ?? []).length} 个`
    : "";

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#f4f5f7]">
      {/* nav */}
      <div className="relative flex items-center justify-between border-b border-[#f0f1f2] bg-white px-3 py-2.5">
        <button onClick={onCancel} className="grid h-7 w-7 place-items-center rounded-full bg-black/5">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold">
          {initial ? "编辑商品" : "添加商品"}
        </div>
        <div className="h-7 w-12" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 商品名称 */}
        <Field label="商品名称" required hint={`${p.name.length}/120 (建议商品名称不超过28个字)`}>
          <input
            value={p.name}
            maxLength={120}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="请输入商品名称（商品标题组成：商品描述+规格）"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#c8c9cc]"
          />
        </Field>

        {/* 商品品类 */}
        <Row
          label="商品品类"
          required
          value={p.category || "请选择品类"}
          valueClass={p.category ? "text-[#1a1a1a]" : "text-[#c8c9cc]"}
          onClick={() => setShowCategory(true)}
        />

        {/* 商品图片 */}
        <Field
          label="商品图片"
          required
          hint={`${(p.images ?? []).length}/${MAX_IMAGES} (长按拖拽可调整顺序)`}
          rightAction={
            <button onClick={() => toast.info("图片装饰：即将上线")} className="text-[12px] text-[#07c160]">
              添加图片装饰
            </button>
          }
        >
          <div className="grid grid-cols-4 gap-2">
            {(p.images ?? []).map((url, i) => (
              <div key={url + i} className="relative aspect-square overflow-hidden rounded-md bg-[#f4f5f7]">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => set({ images: (p.images ?? []).filter((_, j) => j !== i) })}
                  className="absolute right-0 top-0 grid h-5 w-5 place-items-center rounded-bl-md bg-black/55 text-white"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                {i === 0 && (
                  <div className="absolute bottom-0 left-0 bg-[#07c160] px-1 text-[9px] text-white">主图</div>
                )}
              </div>
            ))}
            {(p.images ?? []).length < MAX_IMAGES && (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-md border border-dashed border-[#c8c9cc] bg-white text-[#c8c9cc]">
                <Camera className="h-5 w-5" />
                <span className="mt-1 text-[10px]">添加图片</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePickImage} />
              </label>
            )}
          </div>
        </Field>

        {/* 价格 */}
        {hasSpecs ? (
          <Row label="价格 (¥)" required value={summaryPrice} valueClass="text-[#fa5151] font-medium" />
        ) : (
          <Field label="价格 (¥)" required>
            <input
              value={p.price}
              onChange={(e) => set({ price: e.target.value })}
              inputMode="decimal"
              placeholder="请输入价格"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#fa9d3b]"
            />
          </Field>
        )}

        {/* 商品分类 */}
        <Row
          label="商品分类"
          value={p.group || "更多好货"}
          onClick={() => toast.info("自定义分类：即将上线")}
        />

        {/* 商品描述 */}
        <Field label="商品描述" hint={`${(p.description ?? "").length}/2000`}>
          <textarea
            value={p.description ?? ""}
            maxLength={2000}
            rows={2}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="请输入商品具体描述"
            className="w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-[#c8c9cc]"
          />
        </Field>

        {/* 商品视频 */}
        <Field label="商品视频" hint={`${p.videoUrl ? 1 : 0}/1`}>
          <button
            onClick={() => toast.info("视频上传：即将上线")}
            className="grid h-16 w-16 place-items-center rounded-md border border-dashed border-[#c8c9cc] text-[#c8c9cc]"
          >
            <Camera className="h-5 w-5" />
            <span className="mt-0.5 text-[10px]">添加视频</span>
          </button>
        </Field>

        {/* 规格 */}
        <Row
          label="规格"
          value={hasSpecs ? variantSummary : "请输入尺寸，颜色等"}
          valueClass={hasSpecs ? "text-[#1a1a1a]" : "text-[#c8c9cc]"}
          rightAction={
            <button
              onClick={() => setShowSpec(true)}
              className="text-[12px] text-[#07c160]"
            >
              {hasSpecs ? "编辑多规格" : "添加多规格"}
            </button>
          }
        />

        {/* 库存 */}
        {hasSpecs ? (
          <Row label="库存" value={summaryStock} />
        ) : (
          <Field label="库存">
            <input
              value={p.stock}
              onChange={(e) => set({ stock: e.target.value })}
              inputMode="numeric"
              placeholder="不限"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#c8c9cc]"
            />
          </Field>
        )}

        {/* 可购数量 */}
        <Row
          label="可购数量"
          value={p.purchaseLimit || "不限数量"}
          onClick={() => {
            const v = window.prompt("可购数量（输入「不限」或正整数）", p.purchaseLimit ?? "不限");
            if (v !== null) set({ purchaseLimit: v.trim() });
          }}
        />

        {/* 秒杀 */}
        <RowSwitch
          label="设置为秒杀商品"
          checked={!!p.isFlashSale}
          onChange={(b) => set({ isFlashSale: b })}
        />

        {/* 划线价 / 成本价 / 编码 */}
        <Field label="划线价 (¥)">
          <input
            value={p.strikePrice ?? ""}
            onChange={(e) => set({ strikePrice: e.target.value })}
            inputMode="decimal"
            placeholder="划线价建议高于商品价格"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#c8c9cc]"
          />
        </Field>
        <Field label="成本价 (¥)">
          <input
            value={p.costPrice ?? ""}
            onChange={(e) => set({ costPrice: e.target.value })}
            inputMode="decimal"
            placeholder="用于利润核算，仅团长可见"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#c8c9cc]"
          />
        </Field>
        <Field label="商品编码">
          <input
            value={p.code ?? ""}
            onChange={(e) => set({ code: e.target.value })}
            placeholder="用于供应链订单统计和追踪"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#c8c9cc]"
          />
        </Field>

        {/* 标签 */}
        <Row
          label="标签"
          value={(p.tags && p.tags.length > 0 ? p.tags.join("、") : "添加标签会有效提升购买")}
          valueClass={(p.tags && p.tags.length > 0) ? "text-[#1a1a1a]" : "text-[#c8c9cc]"}
          onClick={() => {
            const cur = (p.tags ?? []).join("、");
            const v = window.prompt(`标签（用"、"分隔，最多 ${MAX_TAGS} 个）`, cur);
            if (v !== null) {
              const arr = v
                .split(/[、,，]/)
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, MAX_TAGS);
              set({ tags: arr });
            }
          }}
        />

        <div className="h-4" />
      </div>

      {/* bottom action */}
      <div className="border-t border-[#f0f1f2] bg-white px-3 py-2.5">
        <button
          onClick={handleSubmit}
          className="w-full rounded-lg bg-[#07c160] py-3 text-[15px] font-medium text-white active:bg-[#06ad56]"
        >
          {initial ? "保存修改" : "确认添加"}
        </button>
      </div>

      {/* category picker */}
      {showCategory && (
        <div className="absolute inset-0 z-40 flex flex-col bg-black/40" onClick={() => setShowCategory(false)}>
          <div className="mt-auto rounded-t-2xl bg-white pb-3" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 text-center text-[15px] font-semibold">选择商品品类</div>
            <div className="grid grid-cols-4 gap-2 px-3 pb-3">
              {PRESET_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    set({ category: c });
                    setShowCategory(false);
                  }}
                  className={`rounded-md py-2.5 text-[13px] ${
                    p.category === c
                      ? "bg-[#07c160]/10 text-[#07c160]"
                      : "bg-[#f4f5f7] text-[#1a1a1a]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* multi-spec sheet */}
      <MultiSpecSheet
        open={showSpec}
        product={p}
        onCancel={() => setShowSpec(false)}
        onSave={(groups: SpecGroup[], variants?: Variant[]) => {
          set({ specGroups: groups, variants: variants ?? [] });
          setShowSpec(false);
        }}
      />
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  rightAction,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#f0f1f2] bg-white px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-[#1a1a1a]">
          {label}
          {required && <span className="ml-0.5 text-[#fa5151]">*</span>}
          {hint && <span className="ml-2 text-[11px] font-normal text-[#969799]">{hint}</span>}
        </div>
        {rightAction}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  required,
  value,
  valueClass,
  rightAction,
  onClick,
}: {
  label: string;
  required?: boolean;
  value: React.ReactNode;
  valueClass?: string;
  rightAction?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#f0f1f2] bg-white px-4 py-3.5">
      <div className="text-[13px] font-semibold text-[#1a1a1a]">
        {label}
        {required && <span className="ml-0.5 text-[#fa5151]">*</span>}
      </div>
      <div className="flex items-center gap-2">
        {onClick ? (
          <button onClick={onClick} className={`flex items-center text-[13px] ${valueClass ?? "text-[#969799]"}`}>
            {value}
            <ChevronRight className="ml-0.5 h-3.5 w-3.5 text-[#c8c9cc]" />
          </button>
        ) : (
          <span className={`text-[13px] ${valueClass ?? "text-[#969799]"}`}>{value}</span>
        )}
        {rightAction}
      </div>
    </div>
  );
}

function RowSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#f0f1f2] bg-white px-4 py-3.5">
      <div className="text-[13px] font-semibold text-[#1a1a1a]">{label}</div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#07c160]" : "bg-[#e5e6e8]"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(",")[1] ?? s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
