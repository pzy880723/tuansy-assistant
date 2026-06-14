分三块来做：点击放大、聊天图片拖到右侧预览、让团宝按"模块上下文"理解预览。

## 一、点击图片弹大图（Lightbox）

新增轻量复用组件 `ImageLightbox`：全屏遮罩 + 单图 + ESC/点遮罩关闭，含下载按钮。挂到：

1. **聊天里 AI 生图气泡**：点任意一张全屏看。
2. **预览区 IntroTab**：
   - `image_lg` → 点图放大
   - `image_sm`（九宫格） → 点任意一张放大，可左右切换该 block 内的图
   - SKU / 商品 Tab 商品主图也接上

编辑/拖拽/锁定按钮的点击区不触发放大。

## 二、聊天图片拖到右侧预览（新）

让聊天里 AI 生成的图（生图气泡里的缩略图）可直接长按/按住拖动，跨到右侧预览区，在 IntroTab 的模块列表中找位置落下，成为一张大图模块（`image_lg`）。

### 交互
- 在聊天图片上按下并开始移动 → 进入"拖图态"，鼠标下方出现 90×90 的图片缩略浮层跟随光标。
- 拖到右侧 IntroTab 预览区域时，预览区出现绿色淡色高亮边框，提示"松手放到这里"。
- 拖到具体某个 block 上时，该 block 的上/下边出现一条 2px 绿色插入线（按光标在该 block 的上半还是下半判断插入到该 index 之前还是之后）。
- 拖到预览空白或末尾区域 → 追加到 blocks 末尾。
- 松手 → 在目标位置插入一个新的 `image_lg` block（url 用图片地址；服务端图都已是上传好的 https URL，无需再上传）。
- 拖到聊天区外/空白处 → 取消。
- 锁定的 block 仍可在其上/下插入，但不能"替换"它（这版只做插入，不做替换占位图）。

### 实现方式
- 不用 HTML5 native `draggable`（跨容器在 portal/iframe 模式下兼容性差），统一用 pointerdown/pointermove/pointerup + 全局浮层，跟现在 IntroTab 内部块拖拽一致的模式。
- 新建一个全局的 `DragImageBus`（轻量 store / context）：
  - `startDrag({ url, sourceId })` 由聊天侧调用
  - `currentDrag` 暴露给 IntroTab 用于显示落点指示
  - `endDrag(target)` 由 IntroTab 落下时调用，触发回调
- IntroTab 监听 bus，在拖图态时：注册 hit-test，根据光标位置计算 dropIndex；松手时调用 `onInsertImageBlock(index, url)`，写一个 `{ id, type:"image_lg", url }` 到 `intro.blocks`。
- 同一根浮层组件 `DragGhost` 渲染在 body Portal，跟随光标。
- 数据库写入走现有的 `onChange(intro)` 主路径（项目页面已经统一持久化），无需新工具。

### 涉及文件
- `src/lib/drag-image-bus.ts`（新建）
- `src/components/tuan/DragGhost.tsx`（新建，body portal 浮层）
- 聊天消息里渲染 AI 生图缩略图的位置（如 `src/routes/app.project.$id.tsx` 或聊天消息组件，需在 IntroTab 同屏父组件挂 DragGhost）：图上加 pointerdown 启动拖动
- `src/components/tuan/IntroTab.tsx`：订阅 bus，渲染落点指示线，hit-test 计算 dropIndex，落下时插入 image_lg

## 三、让团宝按"模块上下文"理解预览（核心）

### 现状问题
`src/routes/api/chat.ts` 把整个 intro/skus/settings/product 以 JSON.stringify 丢给模型，看不懂"这是第几段、前后是什么、在文案逻辑里承担什么角色"。所以经常：嘴上说"放在『新鲜直采』下面"但实际 append 到末尾；blocksReplaceAt 用错 index；重写已锁定段；新段不接上文。

### 改造方案

#### 1）服务端预先构造"模块大纲"
streamText 前把 `intro.blocks` 编译成有序、带角色、带邻居关系的大纲：

```text
# 介绍模块大纲（共 7 块，从上到下）
[0] 段落1 · 标题段 · 未锁定 · 逻辑槽位=title
    内容："🔥再生纤维气球裤..."
    上一块：（无） / 下一块：[1]
[1] 段落2 · 痛点段 · 未锁定 · 逻辑槽位=paragraph#痛点共鸣
    内容："夏天穿牛仔裤腿汗黏..."
    上一块：[0] / 下一块：[2]
[2] 图位 · 大图建议占位 · 未锁定 · 逻辑槽位=image_large
    占位："[图位·大图建议：模特上身正面]"
    上一块：[1] / 下一块：[3]
[3] 段落3 · 品质背书 · 🔒已锁定 · 逻辑槽位=paragraph#品牌故事
```

同时输出：
- 逻辑槽位 ↔ 实际 block 索引映射
- 未填充槽位清单
- 图位占位清单（block index + 期望图类型 + 期望主题）

system prompt 改为以这份大纲为主线，原 JSON 退为附录，新增硬约束：
- 任何 blocksReplaceAt / insert_generated_images 调用前，必须先在回复里写"我要改的是 [X] 段落X · 角色"，再写参数。
- 嘴上指定的位置和工具参数的 index/anchor.blockId 必须一致；不一致即视为错误，工具拒绝并把错误吐回模型。
- 续写时必须显式照顾"上一块结尾 → 当前块开头"的过渡。

#### 2）工具加"语义校验"
- `update_intro.blocksReplaceAt`：新增可选 `expectLabel`（如 `"段落2"`），不一致直接报错；返回改完后的"前后块摘要"。
- `insert_generated_images`：新增 `expectRole`（如 `"痛点段后"`），不一致拒绝，错误里附最近 3 个候选 block 的大纲条目。
- 所有写入工具的 result 改为返回"新大纲"，让多轮调用持续基于最新结构推理。

#### 3）首次撰写绑死逻辑顺序
服务端在 prompt 里直接给"下一步应当生成的逻辑模块"（按已填充槽位推断），每轮只能产出下一个未填槽位，避免乱序或漏模块；所有槽位填完前禁止改已写好的段落（除非用户明确要求）。

#### 4）@mention 也走大纲
解析 `@[段落2#a1b2c3d4]` 后从大纲里把"该块 + 上下相邻块的摘要"一起塞回 prompt，让模型改这段时有上下文。

### 涉及文件
- `src/routes/api/chat.ts`：新增 buildIntroOutline()、改 system prompt、收紧 update_intro / insert_generated_images 校验、tool result 统一回吐新大纲
- `src/components/tuan/types.ts`：导出 `buildBlockOutline()` 公共工具（前后端共用 label 规则）

### 不动的部分
- 数据库结构不变（blocks 仍是数组，服务端实时编译大纲）
- update_skus / update_settings / update_product_meta 工具不动
- 锁定模块、候选采纳等规则保留，改为基于大纲表达

完成后：模型每次都能说"改的是第 X 块（角色 Y），它前面是 A、后面是 B"，并据此续写或替换；写错位置工具直接拒绝并回带大纲的错误，模型立即纠正。
