# AI 生图能力（聊天 + 文字模块快捷入口）

## 目标
1. 聊天里团宝可以自己调"生图"工具（用户说"给我配张图"它就生成）。
2. 介绍 Tab 的每个**文字模块**右上角加"✨ AI 生图"按钮，弹窗选数量+上传参考图，生成后自动把图片插到该文字模块下方（已有空缺九宫格优先填空，否则新建图片模块）。

## 模型与基础设施
- **图像模型**：`google/gemini-3.1-flash-image-preview`（Nano Banana 2，支持文生图+参考图编辑，速度快质量高）
- **存储**：复用现有私有桶 `product-images`，路径 `ai-gen/{userId}/{uuid}.png`，沿用 `uploadProductImage` 的签名 URL 模式
- **图片搜索（网图搜索）**：本期不做，专注 AI 生图（先前曾问过，用户回复也只提生图）

## 后端

### 新文件 `src/routes/api/generate-image.ts`（TanStack 服务路由）
- `POST`，body: `{ prompt: string; count: 1|2|3|4|6|9; referenceImages?: string[] /* http URLs */; projectId: string }`
- 鉴权：`readSessionUserIdFromRequest`；校验 projectId 归属
- 拼装 `messages`：text + 每张参考图作为 `image_url`（参考 ai-multimodal-input）
- 并发 N 次调用 Gateway `/v1/images/generations`（非流式，`stream:false`，便于上传），拿 base64 → 上传 `product-images` 桶 → 返回签名 URL 数组
- 模型选择按 `count`：≤2 用单次 `n=count` 调用；>2 拆并发以避免 timeout
- 错误透传 402/429

### 修改 `src/routes/api/chat.ts`
- 新增工具 `generate_product_images`：
  - inputSchema：`prompt`（中文场景描述）、`count`（1/3/6/9 默认 3）、`insertAfterBlockId?`（可选，插在哪个 block 后）、`style?`
  - execute：调用上面 `/api/generate-image` 逻辑（抽到 `src/lib/image-gen.server.ts` 复用），把结果作为 `image_sm`/`image_lg` block 插入 `intro.blocks`
- 系统提示词追加：用户描述图片/场景时主动调 `generate_product_images`；参考图由用户上传的 file part 自动带入

## 前端

### 新组件 `src/components/tuan/AIGenerateImageDialog.tsx`
shadcn Dialog，字段：
- 文字提示（默认填入触发它的文字模块文本，可改）
- 数量选择：1 / 3 / 6 / 9 单选 chips
- 参考图上传（最多 3 张，复用 `useImageAttachments` 的上传能力）
- "开始生成" → 调 `/api/generate-image` → 进度条 → 拿到 URL 数组 → `onComplete(urls)`

### 修改 `src/components/tuan/IntroTab.tsx`
- `BlockCard` 头部按钮区，`block.type === "text"` 时多一个 `<Sparkles /> AI 生图`
- 点击 → 打开 Dialog，prompt 默认 = 该 text block 内容
- 生成完成回调：
  1. 找到该 text block 后**紧邻**的图片 block
  2. 若是 `image_sm` 且未满 9 张 → 把新图 push 进去（"补齐空缺"语义）
  3. 否则 → 在该 text block 后插入新 `image_lg`（count=1）或 `image_sm`（count>1）
- 同时给整个文字栏标题旁加个全局"AI 生图"按钮，prompt 默认 = 整篇 description

## 文件清单
- 新增：`src/routes/api/generate-image.ts`、`src/lib/image-gen.server.ts`、`src/components/tuan/AIGenerateImageDialog.tsx`
- 修改：`src/routes/api/chat.ts`（新工具 + 提示词）、`src/components/tuan/IntroTab.tsx`（按钮 + 回调）

## 验证
- 文字模块点"AI 生图"→ 选 3 张 → 不上传参考图 → 生成 3 张并插入 image_sm
- 上传 1 张参考图 + 选 6 张 → 生成 6 张同风格
- 聊天里说"给我配 3 张水果园场景图" → 团宝调 `generate_product_images` → 预览直接出现新 block
