# 让团宝真正会编辑商品

## 问题诊断（已读完代码）

**1. 编辑器和团宝写的字段对不上 → 「点编辑里面是空的」**
- 编辑器 (`AddProductSheet.tsx`) 读这些字段：`name, category, images[], description, specGroups[], variants[], price, stock, strikePrice, costPrice, code, tags, purchaseLimit, isFlashSale, videoUrl`
- 团宝的 `update_skus` 工具 schema (`src/routes/api/chat.ts` 第 19-26 行) 只有：`name, price, stock, original_price, image, desc`
- 所以团宝写出来的 SKU 进了编辑器后，品类/主图/多张图/描述/规格/标签 全是空，验证还过不了（编辑器要求 `category` 和 `images`）。

**2. 团宝不会建多规格**
- 团购宝传 SKU 数组 = 把"颜色×尺码"扁平塞 N 条 SKU，没有 `specGroups + variants`。所以用户说"3 个颜色 × 2 个尺码"，团宝没法表达成右侧编辑器原生的多规格结构。

**3. 团宝不会"按表设库存"**
- 没有针对单一变体改库存或批量改库存的工具；也没有处理用户贴库存表（图片/文字/CSV）→ 映射到对应变体的能力。

**4. system prompt 没教团宝任何商品编辑规则**
- prompt 里关于 SKU 只有一句"改 SKU → update_skus，传完整数组"，没说品类、多规格、库存表等。

---

## 修复方案

### A. 把 `SkuSchema` 升级成和编辑器一致的完整 schema
位置：`src/routes/api/chat.ts`

```ts
// 新 schema — 字段名和 SkuItem 完全对齐
SpecValueSchema = { id?, label, image? }
SpecGroupSchema = { id?, name, hasImage?, values: SpecValue[] }
VariantSchema   = { id?, optionValueIds: string[], price, stock, costPrice?, image?, code? }
SkuSchema       = {
  name, category?, description?, images?[], videoUrl?,
  tags?[], price?, stock?, strikePrice?, costPrice?, code?,
  purchaseLimit?, isFlashSale?, group?,
  specGroups?: SpecGroup[], variants?: Variant[],
}
```
服务端 `update_skus` 写库前调一次 `syncSummaryFields` 等价的兜底（补 `image`/`spec`/`price` 汇总字段），让历史列表卡片照常显示。

### B. 新增 3 个聪明的 SKU 工具

1. **`update_sku_at`** — 局部 patch 单个商品（按 index 或 name 定位）。team 改一个字段不用把整张 SKU 数组重写。
2. **`set_variants`** — 一步建多规格：传 `productIndex + specGroups[]`，服务端自动 `cartesianValueIds + reconcileVariants` 生成所有变体；可同时给一个默认价。
3. **`set_variant_stocks`** — 按规格组合批量设库存：入参 `productIndex + entries: [{ match: {颜色:"黑",尺码:"M"}, stock:"50" }, ...]`，服务端按 label 反查 `optionValueIds`，更新对应 variant.stock；找不到的条目返回告警让团宝告诉用户。

### C. 让团宝能读"库存表"
用户在聊天里贴一张库存表图片或一段文本，团宝按现有 system prompt 已经能 OCR / 解析，新增一段规则要求它解析后调用 `set_variant_stocks`；同时教它若规格还没建，先调 `set_variants`，再调 `set_variant_stocks`。

### D. 把 `intro.blocks` 里产品引用的 system prompt 重写
新增一段【商品编辑工作流】明确：

- 用户说"商品叫 XXX" → `update_sku_at` 改 `name`（或新建第 0 个商品并设 `name`、`category` 留空时主动 `ask_questions` 问品类）
- 用户说"规格按颜色：黑/白/灰，尺码：M/L" → 一次 `set_variants`，然后回一句"建好 3×2 共 6 个变体，价格和库存呢？"
- 用户说"库存黑M 30 件、白L 50 件…" 或贴表格 → `set_variant_stocks`
- 没图片/品类时主动 `ask_questions`（品类 4 选 1：女装/食品/美妆/母婴/其他）
- 价格、库存、变体规则同步到右侧编辑器后回一句"我把 X 改成 Y 了，去商品 Tab 看看"

### E. 把 `update_product_meta` 工具说明里"不要改 SKU"那段保留，避免团宝串。

---

## 改动文件清单

- `src/routes/api/chat.ts`
  - 重写 `SkuSchema`，新增 `SpecGroupSchema/VariantSchema`
  - 升级 `update_skus.execute`：写库前补 summary
  - 新增 3 个工具：`update_sku_at`、`set_variants`、`set_variant_stocks`
  - system prompt 追加【商品编辑工作流】与库存表处理规则
- 无前端改动；编辑器已经支持所有目标字段

## 不在本次范围
- 商品视频上传（编辑器目前 toast.info「即将上线」）
- 商品分类自定义（同上）
- 图片装饰

确认后我直接落地。