修复缩略图的三处问题：

1. 模块背景改为不透明白色
   - 每个模块卡片背景从透明改为纯白 `#ffffff`，确保文字和内容清晰可读，不再透出后面的毛玻璃。

2. 每个模块加阴影
   - 给缩略图内的每个模块卡片加轻量阴影（如 `0 2px 8px rgba(0,0,0,0.06)` + 圆角），形成清晰的卡片堆叠感。
   - 被拖拽的模块保留更明显的浮起阴影和绿色虚线描边。

3. 自动滚动时拖拽模块跟随移动
   - 当前问题：靠近缩略图上/下边缘触发 auto-scroll 时，scrollTop 变化但 React 没有重渲染，导致被拖拽模块"卡住"不跟着滚动，drop index 也不实时更新。
   - 修复：在自动滚动的 RAF tick 中，每次 scrollTop 发生变化时都触发一次 setDrag(更新一个 tick 计数或重新计算 dropIndex)，让被拖模块的 translateY 和其他模块的让位实时跟随滚动位置变化。
   - 效果：拖到顶部边缘，缩略图自动向上滚动暴露上面内容，被拖模块视觉上跟着内容一起移动；拖到底部同理向下滚动。

技术细节（仅修改 `src/components/tuan/IntroTab.tsx`）：
- 调整缩略图内每个 block 容器的内联样式：`background: #fff`、`borderRadius: 8`、`boxShadow: 0 2px 8px rgba(0,0,0,0.06)`、内边距 padding。
- 调整 auto-scroll RAF：滚动后调用 `setDrag(cur => cur ? { ...cur } : cur)` 或重新计算 dropIndex 并 set，确保依赖 scrollTop 的 dragged 元素重新计算位置。