## 目标

把 `/app` 列表里巨大的封面卡片换成参考图那种紧凑的"团购小卡"，并补全增删改查。

## 卡片样式（参考截图）

每张卡片自上而下：
- 顶部一行：**标题**（粗体，2 行截断）+ 右侧灰色小字 **`YYYY年M月D日发布`**
- 中间：**三张图横向并排**（1:1，圆角，gap-2，若不足 3 张用占位灰块补齐）
- 底部一行：**商品名称**（小字 muted）+ 右侧 hover 出现的 ⋯ 菜单（编辑 / 删除）

去掉：价格区间、佣金、自由定价、已结束、分享按钮、统计数据等所有无用字段。

列表布局：`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`，卡片整体可点击进入编辑器。

## CRUD 交互

- **新建**：右上"新建项目"按钮 → 弹出对话框输入"标题"+"商品名称" → 创建后跳转 `/app/project/$id`
- **编辑（基础字段）**：卡片右上 ⋯ → "编辑信息" → 同款对话框，预填后保存
- **删除**：⋯ → "删除"，沿用现有 AlertDialog 确认
- **进入完整编辑**：点击卡片主体 → 已有的双栏编辑器（标题/商品名同步显示）

## 技术改动

1. `src/lib/projects.functions.ts`
   - `createProject` 入参扩展为 `{ name?, product_name? }`；插入时同步写 `product.name`
   - `listProjects` 多选 `product`（取 `product.name`）、`updated_at`，并从 `project_images` 拉取每个项目的前 3 张图（用一次 `in()` 查询批量取，按 `project_id` 分组）
   - 新增 `updateProjectMeta({ id, name, product_name })`：更新 `name` 同时合并 `product.name`

2. `src/routes/app.index.tsx`
   - 重写卡片为上面描述的紧凑布局
   - 新建/编辑共用一个 `ProjectMetaDialog` 组件（标题 + 商品名两个输入）
   - 时间显示用 `created_at` 格式化为 `YYYY年M月D日发布`
   - 三图位用 `project.images?.slice(0,3)`，缺位 `bg-muted`

3. 编辑器页面（`app.project.$id.tsx`）保持原样，仅依赖现有字段，无需改动。

## 不动的部分

数据库 schema、AI Chat、编辑器双栏、其他路由都保持现状。本次只改列表卡片样式 + 增删改查表单。
