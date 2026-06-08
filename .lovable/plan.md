# 团宝助手 MVP 实施计划（按快团团字段对齐）

聚焦 Web 端（手机端优化），后续用 Capacitor 包装成 App。技术栈复用模板：TanStack Start + React + Tailwind v4 + shadcn/ui + Lovable Cloud + Lovable AI Gateway（Gemini 3 Flash）。

---

## 一、数据模型（Lovable Cloud / Postgres）

按快团团两张表单字段 1:1 建模：

```
projects
├─ id, name, status, cover_image_url
├─ intro: jsonb       -- 团购介绍页 (活动标题 + 内容块序列 + 物流 + 时间)
├─ product: jsonb     -- 创建商品弹窗 (基础信息 + 规格组)
├─ skus: jsonb        -- 笛卡尔积展开的 SKU 矩阵
└─ created_at, updated_at

project_images   (id, project_id, url, sort, analysis jsonb, role)
shipping_templates (id, name, config jsonb)
copy_versions    (id, project_id, snapshot jsonb, created_at)
```

`intro.blocks` 是有序数组，每项 `{type: 'big_image'|'small_image'|'video'|'text'|'tag'|'service', payload: {...}}` —— 与快团内容块一一对应。

MVP 无登录，RLS 允许 anon 读写（生产前再加登录）。Storage public bucket `product-images`。

---

## 二、路由

```
src/routes/
  index.tsx                 项目列表（卡片网格）
  project.$id.tsx           编辑页（三 Tab）
  project.$id.sync.tsx      同步导出页
  extension.tsx             Chrome 插件下载 + 安装说明
  api/public/project.$id.ts 插件读取项目 JSON 的公共接口
```

---

## 三、编辑页三 Tab（对齐快团结构）

### Tab 1 · 团购介绍
- **活动标题**输入（≤120 字，AI 生成按钮）
- **内容块编辑器**：左侧块列表（拖拽排序、上下移动、删除），右侧实时预览
  - 块类型按钮：大图 / 小图 / 视频 / 文字 / 标签 / 服务承诺
  - AI 生成会输出一个"块序列"（大图 → 总结文字 → 大图 → 卖点1 文字 → … → 尺码表文字），用户可微调

### Tab 2 · 团购商品
- **基本信息**：商品名称、品类（三级选择器，先用文本）、商品描述、商品图片（≤9 张，建议 750×750）、商品视频 URL、商品标签（≤2）、总重量
- **规格组**：可添加多组（如 尺码 [S/M/L] + 口味 [不辣/微辣/中辣/重辣]）
- **SKU 矩阵**：自动笛卡尔积，每行 编码 / 团购价 / 成本价 / 库存 / SKU 图
- **批量设置**绿色按钮：选规格 → 批量填价/库存
- **划线价**

### Tab 3 · 团购设置
- 物流方式：快递（首件/续件/偏远/满包邮）、同城配送、顾客自提（各自展开子项）
- 运费模板可保存复用（shipping_templates）
- 团购时间区间（开始/结束）
- 开团通知推送

---

## 四、核心 AI 能力（Server Functions）

`src/lib/*.functions.ts`，调用 Lovable AI Gateway，模型 `google/gemini-3-flash-preview`，结构化输出用 zod。

1. **`analyzeImages`** —— 输入多张图片 URL → Vision 返回主色/材质/风格/对象/质量分
2. **`smartFill`** —— 输入图片 + 用户的一段文字描述（产品笔记）→ 一次性回填：
   - 商品名/品类/描述/标签/重量
   - 推断规格组（颜色、尺码）→ 自动生成 SKU 矩阵
   - 主图选择
3. **`generateIntroBlocks`** —— 输入完整商品 → 生成内容块序列：
   - 标题、总结段、品牌故事、4-5 个核心卖点段、各颜色描述段、尺码表段、关键词标签
   - 输出已是块数组，可直接落到 `intro.blocks`
4. **`supplementImages`** —— 已有图风格 + 商品信息 → AI 补图（图片生成 API），返回候选给用户选

每个段落都有"重新生成此段"按钮，独立调用。

---

## 五、同步导出页

三种导出方式并列：

1. **一键复制全部文案** —— 把 `intro.blocks` 中所有 `text` 块按顺序合并，复制到剪贴板（手机端关键）
2. **下载图片包** —— 所有图按顺序打包 zip（含 SKU 图）
3. **Chrome 插件填充** —— 显示插件下载链接 + 项目 ID，用户在快团团页面打开插件粘贴 ID 自动填充

页面顶部显示**同步预览清单**（标题✓ 描述✓ 图片✓×9 SKU✓×12 运费✓ 时间✓）。

---

## 六、Chrome 插件骨架（MV3）

目录 `extension/`，nix zip 打包到 `public/tuanbao-extension.zip`。
- `manifest.json`（host_permissions: 快团团域名）
- `popup.html` —— 输入"Web 应用地址 + 项目 ID"，拉取 `/api/public/project/:id`
- `content-script.js` —— 注入快团团页面，按 selector 占位顺序填充：
  - 活动标题 → 内容块循环 add+fill → 商品弹窗（基础信息 → 规格组 → SKU 矩阵批量设置）→ 团购设置（物流/时间）
- 真实 selector 留 TODO，附"如何抓取 selector"指引页

---

## 七、设计（电商活力橙）

`src/styles.css`：
```css
@theme {
  --color-brand: #f97316;
  --color-brand-soft: #fff7ed;
  --color-brand-strong: #ea580c;
  --color-ink: #1a1a1a;
}
```
- 圆角 12px，柔和阴影
- 手机端：底部 Sticky 操作栏（保存/同步），16px 输入字体防 iOS 缩放，Tab 横向滚动
- 桌面端：左侧 240px Tab 侧栏，右侧主区
- 所有"复制"按钮使用 Clipboard API + Toast 反馈

---

## 八、未来 App 端

文档记录方向：Capacitor 把 Web 包装成 iOS/Android，复用 ≥95% 代码。本期不做。

---

## 九、实施顺序（每步独立验证）

1. **骨架**：启用 Lovable Cloud + 创建数据库表/RLS/Storage bucket + 设计 tokens + 首页（项目列表）
2. **图片上传 + 商品基础信息**：Tab 2 上半部分（图片 9 宫格 + 基本字段）
3. **规格组 + SKU 矩阵**：Tab 2 下半部分（动态规格 + 笛卡尔积表格 + 批量设置）
4. **AI 三件套**：`analyzeImages` / `smartFill` / `generateIntroBlocks` server fns + Tab 1 内容块编辑器
5. **运营配置**：Tab 3 物流模板 + 团购时间
6. **同步导出页**：复制全文 + 图片 zip 打包下载 + 公共项目 JSON API
7. **Chrome 插件**：MV3 骨架 + 下载页 + 填充逻辑占位

---

确认后按顺序构建，每完成一步在预览中即可验证。
