## 计划

1. **先修复 Unauthorized**
   - 当前 `/api/generate-image` 只从 cookie 或 `x-tuan-session` 读取登录态，但普通 `fetch()` 没有带这个自定义会话头，所以接口直接返回 `Unauthorized`。
   - 我会让生图请求像现有 server function 一样带上本地会话 token，保证已登录用户能正常调用。

2. **切换生图模型组合**
   - 文生图默认使用 `openai/gpt-image-2`，走最真实的 OpenAI image2 路径。
   - 有参考图时使用 `google/gemini-2.5-flash-image`（Nano Banana），用于参考图/风格/商品图生成。
   - 不再用之前不稳定的 `google/gemini-3.1-flash-image-preview` 作为默认参考图路径。

3. **按模型重写请求参数**
   - `image2` 使用 OpenAI 图片生成格式：`prompt + size + quality + n`。
   - Nano Banana 使用 Gemini 图片格式：`messages + modalities`，不混入 OpenAI 专属参数，避免 400 或空返回。
   - Gateway 鉴权头会按 Lovable AI Gateway 推荐方式调整为 `Lovable-API-Key`，降低 Unauthorized/鉴权兼容问题。

4. **“最真实”提示词增强**
   - 在服务端统一追加真实摄影约束：自然光、真实材质、商品摄影、避免卡通/塑料感/过度渲染。
   - 单张重新生成时继续追加变化提示和 seed，让结果与前一张不同。

5. **优化失败提示**
   - 前端对 401 显示“登录状态失效，请刷新或重新登录”，不再只显示英文 `Unauthorized`。
   - 保留每张图的失败原因，方便继续点击重试。

## 涉及文件

- `src/components/tuan/AIGenerateImageDialog.tsx`
- `src/lib/image-gen.server.ts`
- `src/routes/api/generate-image.ts`

## 不改动

- 不改数据库结构。
- 不改图片插入和拖拽排序逻辑。
- 不改弹窗主流程，只修复调用、模型和真实感效果。