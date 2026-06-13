import type { SkuItem, SpecGroup, SpecValue, Variant } from "../types";

export const PRESET_SPEC_TYPES = ["尺码", "重量", "口味", "鞋码", "颜色", "型号"] as const;
export const PRESET_CATEGORIES = [
  "女装",
  "男装",
  "食品",
  "美妆",
  "母婴",
  "家居",
  "数码",
  "其他",
] as const;
export const MAX_SPEC_GROUPS = 3;
export const MAX_IMAGES = 9;
export const MAX_TAGS = 2;

let _id = 0;
export function uid(prefix = "id"): string {
  _id += 1;
  return `${prefix}_${Date.now().toString(36)}_${_id}`;
}

export function makeSpecGroup(name: string, hasImage = false): SpecGroup {
  return { id: uid("sg"), name, hasImage, values: [] };
}

export function makeSpecValue(label = ""): SpecValue {
  return { id: uid("sv"), label };
}

export function makeVariant(optionValueIds: string[]): Variant {
  return { id: uid("vr"), optionValueIds, price: "", stock: "" };
}

/** Cartesian product of value IDs across spec groups (in order). */
export function cartesianValueIds(groups: SpecGroup[]): string[][] {
  if (groups.length === 0) return [];
  const usable = groups.filter((g) => g.values.length > 0);
  if (usable.length === 0) return [];
  let acc: string[][] = [[]];
  for (const g of usable) {
    const next: string[][] = [];
    for (const a of acc) {
      for (const v of g.values) next.push([...a, v.id]);
    }
    acc = next;
  }
  return acc;
}

/**
 * Reconcile variants against the current spec groups. Preserves prior
 * price/stock/image/code for combinations that still exist, drops the rest,
 * and creates blanks for new combinations.
 */
export function reconcileVariants(groups: SpecGroup[], prior: Variant[]): Variant[] {
  const combos = cartesianValueIds(groups);
  if (combos.length === 0) return [];
  const key = (ids: string[]) => ids.join("|");
  const priorMap = new Map(prior.map((v) => [key(v.optionValueIds), v]));
  return combos.map((ids) => {
    const found = priorMap.get(key(ids));
    if (found) return { ...found, optionValueIds: ids };
    return makeVariant(ids);
  });
}

export function variantLabel(groups: SpecGroup[], variant: Variant): string {
  const parts: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const valId = variant.optionValueIds[i];
    const v = groups[i].values.find((x) => x.id === valId);
    if (v) parts.push(v.label || "—");
  }
  return parts.join("/");
}

export function priceRange(variants: Variant[]): string {
  const prices = variants
    .map((v) => parseFloat(v.price))
    .filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return "";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `¥${min}` : `¥${min}-${max}`;
}

export function totalStock(variants: Variant[]): string {
  if (variants.some((v) => v.stock.trim() === "")) return "不限";
  const sum = variants.reduce((s, v) => s + (parseInt(v.stock, 10) || 0), 0);
  return String(sum);
}

/** Returns the first missing required field message, or null when valid. */
export function validateProduct(p: SkuItem): string | null {
  if (!p.name.trim()) return "请填写商品名称";
  if (!p.category) return "请选择商品品类";
  if (!(p.images && p.images.length > 0) && !p.image) return "请上传商品图片";
  const groups = p.specGroups ?? [];
  const variants = p.variants ?? [];
  if (groups.length > 0) {
    if (groups.some((g) => g.values.length === 0)) return "请为每个规格添加至少一个具体规格";
    if (variants.some((v) => !v.price.trim())) return "请为每个规格组合填写团购价";
  } else if (!p.price.trim()) {
    return "请填写价格";
  }
  return null;
}

/** Adapt a legacy single-SKU item so the editor always has the new shape. */
export function ensureProductShape(p: SkuItem): SkuItem {
  return {
    ...p,
    images: p.images && p.images.length > 0 ? p.images : p.image ? [p.image] : [],
    specGroups: p.specGroups ?? [],
    variants: p.variants ?? [],
  };
}

/** Recompute summary fields (price/stock/image) for legacy display compat. */
export function syncSummaryFields(p: SkuItem): SkuItem {
  const groups = p.specGroups ?? [];
  const variants = p.variants ?? [];
  const next: SkuItem = { ...p };
  next.image = p.images?.[0] ?? p.image ?? null;
  if (groups.length > 0 && variants.length > 0) {
    next.price = priceRange(variants).replace(/^¥/, "") || p.price;
    next.stock = totalStock(variants);
    const specSummary = `${groups.map((g) => `${g.name}${g.values.length}`).join(" · ")} = ${variants.length} 个`;
    next.spec = specSummary;
  } else {
    next.spec = p.spec ?? "";
  }
  return next;
}
