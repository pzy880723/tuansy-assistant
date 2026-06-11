## 排查结论
1. 服务端 `/api/generate-image` 路由存在；本地预览返回 302 是因为命令行无登录态，浏览器调用应能通过。
2. 截图显示两张都「秒失败」，但客户端只有 402/429 才 `toast.error`，其它错误码（最常见的就是上游 400/500）被静默吞掉，所以现场看不到原因。
3. 上游失败最可能的原因：当前 `image-gen.server.ts` 用的是 Gemini 模型 `google/gemini-3.1-flash-image-preview` + `messages + modalities` body，对 `/v1/images/generations` 端点而言这是合规调用，但偶发被上游拒（无 `n`、有时空 content）。我们改用文档默认 `openai/gpt-image-2` + 简单 `prompt`/`quality: low` 作为主路径，仅当用户上传了参考图（OpenAI 该端点不支持 image_url 输入）时才走 Gemini 多模态分支。这样的好处：
   - 默认路径稳定（文档推荐路径）。
   - 不上参考图的生成不再会因 Gemini 临时抽风而失败。
   - 仍保留多参考图编辑能力。

## 实施细节

### 1. 服务端稳定性
`src/lib/image-gen.server.ts`：
- 新增内部函数 `callOpenAIImage(apiKey, prompt)`：POST 同 endpoint，body `{ model: "openai/gpt-image-2", prompt, quality: "low", size: "1024x1024", n: 1 }`，从 `data[0].b64_json` 取图。
- 保留现有 `callGeminiImage`（即原 `generateOneImage`），但只在 `referenceImages` 非空时调用。
- `generateOneImage` 改为根据是否有 `referenceImages` 派发到 openai/gemini。
- 错误抛出消息保留 `status`、补上 `code`（解析 upstream `error.code` 用于策略层判断）。

### 2. 客户端错误显示
`src/components/tuan/AIGenerateImageDialog.tsx`：
- 在每张失败槽上方/下方展示错误文本（截断到一行，鼠标 hover 显示完整 message）。
- 顶部除「生成中 m/n」外，新增「失败 k 张」红字标签。
- 失败槽 hover 时多一个「显示错误详情」小按钮 → 弹 `toast.error` 完整内容（便于反馈）。
- 任意非 200 都至少 `toast.error(简短)`（保留 402/429 的中文文案）。

### 3. Siri / Apple Intelligence 风格的等待动画（重点）
重写 `TechLoader`，纯 CSS + SVG，无新依赖，覆盖整张占位卡（16:10）。视觉关键词：液态、彩色光晕、玻璃磨砂、慢呼吸、迷幻。

层次（从下到上）：
1. **底层** 纯白偏冷的玻璃底 `bg-[oklch(0.99_0.01_270)]`，整卡 `backdrop-blur-xl`、内阴影 `inset 0 0 0 1px rgba(255,255,255,.6)`。
2. **流动彩色 blob 层**：两到三个绝对定位的圆形 `div`，半径 ≈ 65% 宽度，分别填充：
   - blob A：`radial-gradient(circle, #ff6ec7, transparent 60%)`（粉）
   - blob B：`radial-gradient(circle, #8a5cf6, transparent 60%)`（紫）
   - blob C：`radial-gradient(circle, #4cc9f0, transparent 60%)`（青）
   每个 blob `filter: blur(34px) saturate(140%)`，`mix-blend-mode: screen`，用不同 keyframes 在卡内做 8–10s 的椭圆轨迹漂移 + 1.05–1.15 缩放呼吸，时延错开。
3. **彩虹圈层（Siri 风核心）**：中心一个 `64×64` SVG，环形 `conic-gradient` 从粉→紫→蓝→青→粉 360°；外层 `filter: blur(8px)`，`animation: spin 6s linear infinite`，叠加一份未模糊的细环（`stroke-dasharray`）反向旋转 4s。整体 `drop-shadow: 0 0 20px rgba(170,120,255,.55)`。
4. **中心呼吸光点**：彩虹圈中心一个 `12×12` 白色圆，`box-shadow: 0 0 24px 6px rgba(255,255,255,.85)`，2s `opacity .6→1 → .6` 呼吸。
5. **细颗粒噪点**：很轻的 SVG noise 叠加 `opacity-[.06] mix-blend-overlay`，避免银幕感。
6. **底部说明**：`font-light tracking-[0.3em] text-[10px] text-foreground/55`，文案「Designing...」。

动画都放在组件内联 `<style>`：
- `@keyframes blob-a/b/c { 0%, 100% { transform } 50% { transform } }`（中心点+缩放微移）。
- `@keyframes siri-spin { to { transform: rotate(360deg) } }`
- `@keyframes siri-breathe { 50% { opacity: 1; transform: scale(1.12) } }`

整体感受：白色磨砂上漂着粉紫蓝的色彩云，中心一颗带光晕的彩虹小球缓慢转动并呼吸，比之前的「深色赛博网格 + 扫光」更接近 Apple Intelligence 的发布会动画。

### 4. 不改动
- AI 生图调用入口、数量输入、拖动排序、重新生成、确认插入逻辑。
- IntroTab 的 `handleAIComplete`、服务端鉴权和上传。
- 数据库 schema、其它弹窗。

## 文件清单
- 编辑：`src/lib/image-gen.server.ts`（按是否含参考图分派 OpenAI / Gemini）
- 编辑：`src/components/tuan/AIGenerateImageDialog.tsx`（错误可见化 + Siri 风 Loader）
