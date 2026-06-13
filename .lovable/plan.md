## 改动 1：工具卡用自然语言描述过程，不再露 `generate_product_images` 这种内部名

`src/routes/app.project.$id.tsx` 的 `ToolCard`（约 936 行）目前对未知工具直接显示原始 `name`，而且只有 update_intro 有人话描述。改为：

- 给每个工具定义「正在/已完成/失败」三态文案，按 `part.state` 选用：
  - `generate_product_images`：执行中 → 「正在分析需求并生成商品图片…」；已完成 → 「已生成 X 张商品图片」；失败 → 「商品图片生成失败」
  - `update_intro`：执行中 → 「正在改写介绍文案…」；已完成沿用现在的「✍️ 标题改为…；新增段落…」摘要；失败 → 「介绍更新失败」
  - `update_product` / `update_skus` / `remember_preference` / `suggest_next`：分别给中文「正在更新商品信息 / 正在调整 SKU / 正在记录你的偏好 / 正在思考下一步建议」等
  - 未识别的工具回退「正在执行 {中文工具名 fallback}」而不是露英文 ID
- 右上角状态徽标同步：执行中显「分析中…」，完成显「已应用」，失败显「失败」（保持现有）
- 折叠详情区在执行中也展示一行「正在阅读上下文 → 生成内容 → 写入预览」的进度说明，让等待时有反馈

不动后端工具名，纯前端展示层。

## 改动 2：修掉预设建议尾部多余的「回」

来源：`src/routes/api/chat.ts` 的 `suggest_next` 工具（约 758 行），模型偶尔会把建议写成「生成面料细节的特写图回」「再来一张回」——是模型把「回复 / 一回」尾巴漏出来。两处一起改：

- 收紧 `suggest_next` 的 description：要求每条必须是「动词开头的祈使短语」，禁止以「回 / 回复 / 吧 / 啦 / 哦 / 喔」等语气助词或残缺字结尾，给 1–2 个好/坏示例。
- 前端兜底：在 `app.project.$id.tsx` 拿到 `suggestions` 后，剥掉结尾的 `回 / 回复 / 吧 / 啦 / 喔 / 哦 / 呢 / 啊 / 。 / ！` 再渲染，避免模型再犯也不影响用户。

## 影响范围

只动两个文件：`src/routes/app.project.$id.tsx`（ToolCard 文案 + suggestions 清洗）、`src/routes/api/chat.ts`（suggest_next 描述）。不改数据库、不改其他工具行为、不影响文案逻辑/记忆/@mention。
