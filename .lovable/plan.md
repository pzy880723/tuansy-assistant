## 排查结论

抓取了 worker 日志和浏览器 network：
- 浏览器看到的是 `Failed to fetch`（请求未拿到任何响应）。
- Worker 日志显示 `POST /api/generate-image → 0`（worker 在响应前就异常结束）。
- 路由本身已注册，`LOVABLE_API_KEY` 也已配置，且预览页面是登录态，鉴权不是问题。

真正的原因：
当前 `/api/generate-image` 在一次请求里串/并发地用 `openai/gpt-image-2` + `quality:"high"` 生成多张图，再把每张图上传到 Storage。这一次请求在 Cloudflare Worker 上会跑几十秒到上百秒，常常超过 worker 的 CPU/子请求时间预算，连接就被强行掐掉，前端看到 `Failed to fetch`。3 张并发尤其会必挂。

## 方案

1. **后端改成"单张生成"接口**
   - `/api/generate-image` 一次只生成 1 张图，去掉 `count` 字段。
   - 文生图用 `openai/gpt-image-2`，参考图用 `google/gemini-2.5-flash-image`（保持当前模型选择）。
   - 默认 `quality:"low"`（出图够用且足够快，避免单张超时）；后续要"高质量"再做一个可选项。
   - 走 SSE / 流式直通：把上游 `stream:true, partial_images:1` 的响应体原样回传给前端，前端边收边显示模糊预览，最终拿到完整 PNG。这样既给等待动效真实进度，又不会因为一次请求太长被 worker 掐断。

2. **前端改成并发 N 次单图请求**
   - 在 `AIGenerateImageDialog.tsx`，用户填的"生成数量"由前端控制：发起 N 个并发请求，每个请求只生成 1 张。
   - 每张图独立维护状态（loading / 完成 / 失败 + 错误信息），失败的图保留"重新生成"按钮；成功的图直接展示并支持拖拽排序。
   - 解析 SSE：收到 `partial_image` 时更新该格预览（带模糊），收到 `final` 时清掉模糊并存最终 URL。
   - 单张完成后由客户端把 base64 通过 `createServerFn`（非流式短请求）上传到 Storage 拿签名 URL；上传单张图很快，不会触发 worker 超时。

3. **错误提示**
   - 401：`登录状态失效，请刷新页面重新登录`
   - 402：`AI 额度已用完，请联系管理员充值`
   - 429：`请求太频繁，请稍后再试`
   - 其他：把上游 message 透传到该图格内。

4. **"科技感"等待动效保留**
   - 复用现有 Siri 风格 `TechLoader`，但在每张图卡片上加 partial_image 模糊预览作为背景；不再用一个大弹窗等所有图，体验明显更顺。

## 涉及文件

- `src/routes/api/generate-image.ts`（改成单图 + 流式直通）
- `src/lib/image-gen.server.ts`（暴露"返回流"的版本；保留 `uploadGeneratedImage`）
- `src/lib/image-gen.functions.ts`（新增 createServerFn：把 base64 上传到 Storage 并返回签名 URL）
- `src/components/tuan/AIGenerateImageDialog.tsx`（前端并发 N 张 + 解析 SSE + 单张重试 + Siri 等待）

## 不改动

- 数据库结构、拖拽排序、确认后插入图片模块的主流程都不动。
- 现有 Siri 风格 loader 的视觉沿用，不重写样式。

## 验证

实施完成后我会：
1. 用 `invoke-server-function` 直接 POST 单张请求，确认能拿到 SSE 流而不是 502/0。
2. 在浏览器预览里跑一次 3 张并发，观察 worker 日志全部 200，前端依次出图。
