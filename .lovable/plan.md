## 目标

让顶部「团长卡片」自带模拟数据、支持自定义，且背景图永远不为空。

## 改动

### 1. 数据模型 (`src/components/tuan/types.ts`)
- `IntroData` 新增 `leader_bg_url?: string | null`。

### 2. 团长名称 & 头像（IntroTab，约 511–537 行）
- **模拟默认值**：项目创建时若 `leader_name` 为空，从内置池随机一个（如「团团妈、小美选物、邻居老王、甜甜的店、阿May 严选」等）写入。`leader_avatar` 为空时随机一个内置头像（用 DiceBear `https://api.dicebear.com/7.x/avataaars/svg?seed=<projectId>` 这种确定性 URL，无需上传）。
- **支持自定义**：
  - 头像方块改为可点击 → 弹原生 file input（复用现有 `uploadProductImage` serverFn）上传后写入 `leader_avatar`。
  - 名称沿用现有 `InlineText`，已可编辑，仅把 placeholder 行为改成「点击可改」。

### 3. 背景图自动填充（IntroTab，约 514–519 行）
- 顶部 div 背景改为 `style={{ backgroundImage: url(intro.leader_bg_url) }}`；当前的渐变+点阵作为「加载中/兜底」层。
- **自动补全策略**（首次进入项目时，由 `app.project.$id.tsx` 在加载完成后触发一次）：
  1. 若已有 `leader_bg_url` → 不动。
  2. 否则若 `project_images` 中至少有 1 张图 → 取第 1 张作为背景，写入 `leader_bg_url`。
  3. 否则调用 `/api/generate-image`（已存在的流式接口）用「项目名 + 商品名 + 标签」作为 prompt 生成一张横向背景图，上传到 `product-images` 后写入 `leader_bg_url`。生成期间显示当前渐变占位。
- **「设置背景图」按钮**：去掉「即将上线」toast，改为弹出小菜单：
  - 「从已上传图片中选择」→ 列出 `project_images` 缩略图。
  - 「AI 重新生成」→ 重跑上面第 3 步。
  - 「上传新图」→ 复用 file input。
- 选中后立即写入 `leader_bg_url` 并通过现有 `updateProject` 持久化。

### 4. 触发位置
- 进入 `app.project.$id.tsx` 加载到 `intro` 后，用 `useEffect` 跑一次「确保有名称/头像/背景」的补全函数，结果通过现有 `onChange(intro)` 写回数据库；避免重复触发（用 ref 标记本会话已尝试过）。

### 5. 文件清单
- `src/components/tuan/types.ts`：加字段。
- `src/components/tuan/IntroTab.tsx`：团长卡片交互 + 背景图。
- `src/routes/app.project.$id.tsx`：首次进入时的自动补全逻辑。
- 不动后端 schema（`leader_bg_url` 存在 `projects.product` 或 `intro` JSON 里，跟现有 `leader_avatar` 同处）。

## 不做

- 不新建表、不动 RLS、不动 chat / skill 逻辑。
- 不做完整的「素材库」UI，只在背景图按钮里给三个最小选项。
