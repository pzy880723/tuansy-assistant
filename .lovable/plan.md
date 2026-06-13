## 现状问题

1. **不该自动丢右边**：聊天里的 `generate_product_images` 工具一次性做完两件事——生图 + 直接 append 到 `intro.blocks`。所以图片绕过用户预览，自己就跑到右边模块去了。
2. **位置乱放**：即使将来允许自动插入，现在的实现是 **无脑 append 到最后一块**，团宝嘴上说的"我帮你放到 XX 下面"和实际位置无关——它根本没传位置参数，也没读 blocks。
3. **还是方图**：聊天工具调 `generateImagesBatch(key, { prompt, referenceImages }, count)`，没传 `size`，落到 `image-gen.server.ts` 的默认值 `1024x1024`。前几次只改了 Dialog 入口，没改聊天入口。

## 改动方案

### 1. 拆成两个工具：先生图、再插入

`src/routes/api/chat.ts`

**`generate_product_images`（改）**：只生图、只回 URL，不再写 `intro.blocks`。新增 `aspect` 入参（`square|portrait|landscape`，默认 `portrait`），映射到 `1024x1024 / 1024x1536 / 1536x1024` 传给 `generateImagesBatch`。返回 `{ ok, urls, aspect, count }`。

**`insert_generated_images`（新增）**：把上一步的 URL 放到指定位置。入参：
- `urls: string[]`（1-9）
- `groupAsGrid: boolean`（≥2 张时是否合并成九宫格 `image_sm`；否则每张一个 `image_lg`）
- `anchor: { mode: "after_block" | "before_block" | "replace_block" | "end", blockId?: string }`
- `reason: string`（≤40 字，告诉用户为什么放这里，例如"放在『卖点·新鲜直采』下面，承接产地描述"）

handler 读取 `intro.blocks`，按 `anchor` 计算插入下标，写回 `projects.intro`。`blockId` 找不到时报错而不是兜底到末尾——避免"假装放对了"。

### 2. System Prompt 增加铁律

`src/routes/api/chat.ts`（system prompt 段）追加：

- 调用 `generate_product_images` 后，**默认不要**立刻调 `insert_generated_images`。把生成的图作为预览发回用户，附一句"放哪里你说，或者我建议放在 XX 下面，确认就插。"
- **只有**当用户消息里出现明确授权（"你来放/帮我放/自己丢进去/合适位置/你决定"等）时，才允许直接调 `insert_generated_images`。
- 调用 `insert_generated_images` 前，**必须**先看 `intro.blocks` 的文字内容，按语义选锚点（如：场景图放在描述场景的段落下面、细节图放在材质/工艺段落下面、九宫格食用方法图放在"怎么吃"段落下面）。`reason` 字段必须写明依据，禁止说空话。
- 团宝口头说"我放到了 X 下面"必须和 `anchor.blockId` 真实对应，禁止口是心非。

### 3. 聊天里的图片预览卡片

`src/routes/app.project.$id.tsx` 的 `ToolCard`：

- `generate_product_images` 完成时（`hasOutput && output.ok`），渲染缩略图网格（`output.urls.map`，按 `output.aspect` 给容器配 `aspect-square / aspect-[3/4] / aspect-[4/3]`，避免方块占位），点击可放大。
- 文案改为"已生成 N 张图，预览确认后告诉我放到哪个模块"。
- 不再显示"已生成并插入预览"——这句话本身就是误导。
- `insert_generated_images` 新增一条 label：成功显示 `📌 已插入到「<目标模块标签>」<位置>`，失败显示 `❌ 想放到「…」但没找到该模块`。

### 4. 单图生图入口的 size

`src/lib/image-gen.server.ts` 的 `generateImagesBatch` 已支持 `size`，但当前签名没透出来。把 `GenerateOneInput.size` 真正用上即可（已在前轮加好），聊天工具传 `aspect` 转换后的 size 即可。无需再改服务端。

## 不动的部分

- Dialog（`AIGenerateImageDialog.tsx`）继续走 `/api/generate-image`，行为不变。
- `image_lg` 渲染本来就是 `h-auto w-full`，自然比例没问题。
- `intro.blocks` 数据结构不变。

## 验收

1. 在聊天里说"给我配 3 张草莓园场景图"——图片只在聊天里出现，右边模块不动。
2. 用户回复"放到痛点共鸣下面"——团宝调 `insert_generated_images`，右边在该模块后面出现九宫格，团宝复述位置准确。
3. 用户说"你帮我自己放合适位置"——团宝读完 blocks 后才插入，并解释为什么放那。
4. 聊天里生成的竖图在右边模块里也是 3:4，不是被压成正方形。
