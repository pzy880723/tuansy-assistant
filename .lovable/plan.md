# 生成中加入「思考过程」文案与进度条

## 目标
把生成图片时的等待变得有感知。每个生成槽位（TechLoader）显示：
1. 一条苹果风格的细进度条
2. 一行像 ChatGPT 一样滚动的"正在做什么"文案

## 范围
仅改 `src/components/tuan/AIGenerateImageDialog.tsx` 中的 `TechLoader` 与调用处。不动后端、不动流式协议、不动确认插入流程。

## 文案脚本（按时间顺序循环展示）
按预估时长 0–25s 之内依次切换；超时后停留在最后一条直到完成：

```
正在阅读你的描述…
拆解段落，理解商品要点…
搜索相似商品的视觉特征…
构思画面构图与镜头…
铺设光影与材质…
绘制主体细节…
微调色彩与质感…
即将完成…
```

收到 `partial_image` 帧时跳到"绘制主体细节…"；收到完成事件直接显示"完成"并把进度条拉满。

## 进度条策略
- 默认：基于经过时间的"假进度"曲线 —— 0–6s 走到 35%，6–18s 走到 75%，之后渐近 90%（永远不要靠时间到 100%）。
- 收到第一帧 `partial_image`：跳到 ≥ 80%。
- 收到 `completed`：动画到 100%，文案变"完成"，0.3s 后由父组件切到 done 态。
- 失败：进度条变红，文案显示错误。

视觉：1px 高度，圆角，底色 `white/15`，前景用现有 Siri 渐变（粉→紫→蓝），带轻微 shimmer。

## 实现要点（技术细节）
1. `TechLoader` 新增 props：`startedAt: number`、`hasPartial: boolean`、`status: "loading" | "done" | "error"`。
2. 内部用 `requestAnimationFrame` 推进 `progress` 与 `phraseIndex`，组件卸载时清理。
3. 文案切换用 `key={phraseIndex}` + `animate-in fade-in slide-in-from-bottom-1` 做上滑淡入。
4. 父组件在创建 slot 时记录 `startedAt = Date.now()`，传入 loader。
5. 移除原来的 `DESIGNING` 字样，保留液态色块与光环。

## 不做
- 不接入真正的"AI 在思考什么"语义事件（后端流里没有这种语义）。
- 不改默认数量、不改并发逻辑、不改下载/上传。
