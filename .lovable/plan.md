## 改动范围
- `src/components/tuan/AIGenerateImageDialog.tsx`：重写弹窗内部流程（数量输入、弹窗内渐进生成、科技感占位动画、生成完拖动排序、单张重新生成、确认）。
- `src/components/tuan/IntroTab.tsx`：把 `handleAIComplete` 改为「按顺序为每张图插入一个 image_lg 模块」（保持其它逻辑不变）。
- `src/routes/api/generate-image.ts` 与 `src/lib/image-gen.server.ts`：服务端无需结构性改动；只新增可选的「变体提示」字段以辅助重生（见下）。

## 1. 数量输入（1–9）
- 移除现有 1/3/6/9 的快捷按钮组，改为：
  - 左侧 `−` `+` 步进按钮 + 中间一个 `<input type="number" min=1 max=9>`，默认 3。
  - 输入会被夹紧到 1–9；非法值在 blur 时回到上次合法值。
- 旁边小字提示「最多 9 张」。

## 2. 弹窗内渐进生成（不再关闭弹窗）

### 流程
1. 用户点「开始生成」→ 弹窗进入「生成中」状态。
2. 弹窗主体替换为一个 N 格网格（3 列自适应），每格初始是「科技感等待占位」。
3. 客户端**并行**对 `/api/generate-image` 发起 N 个 `count: 1` 的请求（复用现有 endpoint，不改服务端语义）。每个请求 resolve 后，对应槽位的占位被替换为真实图片，伴随淡入。
4. 全部完成 / 部分失败：失败的槽显示「生成失败 · 点击重试」。
5. 全部 settled 后底部按钮从「生成中…」切换为「确认插入 / 取消」。

### 科技感等待占位（纯 CSS / SVG，无新依赖）
每个加载格：
- 深色渐变底（`from-[#0f1c2c] via-[#0a1220] to-[#0f1c2c]`），方形 16:10。
- 中央一颗旋转的 SVG 双环（外环顺时针、内环逆时针）+ 中心 `Sparkles` 图标，整体带浅绿色 `#07c160` 光晕（`drop-shadow`）。
- 顶层叠一条 45° 倾斜的 shimmer 高光条，沿 X 轴 `translate` 循环（Tailwind keyframes，单独写在组件内联 `<style>` 块）。
- 底部一行细字「AI 正在绘制… 1/9」按当前完成数刷新。
- 完成淡入：图片入场时给 `animate-in fade-in zoom-in-95 duration-300`（已有 tailwindcss-animate）。

### 状态模型
```ts
type Slot = {
  id: string;          // 稳定 id 用于拖拽与重生
  status: "loading" | "done" | "error";
  url?: string;        // done
  error?: string;
  variantSeed: string; // 用于重生时拼到提示词，确保不同
};
const [slots, setSlots] = useState<Slot[]>([]);
```
首次提交时按 `count` 生成 N 个 `loading` slot；并行 fetch；每个 settle 后用 setSlots 局部更新。

## 3. 生成完拖动排序
- 每张完成图右上角一个「拖动手柄」灰色徽标 + 右下角序号 `1` `2` …。
- 用原生 HTML5 drag（`draggable` + dragstart/dragover/drop），与项目其他组件保持一致；拖到目标槽位前/后插入。
- 仅 `status === "done"` 的槽可拖动；`loading`/`error` 的槽不可拖也不可被拖入（提示「等所有图生成完再排序」）。
- 改动顺序后底部「确认」按钮的图标编号实时刷新。

## 4. 单张重新生成（保证不同）
- 每张完成图覆盖一个浮层（hover 显示）：「重新生成」+「删除」两个小按钮。
- 删除：直接从 `slots` 移除该 slot（数量随之减少；最少剩 1 张）。
- 重新生成：
  1. 把该 slot 置回 `status: "loading"`，并替换 `variantSeed` 为新的 6 位随机串。
  2. 发起新请求，body 增加一个 `variant` 字段（`variantSeed` + 简短中文角度词，如「换一个角度/光线/构图」轮询取一条）。
  3. 服务端把 `variant` 直接附加到 prompt 末尾（见「服务端微调」）。

### 服务端微调（最小改动）
- `src/routes/api/generate-image.ts` Zod schema 增加可选 `variant: z.string().max(200)`。
- 把请求传给 `generateImagesBatch` 时，将 `prompt` 拼成 `${prompt}\n\n[variation hint: ${variant}]`（仅当 variant 存在）。
- `image-gen.server.ts` 不变。

## 5. 确认 → 按顺序生成图片模块
- 弹窗底部「确认插入」按钮在 `slots` 中至少有 1 张 `done` 且没有 `loading` 时可用。
- 取所有 `done` slot 的 url，按当前拖拽后的顺序传给 `onComplete(urls)`。
- 同时支持「取消」按钮，关闭弹窗放弃所有结果。

### `IntroTab.handleAIComplete` 调整
当前逻辑会优先填充相邻 `image_sm` 或合并成 9 宫格。改为：
- 不论数量多少，按顺序把每个 url 作为独立 `image_lg` 模块，逐个 `splice` 插入到目标位置之后。
- 单张时行为不变（仍是 image_lg）。
- 这样符合用户「按顺序生成对应的图片模块」的预期，所见即所得。

## 不改动
- 鉴权、上传、签名 URL 逻辑。
- 上传参考图、`useImageAttachments`。
- 团长封面、商品卡片等其它模块。
- 数据库 schema。

## 文件清单
- 编辑：`src/components/tuan/AIGenerateImageDialog.tsx`（重写主体）
- 编辑：`src/components/tuan/IntroTab.tsx`（替换 `handleAIComplete` 实现）
- 编辑：`src/routes/api/generate-image.ts`（增加可选 `variant` 字段并拼到 prompt）
