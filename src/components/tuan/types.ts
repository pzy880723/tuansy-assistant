export type IntroBlock =
  | { id: string; type: "text"; text: string; locked?: boolean }
  | { id: string; type: "image_lg"; url?: string | null; locked?: boolean }
  | { id: string; type: "image_sm"; urls: string[]; locked?: boolean }
  | { id: string; type: "video"; url?: string | null; locked?: boolean };

export type IntroData = {
  title?: string;
  description?: string;
  blocks?: IntroBlock[];
  cover_url?: string | null;
  leader_name?: string;
  leader_avatar?: string | null;
  leader_bg_url?: string | null;
};

/** Stable human-readable label for a block, e.g. 段落2 / 大图1 / 九宫格1 / 视频1. */
export function blockLabel(blocks: IntroBlock[], idx: number): string {
  const b = blocks[idx];
  if (!b) return `#${idx + 1}`;
  const name =
    b.type === "text"
      ? "段落"
      : b.type === "image_lg"
        ? "大图"
        : b.type === "image_sm"
          ? "九宫格"
          : "视频";
  let n = 0;
  for (let i = 0; i <= idx; i++) if (blocks[i]?.type === b.type) n++;
  return `${name}${n}`;
}

export function blockShortId(id: string): string {
  return id.slice(0, 8);
}

export function blockMentionToken(blocks: IntroBlock[], idx: number): string {
  const b = blocks[idx];
  if (!b) return "";
  return `@[${blockLabel(blocks, idx)}#${blockShortId(b.id)}]`;
}

export function blockPreview(b: IntroBlock): string {
  if (b.type === "text") return b.text.replace(/\s+/g, " ").slice(0, 28);
  if (b.type === "image_lg") return b.url ? "大图（已上传）" : "大图（未上传）";
  if (b.type === "image_sm") return `九宫格 · ${b.urls.length} 张`;
  return b.url ? "视频（已上传）" : "视频（未上传）";
}

// ---------- Product / SKU ----------

/** One value inside a spec group (e.g. "黑色白标", "M（80-100斤）"). */
export type SpecValue = {
  id: string;
  label: string;
  /** Only honored when the parent SpecGroup.hasImage is true (first group). */
  image?: string | null;
};

/** A spec dimension (颜色 / 尺码 / 重量 ...). */
export type SpecGroup = {
  id: string;
  name: string;
  /** Only the first group may attach images to its values. */
  hasImage?: boolean;
  values: SpecValue[];
};

/** A concrete variant row (cartesian product of all SpecGroup values). */
export type Variant = {
  id: string;
  /** Same length and order as ProductItem.specGroups; each entry references a SpecValue.id. */
  optionValueIds: string[];
  /** 团购价（必填） */
  price: string;
  /** 成本价 */
  costPrice?: string;
  /** 库存；空串 = 不限 */
  stock: string;
  image?: string | null;
  /** 商品编码 */
  code?: string;
};

/**
 * A product. Legacy single-SKU fields (name/price/stock/image/spec) are kept so
 * existing list cards keep working. New fields are optional; presence of
 * `specGroups.length > 0` switches the editor into multi-spec mode.
 */
export type SkuItem = {
  // legacy / always-present
  name: string;
  price: string;
  stock: string;
  image?: string | null;
  spec?: string;

  // extended product fields
  category?: string;
  description?: string;
  images?: string[];
  videoUrl?: string | null;
  tags?: string[];
  totalWeightKg?: string;
  strikePrice?: string;
  costPrice?: string;
  code?: string;
  purchaseLimit?: string;
  isFlashSale?: boolean;
  group?: string;
  showVariantCode?: boolean;

  specGroups?: SpecGroup[];
  variants?: Variant[];
};

export type SettingsData = Record<string, string | boolean>;

export const SETTING_DEFAULTS: SettingsData = {
  // 团购设置
  delivery_method: "快递",
  shipping_time: "未选择发货时间",
  group_period: "发团即开始，7天后结束",
  notify_targets: "全部订阅成员",
  // 帮卖
  resell_copy: "去设置",
  resell_share: "去设置",
  resell_assets: "用于分享社群及朋友圈",
  resell_leaderboard: "激励团长帮卖",
  // 优惠
  first_order_discount: "首单专享 提高转化",
  full_reduce: "激励凑单 提高销量",
  multi_discount: "刺激多买 提升单量",
  surprise_redpack: "批量发券 引导购买",
  // 营销
  free_share: "增加吸引力 促进复购",
  group_buy: "发起拼团 高效裂变",
  lottery: "促进活跃 高效营销",
  tiered_price: "拉新效果提升75%",
  gifts: "提升下单欲望",
  // 隐私
  forward_setting: "所有人均可转发",
  follower_display: "只显示匿名头像",
  admin: "未设置",
  // 其他
  allow_coupon: "允许",
  min_order: "未设置",
  show_stock: "小于等于20件允许展示",
  allow_user_copy: "不允许",
  recommend: "未选择",
  allow_copy_code: "不允许",
  category: "未分类",
  follow_tip: "",
};
