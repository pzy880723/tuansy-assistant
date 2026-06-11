# 介绍区块交互优化方案

只改 `src/components/tuan/IntroTab.tsx`（必要时小改 `types.ts`），不动数据流。

## 1. 文字：底部内联输入框（替代弹窗）

- 删除 `Sheet` 弹窗及 `textSheet` 状态、相关导入。
- 点击工具栏「文字」→ 直接在 blocks 列表末尾追加一个空的 `text` block，并标记为「编辑中」（focus）。
- 点击已有文字 block → 切换为编辑态，原地展示 `AutoTextarea`（支持自动换行、自动撑高、Enter 换行）。
- 失焦自动保存；若为空则删除该 block。
- 不再有任何模态弹层。

## 2. 工具栏 hover 反馈

四个按钮（大图 / 小图 / 视频 / 文字）增加 hover & active 视觉差异：
- hover：图标和文字变绿 `#07c160`，背景浅绿 `bg-[#07c160]/8`，轻微 `scale-[1.03]`，过渡 150ms。
- active：`scale-[0.97]`。
- 整体加 `rounded-lg p-2 transition`，确保命中区明显。

## 3. 大图：只允许 1 张 + 按原始比例完整显示

- `image_lg` block 含 `url` 单图（已是此结构），保持单文件 picker。
- 渲染改为：`<img>` 用 `w-full h-auto object-contain`，**不再设固定 `aspect-[16/10]`，不裁切**，正方形显示正方形，长方形显示长方形。
- 占位（无图）保持一个虚线占位框（固定高度仅用于"添加大图"占位态）。
- 已有大图时，「替换」改为按钮浮于图片右上角，不再让整张图作为 picker 触发区（避免误触）。

## 4. 小图：最多 9 张 + 3×3 九宫格正方形

- 渲染固定 `grid-cols-3 gap-1`，每格 `aspect-square object-cover`（九宫格风格，裁切为正方形，这是九宫格的标准呈现）。
- 上传时：
  - 累计上限 9 张；超出部分丢弃并 `toast.warning("最多 9 张图片")`。
  - 已满 9 张时隐藏 "+" 添加格。
- 每张缩略图右上角加小「×」按钮，可单独删除某张。

## 5. 视频：按视频原始尺寸显示

- 去掉 `aspect-video` 固定比例。
- `<video>` 用 `w-full h-auto`，浏览器会按视频固有宽高比渲染（高度自适应）。
- 占位（无视频）保留固定比例的虚线占位框。

## 技术细节

- 文字 block 的「编辑中」状态用本地 `editingId: string | null`；新增时立刻 setEditingId 并在 effect 中 autofocus 对应 textarea。
- `AutoTextarea` 已有 focus 守卫与自动撑高，直接复用。
- 不修改 `IntroBlock` 类型；`image_sm.urls` 维持 `string[]`，由 UI 层强制 ≤9。
- 不动持久化、AI chat schema、其它 tab。

## 影响文件

- `src/components/tuan/IntroTab.tsx`（主要改动）
