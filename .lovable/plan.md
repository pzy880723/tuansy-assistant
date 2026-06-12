
## 问题

拖动模块时，"下面还有内容却拖不下去"。原因是缩略图的高度直接等于整个介绍卡片的高度（`cRect.height - 16`），当卡片比视口高时，缩略图的底边其实是在屏幕之外的：

- 自动向下滚动的判定 `pointerY > r.bottom - EDGE` 永远不成立（因为 r.bottom 在视口下方，指针碰不到）。
- 缩略图的下半部分被屏幕裁掉，看不到也滑不进去。

## 修复（只改 `src/components/tuan/IntroTab.tsx`）

1. 引入视口夹紧的尺寸计算（在渲染缩略图的 IIFE 里）：
   ```
   const VPAD = 16;
   const ghostTop    = Math.max(VPAD, drag.cRect.top + 8);
   const maxBottom   = window.innerHeight - VPAD;
   const ghostHeight = Math.max(200, Math.min(drag.cRect.height - 16, maxBottom - ghostTop));
   ```
   缩略图始终完整落在视口里，底部边缘可被指针触达。

2. 用 `ghostTop` / `ghostHeight` 同时设置：
   - 毛玻璃 backdrop 的 `top` / `height`（仍然只覆盖原预览区域的横向范围 `cRect.left` / `cRect.width`，但纵向夹紧到视口）。
   - 缩略图浮层的 `top` / `height`。

3. 自动滚动逻辑不变（`tick` 里依据 `ghostScrollRef.getBoundingClientRect()` 的 top/bottom 判断），但因为 1)，`r.bottom` 现在真的在屏幕内，向下拖到接近底边时就会触发 `s.scrollTop += dy`，并通过 `setDrag(c => ({...c}))` 触发重渲染，露出下方模块、被拖块的 `translateY` 同步跟随。

4. 被拖块在缩略图内的 `yInScaled` 公式保持不变（`(pointerY - baseTop + scrollTop)/GHOST_SCALE - blockHeight/2`），因为它依赖的是 `ghostScrollRef.getBoundingClientRect().top`，会自动反映新的 `ghostTop`。

5. 顶部边缘自动向上滚动同理生效（之前如果 `cRect.top` 是负值/在视口外，顶边检测也会失常；现在被 `Math.max(VPAD, ...)` 夹紧后顶边一定在屏幕内）。

## 不改的内容

- 模块业务逻辑、`commitReorder`、`computeDropIndex`、模块卡片样式、文字大小（已是按比例 `GHOST_SCALE=0.5` 缩放，文字也跟着缩小，不需要再调）。
- 其他 tab、其他组件、数据层。
