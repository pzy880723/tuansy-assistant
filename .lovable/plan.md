## 改动范围
仅修改 `src/components/tuan/IntroTab.tsx`，不涉及业务/数据结构。

## 1. 移除「团购活动内容」描述输入框
- 删除 384–393 行的 `<InlineText>` 描述块及其上方的 `border-b` 分隔。
- `intro.description` 字段保留在数据结构中（不动 schema），仅 UI 不再渲染，避免破坏旧数据。

## 2. 空状态（无 blocks 时）
当 `blocks.length === 0`：
- 保留卡片头部「团购介绍」标题 + 右侧三个动作按钮（AI 生图 / 素材导入 / 复制已有团购）。
- 保留可编辑的活动标题输入框（占位「请输入团购活动标题」）。
- 不渲染描述框；不渲染 blocks 列表。
- 4 个添加按钮（大图 / 小图 / 视频 / 文字）保持显示，但在空状态下增加上下内边距，使其在卡片中视觉居中放大（图标 h-6 w-6、文字 12px、行距加大），作为引导。
- 一旦添加第一个模块，按钮区恢复成现在的紧凑底部样式。

## 3. 拖动手柄 → 浮动整篇缩略图选位

### 触发
点击/按下任一模块右上角的 `≡`（GripVertical）按钮即进入「选位模式」。原生 HTML5 drag 改为自定义点击触发（不再 `onMouseDown setDraggable`）。「上移/下移/置顶」按钮保持现有立即移动行为，不触发缩略图。

### 缩略图浮层
- 一个 `fixed` 居中浮层（半透明黑色遮罩 + 居中白卡），渲染当前所有 blocks 的迷你缩略：
  - text：截断到 1 行的灰色文字条
  - image_lg：16:10 缩略图
  - image_sm：3 格小图拼图
  - video：带播放角标的 16:9 缩略
- 被拖动的项高亮（绿色边框 + 「拖动中」徽标）。
- 每两个模块之间显示一条「插入位」横线（hover/拖过时变绿加粗）。列表首尾也各有一条插入位。

### 交互
- 选位模式开启后，鼠标移动到任一「插入位」上时该位高亮。
- 鼠标松开（mouseup）：把拖动项移动到当前高亮的插入位；若未停在任何插入位则不动。
- 浮层关闭，恢复正常视图，新位置即拖动后的位置（已经在列表中体现）。
- 触屏：touchstart 同样进入选位模式，touchmove 用 `document.elementFromPoint` 计算 hover 的插入位，touchend 提交。
- Esc 键或点击遮罩空白区取消，不移动。

### 状态管理
在 `IntroTab` 内新增：
```ts
const [reorderingId, setReorderingId] = useState<string|null>(null);
const [hoverIndex, setHoverIndex] = useState<number|null>(null); // 0..blocks.length
```
确定后调用一个新的 `moveToIndex(id, index)` 工具函数（基于现有 `blocks` 数组 splice），替换/补充现有 `reorder(srcId, dstId)`。

## 技术细节
- 新增内部组件 `ReorderOverlay`（同文件内）：props = `{ blocks, draggingId, hoverIndex, onHover, onCommit, onCancel }`。
- 使用 `createPortal` 到 `document.body`，z-index 50。
- 缩略图宽度固定 ~280px，最大高 80vh，内部可滚动。
- 文字缩略复用 `block.text` 首行；图片缩略复用现有 url，加 `loading="lazy"`。

## 不改动
- 数据库 schema、`intro.description` 字段、API、其他 Tab。
- AI 生图、素材导入、复制已有团购按钮行为。
- 商品卡片（`ProductEntryCard`）。
