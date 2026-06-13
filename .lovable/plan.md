明白了，分两层来想：

- **预览/编辑界面** → 保持你第一次发的那种**手机版"添加商品"页**（在 `PhoneShell` 里全屏覆盖），团长在 Lovable 里看到的、改的都是手机样式。
- **数据模型** → 字段必须能 1:1 映射到**快团团 PC 后台**的"发布团购"弹窗，让 Chrome 插件直接把保存好的内容回填到 `ktt.pinduoduo.com/groups/create` 那个表单上。

所以本轮**只做手机版的编辑 UI + 完整数据模型**。插件填表是后续任务（需要时再写 content script）。

## 手机版"添加商品"页（在 PhoneShell 内全屏覆盖）

按你第一组截图复刻（顶部"添加商品"白色 nav bar，左返回 + 右胶囊；底部固定绿色"确认添加"），字段从上到下：

1. `商品名称 *` — 0/120 字数显示 + 建议 ≤28 字提示
2. `商品品类 *` — 行式选择，点击进入二级 picker（女装/男装/食品/美妆/母婴/家居/数码/其他）
3. `商品图片 *` — 9 宫格上传，第一张为主图，可拖拽排序；右上角"添加图片装饰"占位
4. `价格 (¥) *` — 无规格时必填；有规格时显示价格区间，不可手填
5. `商品分类` — "更多好货"等自定义分组
6. `商品描述` — 0/2000 textarea
7. `商品视频` — 0/1
8. `规格` — 默认行 "请输入尺寸，颜色等"，右侧绿字"添加多规格" → 进入下一页（多规格设置）
9. `库存` — 无规格时单字段"不限"；有规格时显示合计
10. `可购数量` — 不限 / 每人 N 件
11. `设置为秒杀商品` — 开关
12. `划线价 (¥)` / `成本价 (¥)` / `商品编码` / `标签`

校验：缺必填 → 底部按钮置灰 + toast 提示第一个缺失项。

## 多规格设置页（同样在 PhoneShell 内全屏覆盖）

按你第三、四张截图：
- 顶部"多规格设置教程"提示条 + 右"点击查看"
- **选择常用规格类型**：chips（尺码/重量/口味/鞋码/颜色/型号），点击=添加一个该名规格组
- **规格组卡片**（每个一块白底圆角）：
  - 组名（颜色/尺码…）+ 笔图标改名 + "添加图片"复选（仅第一组）+ 排序 + 删除
  - chip 列出每个具体规格值（黑色白标 ×），末尾 `+ 添加具体规格`
- 底部"+ 添加新规格"按钮（最多 3 组，避免笛卡尔积爆炸）
- **详细规格**段（截图 4）：
  - 顶部"批量设置"链接 + "显示商品编码"开关
  - 表头：价格* / 成本价 / 库存 / 图片
  - 一行 = 一个 SKU，行首组合名"黑色白标/M（80-100斤）"
  - "请输入"灰占位、库存"不限"
- 底部固定绿色"完成"按钮回填到上一页"规格"行

## 数据模型（PC 后台字段映射 — 关键）

放在 `src/components/tuan/types.ts`，命名直接对齐 PC 表单：

```ts
type SpecGroup = {
  id: string;
  name: string;                  // → PC "商品规格" 组名下拉
  hasImage?: boolean;            // → PC "添加图片（仅第一组）"复选
  values: { id: string; label: string; image?: string | null }[];
};

type Sku = {
  id: string;
  optionValueIds: string[];      // 与 specGroups 同序
  code?: string;                 // → PC "商品编码"
  price: string;                 // → PC "团购价(元)" *
  costPrice?: string;            // → PC "成本价(元)"
  stock: string;                 // "" = 不限 → PC "库存"
  image?: string | null;         // → PC "图片"
};

type ProductItem = {
  id: string;
  name: string;                  // → PC *商品名称
  category?: string;             // → PC *商品品类
  description?: string;          // → PC 商品描述
  images: string[];              // → PC *商品图片
  videoUrl?: string | null;      // → PC 商品视频
  tags?: string[];               // → PC 商品标签（最多 2）
  totalWeightKg?: string;        // → PC 总重量(kg)
  strikePrice?: string;          // → 划线价
  purchaseLimit?: string;        // → 可购数量
  isFlashSale?: boolean;         // → 秒杀
  group?: string;                // → 商品分类（更多好货）
  specGroups: SpecGroup[];       // → PC 商品规格
  skus: Sku[];                   // → PC 详细规格表
};
```

后续给插件用的"导出格式"在 `src/lib/projects.functions.ts` 里再加一个 `toKttPayload(item: ProductItem)` 函数，把字段重命名成 PC 后台 DOM 选择器需要的形状（这一步本轮**不做**，等接入插件时一起做）。

## 文件改动

新增（`src/components/tuan/product/`）：
- `AddProductSheet.tsx` — 手机版"添加商品"页（PhoneShell 内全屏覆盖）
- `MultiSpecSheet.tsx` — 手机版"多规格设置"页
- `CategoryPicker.tsx` — 品类二级 picker
- `TagPicker.tsx` — 标签多选
- `product-helpers.ts` — 笛卡尔积 / 价格区间 / 库存合计 / 校验 / `migrateSku`

修改：
- `src/components/tuan/types.ts` — 加上述类型，旧 `SkuItem` 保留 + adapter
- `src/components/tuan/ProductTab.tsx` — 列表卡片用新结构展示（主图 / 名 / 价格区间 / 总库存 / SKU 数 / 规格摘要），点"添加 / 编辑"打开 `AddProductSheet`
- `src/lib/projects.functions.ts` — 落库切到新 shape，读时兼容旧 shape

## 不做的事（本轮）

- Chrome 插件的"自动填表"脚本（等这边数据稳定再做）
- "添加图片装饰"、"管理常用规格类型"、"新增标签"二级管理页 → toast 占位
- 不动 `SettingsTab`

## 请你确认

1. **规格组最多 3 组**（颜色 × 尺码 × 重量）OK 吗？快团团没强限制，但更多会让 SKU 表爆炸。
2. **品类列表**先内置 8 个固定项（女装/男装/食品/美妆/母婴/家居/数码/其他），后续做自定义管理，OK？
3. **库存空 = "不限"** OK 吗？还是默认填 0？
