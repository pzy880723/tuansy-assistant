## 目标
1. AI 回复不要出现 Markdown 星号（`**`、`*`），整体排版更干净。
2. 每次回复结束后，在输入框上方智能展示 2–4 个"快速点击"建议，点击即填入或直接发送。

## 改造方案

### 1. 系统提示词改写（src/routes/api/chat.ts）
重写 system prompt，明确要求：
- 用纯文本中文，不使用 Markdown 语法（`*`、`**`、`#`、`-` 列表等）
- 多条信息用"一、二、三"或换行分段
- 控制在 3–6 行内，结尾不寒暄
- 每次回复都必须调用 `suggest_next` 工具，给出 2–4 条用户下一步可能想做的短指令（每条 ≤ 18 字，可直接当下一条用户消息）

### 2. 新增工具 `suggest_next`
在 chat.ts tools 中加入：
```ts
suggest_next: tool({
  description: "在回复末尾给出用户下一步可能想做的快速操作建议",
  inputSchema: z.object({
    suggestions: z.array(z.string().min(2).max(24)).min(2).max(4),
  }),
  execute: async ({ suggestions }) => ({ ok: true, suggestions }),
}),
```
工具不修改数据，只把建议作为 tool 结果回传到前端。

### 3. 前端读取建议（src/routes/app.project.$id.tsx）
- 从 `messages` 中找最后一条 assistant 消息的 `tool-suggest_next` part，取其 `output.suggestions`。
- 仅当 `status === 'ready'`（流结束）且建议存在时显示。
- 在输入框上方新增一行 chips：
  ```
  [建议1] [建议2] [建议3]
  ```
  点击 chip → 直接 `sendMessage({ text: chip })`（沿用 send() 的快照逻辑）。
- 在 `MessageRow` 的 `ToolCard` 渲染里隐藏 `suggest_next` 工具卡（它不是用户关心的操作）。

### 4. 样式
- chips：圆角、浅底、悬浮高亮，与现有橙色品牌色一致。
- 移除/兼容 assistant 文本中可能残留的 `**`：在渲染前简单 strip 一次（`text.replace(/\*\*?/g, '')`），双保险。

## 涉及文件
- src/routes/api/chat.ts（prompt + 新工具）
- src/routes/app.project.$id.tsx（chips UI、隐藏 suggest_next 工具卡、文本清理）