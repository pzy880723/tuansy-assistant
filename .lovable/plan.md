## 问题
拖动模块时，被拖的浮动卡片在缩略图内部从其它模块"下面"穿过——因为它和其它兄弟块同属一个 `relative` 容器，没有显式 z 层级，浏览器按 DOM 顺序绘制，后面的模块会盖住它。

## 修复（只改 `src/components/tuan/IntroTab.tsx`）
1. 给被拖动模块的浮层 div（约 720 行处，`isMe` 分支返回的 `<div>`）添加 `zIndex: 50`。
2. 给其它（非被拖）模块的容器 div（约 745 行处）显式设置 `zIndex: 1`，确保它们永远在被拖块之下。
3. 父级 `<div className="relative space-y-3">` 已是 `relative`，无需调整。

## 不改的内容
- 自动滚动、`dropIndex` 计算、`commitReorder`、`yInScaled` 公式、样式（背景、阴影、padding）、外部 backdrop。
- 其它 tab / 数据层 / 业务逻辑。
