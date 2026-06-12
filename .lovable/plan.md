# 重写 Intro 模块拖动：长按跟手 + 模块让位

## 目标体验

按住 `GripVertical` 不松手 → 当前模块**立刻**缩成宽度一半的缩略卡，吸附在手指/指针下跟随移动；周围模块原位置出现毛玻璃虚化背景；拖到其它两个模块之间时，根据指针落在相邻模块**中线的上半部分还是下半部分**，让上方或下方的模块平滑让出空隙；移动到别处时，原先让位的模块再平滑回到原位；松手 → 模块就嵌进当前空隙；ESC 或拖出列表外松手 → 平滑回到原位。

## 当前实现的问题（要删除的部分）

- `onClick={onStartReorder}` + 弹出 `ReorderOverlay` 这一整套点击式弹窗。
- `ReorderOverlay` 里的 slot 横线、`ThumbBlock` 复刻列表 —— 全部删掉。
- 整个 `createPortal` 出来的居中白卡都不要了。

## 新交互（仅改 `src/components/tuan/IntroTab.tsx`，不动数据模型）

### 1. 长按启动
- 抓手按钮改成 `onPointerDown` 触发，记录 `pointerId`、初始 `clientX/Y` 与当前 block 的 `getBoundingClientRect()`，并 `setPointerCapture`。
- 不需要"长按 N 毫秒"延迟，按下就开始（用户要求"立刻缩小"）。但为避免误触，移动距离 < 4px 时视作未开始拖拽，松手不做任何事。

### 2. 原位占位
- 进入拖动后：被拖的 `BlockCard` 留在原位但内部缩成一个空占位（保持原高度，避免列表跳动），样式 `opacity-0 pointer-events-none`，外层加 `transition-[height]`，松手后清除。

### 3. 跟手缩略卡（drag ghost）
- 用 `createPortal` 渲染一个 `position: fixed` 的缩略卡：
  - 宽度 = 原 BlockCard 宽度 × 0.5（按下瞬间从 100% 缩放到 50%，`transition: transform 160ms cubic-bezier(.2,.8,.2,1)`，`transform-origin` 指向按下点）。
  - 内容直接复用 `BlockCard` 的渲染逻辑（图、文字、视频帧），加 `shadow-xl rounded-xl bg-white/90 backdrop-blur` 苹果风格。
  - `left/top` 实时跟随 `pointerMove` 减去初始相对偏移，使指针始终压在抓手处。
  - `pointer-events: none` 让 `elementFromPoint` 能命中底层模块。

### 4. 背景毛玻璃
- 在介绍卡片所在区域上方覆盖一层 `fixed inset-0 backdrop-blur-sm bg-white/10 z-40`，只在拖动时出现。被拖的缩略卡 z-index 更高。
- 不再用居中模态，原列表完全可见，毛玻璃在列表"后面"。

### 5. 让位算法（核心）
- 每个非拖动中的 `BlockCard` 外层加 `ref`，在 `pointerMove` 时遍历计算：
  - `rect = el.getBoundingClientRect()`、`mid = rect.top + rect.height/2`。
  - 若 `pointerY < mid` → 该模块属于"目标位置之后"的模块 → 向下平移 `placeholderHeight + gap`。
  - 若 `pointerY >= mid` → 该模块"在目标位置之前" → 不平移。
  - 第一个 `pointerY < firstMid` 的模块的索引即 `dropIndex`；若没有则 `dropIndex = blocks.length`（去掉自身后）。
- 用 `transform: translateY(...)` + `transition: transform 180ms` 让模块平滑滑开 / 归位。原始 `space-y-3` 间距保留，让位距离 = 被拖卡片实际高度 + 12px。
- 占位本身（被拖的原位）也参与位移：在 `dropIndex` 处保留高度，其他位置则把它折叠成 0 高（用一次性高度过渡 180ms 实现"塞进缝隙"的丝滑感）。

### 6. 提交
- `pointerUp`：把 `dropIndex` 传给 `moveToIndex`，清理 ghost、毛玻璃、translate 样式。
- `pointerCancel` / ESC / 指针离开列表 200px 以上：动画归位，不改 blocks。

### 7. 触摸支持
- 全程用 Pointer Events（统一鼠标 / 触摸 / 笔），不再单独处理 `touchmove`。
- 触摸时 `touch-action: none` 加在抓手按钮上，避免被滚动手势抢走。

## 技术拆分

- 新增本地 hook `useBlockDrag(blocks, onReorder)` 放在 `IntroTab.tsx` 内部：负责 pointer 事件、计算 dropIndex、维护 `dragState`（`null | { id, ghostRect, pointer, dropIndex, blockHeight }`）和 `translateMap: Record<id, number>`。
- `IntroTab` 把 `translateMap[b.id]` 传给 `BlockCard` 作为 `dragOffset`；`BlockCard` 外层套一层 `style={{ transform: translateY(${dragOffset}px), transition: 'transform 180ms cubic-bezier(.2,.8,.2,1)' }}`。
- `BlockCard` 抓手按钮新增 `onPointerDownDrag` 回调，由 `IntroTab` 传入。
- `BlockCard` 新增 `isGhost` 模式渲染（用于 ghost 卡片），与正常渲染共享一个内部子组件 `BlockBody`。
- 删除 `ReorderOverlay`、`ThumbBlock`、`reorderingId` 相关 state。
- 不动 `moveToIndex`/`moveBlock`/数据结构，不动其它 tab。

## 不做

- 不引入 dnd-kit 等库（用户要求精细控制效果，原生 Pointer Events 够用且更轻）。
- 不改后端、不改其它面板（Product / Settings）。
- 不改文案 AI、生图相关逻辑。
