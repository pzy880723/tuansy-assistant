# 团宝助手 · 专业版重构计划

## 一、整体结构调整

参考 Lovable 的产品结构，把应用拆成两层：

```text
/                       落地页（Landing）— 专业介绍 + 项目列表入口
/app                    项目列表（卡片网格 + 新建按钮）
/app/project/$id        编辑器（左：AI 对话  右：快团团模拟预览，可直改）
/app/project/$id/sync   同步导出 / Chrome 插件
/extension              插件下载页
```

底部 Tab 导航只在移动端保留；桌面端改为顶部导航栏，更接近 SaaS 产品观感。

## 二、落地页（/）设计

一屏到底的专业营销页，深色高对比 + 活力橙点缀：

1. **顶部导航**：Logo「团宝」+ 产品 / 案例 / 插件 / 进入工作台（CTA 按钮）
2. **Hero 区**：
   - 大标题：「让 AI 帮你写好每一场快团团」
   - 副标题：上传商品图，自动生成介绍、规格、SKU，一键同步快团团
   - 主 CTA「免费开始」+ 次 CTA「下载 Chrome 插件」
   - 右侧 / 下方：编辑器产品截图（mockup 卡片，带橙色光晕阴影）
3. **痛点 → 价值**：3 列卡片（写文案慢 / SKU 易错 / 录入繁琐 → 对应解法）
4. **核心能力**：4 个特性卡（AI 识图填写 / 介绍块编排 / SKU 矩阵 / 一键同步）
5. **工作流程**：3 步图示（上传图片 → AI 生成 → 同步快团团）
6. **底部 CTA + Footer**

视觉规范：
- 背景 `#0a0a0a` / 卡片 `#141414` / 描边 `#262626`
- 主色 `--brand: #f97316`，强调辅色 `--brand-glow: #fb923c`
- 大标题 48–64px，字重 700，行高 1.1
- 渐变光晕：`radial-gradient(circle at top, rgba(249,115,22,0.25), transparent)`
- 卡片圆角 16px，hover 上浮 + 橙色边线

## 三、编辑器重构（核心改动）

把现有 3-Tab 编辑页改成 Lovable 式双栏布局：

```text
┌───────────────────────────────────────────────────────────┐
│ 顶部：项目名 · 自动保存状态 · [预览][同步导出] [···]        │
├──────────────────────┬────────────────────────────────────┤
│ 左侧 (40%)            │ 右侧 (60%)                          │
│ AI 对话区             │ 快团团模拟界面 (可见即所得)         │
│ ─ 消息流              │ ─ 顶部 Tab：介绍 / 商品 / 设置      │
│ ─ 工具调用卡片        │ ─ 模拟手机壳样式（圆角 + 阴影）     │
│ ─ 底部输入框          │ ─ 每个块可点击直接编辑              │
│   + 附件按钮(图片)    │ ─ 修改与 AI 对话双向同步            │
└──────────────────────┴────────────────────────────────────┘
```

### 左侧 · AI 对话区
- 使用 AI Elements（`conversation` / `message` / `prompt-input` / `tool` / `shimmer`）
- 系统提示：聚焦在「帮用户编辑当前项目」
- 工具调用：
  - `analyze_images`（识图填写）
  - `generate_intro_blocks`（生成介绍块）
  - `update_product`（改商品字段）
  - `update_sku`（改 SKU 价格 / 库存）
  - `add_block` / `reorder_blocks`（介绍编辑）
- 每个工具调用渲染折叠卡片，默认收起
- 对话存 `localStorage`（单会话，按项目 ID 区分），不上数据库
- 输入框支持拖拽图片上传，发送时附带当前项目快照

### 右侧 · 快团团模拟预览
- 外壳：iPhone 风格圆角容器，宽 ~390px，居中
- 顶部 Tab 切换：团购介绍 / 团购商品 / 团购设置
- 模拟样式参考快团团真机：白底、橙色主按钮、列表块
- **直接可改**：
  - 文字块：点击进入 contenteditable
  - 图片块：点击弹出替换 / 上传
  - 商品字段：点击行进入抽屉编辑
  - SKU：表格内联编辑价格 / 库存
- 改动后同步：
  - 写入数据库（debounce 500ms）
  - 推送一条「用户手动修改了 X」给左侧对话上下文，让 AI 知情

## 四、技术实现要点

1. **路由调整**
   - 新建 `src/routes/app.tsx`（layout，承载工作台壳）
   - 移动现有 `index.tsx` 项目列表逻辑到 `src/routes/app.index.tsx`
   - 新建 `src/routes/index.tsx` 作为落地页
   - 移动 `project.$id.tsx` 到 `src/routes/app.project.$id.tsx`

2. **AI 对话后端**
   - `src/routes/api/chat.ts`：`streamText` + 工具集
   - 使用 Lovable AI Gateway（`google/gemini-3-flash-preview`）
   - 工具的 `execute` 直接调既有 `projects.functions.ts` 中的 serverFn

3. **共享状态**
   - 用 React Query 缓存当前项目；工具调用后 `invalidateQueries(['project', id])`
   - 右侧预览读同一份 query 数据；编辑通过 `updateProject` mutate

4. **设计令牌更新**（`src/styles.css`）
   - 加深色基底变量
   - 加 `--shadow-brand`、`--gradient-hero`、`--ring-brand`
   - 字体引入 Inter（已经在用）+ 标题用更紧的字距

5. **AI Elements 安装**
   - `bun x ai-elements@latest add conversation message prompt-input shimmer tool`

## 五、实施顺序

1. 设计令牌升级 + 落地页（含 hero 截图占位）
2. 拆分路由 `/` vs `/app`，迁移项目列表
3. 编辑器双栏骨架（左聊天空壳 / 右模拟壳）
4. 右侧三 Tab 模拟界面（介绍 / 商品 / 设置）+ 内联编辑
5. AI 对话后端 + 工具集
6. 工具调用 ↔ 预览双向同步
7. 同步导出页 + Chrome 插件页样式对齐

## 六、给用户确认的两点

为避免做完返工，确认两件事即可开工：

- **落地页配色基调**：黑底 + 活力橙强调（推荐，更显专业 SaaS 感） vs 白底 + 活力橙（更轻量电商感）
- **编辑器对话历史**：仅当前浏览器保留（localStorage，零成本） vs 入库长期保存（需要后续加登录才能跨设备）

如果没有特别意见，我会按「黑底落地页 + localStorage 对话」开工。
