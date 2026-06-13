## 问题
右侧"大图"模块本身已经按图片自然比例渲染（`<img class="block h-auto w-full">`），但 AI 生图永远返回 **1024×1024 正方形**（`src/lib/image-gen.server.ts` 写死 `size: "1024x1024"`）。所以无论模块怎么自适应，生成出来的图都是方的——竖图素材塞进去要么被拉伸，要么留白/留黑。

修复点：让"生图"环节就能产出非正方形图片，模块自然显示对应比例。

## 改动

### 1. 服务端支持多比例
`src/lib/image-gen.server.ts`
- `GenerateOneInput` 新增 `size?: "1024x1024" | "1024x1536" | "1536x1024"`（gpt-image-2 三档官方尺寸）。
- `createImageGenerationStream` 与 `callOpenAIImage` 用传入的 size，缺省 `1024x1024`。
- Gemini 分支保持不动（参考图模式由参考图自身决定比例）。

`src/routes/api/generate-image.ts`
- 请求 schema 加入 `size` 字段（同枚举），透传给 `createImageGenerationStream`。

### 2. 对话框里选比例
`src/components/tuan/AIGenerateImageDialog.tsx`
- 新增 `aspect` 状态：`"square" | "portrait" | "landscape"`，默认 `portrait`（团购大图常用 3:4）。
- 表单顶部加一行三选一按钮：`方形 1:1` / `竖图 3:4` / `横图 4:3`。
- `runOneGeneration` POST body 多带 `size`（square→`1024x1024`、portrait→`1024x1536`、landscape→`1536x1024`）。
- 重置逻辑（`useEffect` open）把 `aspect` 复位为 `portrait`。
- 缩略图槽位用 `aspect-[var]` 渲染对应比例占位，避免加载中是方的、加载完突然变形。

### 3. 单图直接生图入口
`src/components/tuan/IntroTab.tsx` 的"生图"按钮如果直接调 `/api/generate-image`（非通过 Dialog），同样默认带 `size: "1024x1536"`。若该入口走的是 Dialog，则无需改。

## 不动的部分
- 模块渲染（`BlockCard` 中 image_lg）已是自然比例，不动。
- 九宫格 image_sm 每格仍是 `aspect-square + object-cover`（九宫格本来就要求方形小图，与本次诉求无关）。
- 数据结构 `IntroBlock` 不变，不存比例字段——比例由图片本身决定。

## 验收
- 在对话框选"竖图"，生成的图与模块都是 3:4，无变形无留白。
- 切到"横图"重新生成，模块自动变扁。
- 老的方图记录仍可正常显示，模块跟着方形撑开。
