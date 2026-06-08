
## 目标

1. 去掉"AI / AI 对话"字眼，全面替换为拟人化的"团宝"形象（含头像、名字、口吻）。
2. 团宝问问题时不再把 4 个问题挤在一段话里，而是渲染成可点选的问卷卡片，用户点完选项后点"确认"再发送，参考 Lovable 计划模式的体验。

---

## 1. 团宝形象设计

- 生成一只品牌吉祥物头像（橙色暖色调，与现有 brand 色一致）：
  - 形象：一个圆滚滚的"礼盒/快递包裹"小人，头顶蝴蝶结手柄、脸颊有腮红、笑眼，手里抱着一个小价签，整体扁平矢量风，干净白底。
  - 文件：`src/assets/tuanbao-avatar.png`（透明背景 PNG，512×512，premium 质量保证细节）。
- 在以下位置用团宝头像替换原本的 `AI` 圆圈 / `Sparkles` 图标：
  - `src/routes/app.project.$id.tsx` 聊天面板顶栏（397 行附近的"AI 对话" → "团宝"）。
  - `MessageRow` 里 assistant 一侧的头像（原"AI"两字圆圈）。
  - `src/routes/index.tsx` 首页 hero 的角色出场处（若有 AI 字样的徽章）。
  - 浏览器 favicon 暂不动（成本与范围控制）。
- 文案口吻调整（仅前端展示文本，不动业务）：
  - "AI 对话" → "和团宝聊聊"
  - "AI 正在思考" → "团宝在想…"
  - "AI 驱动的…" 等首页/工作台副标题里的"AI"统一替换为"团宝"（保留 SEO 关键词的 meta title 不变，避免影响搜索）。

## 2. 问卷式提问（核心交互改造）

### 体验目标
团宝在需要补充信息时，不再输出一段把 4 个问题串在一起的文字，而是发出一张"问卷卡片"：
- 每个问题独立成行；
- 每题给 3–5 个常见选项（多选/单选由问题决定），并允许"其他（填写）"；
- 卡片底部一个主按钮「确认并发送」+ 次按钮「跳过」；
- 用户点确认后，把"问题 → 选择"汇总成一条用户消息回给团宝，团宝据此继续。

### 后端：新增 `ask_questions` 工具

在 `src/routes/api/chat.ts` 的 `tools` 中新增：

```ts
ask_questions: tool({
  description:
    "当需要向用户确认多个信息时调用，不要把多个问题塞进一段文字里。每次最多 4 个问题，每个问题给 2-5 个候选选项。",
  inputSchema: z.object({
    intro: z.string().max(40).describe("一句话说明为什么要问，例如：先确认几个细节，我好写文案"),
    questions: z.array(z.object({
      id: z.string(),
      question: z.string().max(40),
      multi: z.boolean().default(false),
      options: z.array(z.string().max(20)).min(2).max(5),
      allowOther: z.boolean().default(true),
    })).min(1).max(4),
  }),
  execute: async (input) => ({ ok: true, ...input }),
}),
```

并在 system prompt 里追加规则：
- "当需要向用户确认 2 个及以上信息时，必须调用 `ask_questions`，禁止把多个问题写在文字回复里。"
- "单个开放性问题可以直接用文字问。"

### 前端：渲染问卷卡片

在 `src/routes/app.project.$id.tsx` 的 `MessageRow` 内，遍历 `message.parts` 时：
- 识别 `type === 'tool-ask_questions'` 且 `state === 'output-available'` 的 part。
- 渲染一个 `<QuestionnaireCard>`（新建组件，放同文件或 `src/components/chat/questionnaire-card.tsx`）：
  - 顶部一行 `intro` 文案 + 团宝小头像。
  - 每个问题一个 block：标题 + 选项 chips（单选高亮一项，多选可选多项），末尾可选 `+ 其他`（点开变 input）。
  - 底部：`确认并发送` / `跳过` 两个按钮。
- 卡片维护本地 state（answers map）。点"确认"时：
  - 把回答拼成一段中文文本，例如：
    ```
    1. 核心客群：通勤白领
    2. 材质：真皮 / 内里隔层
    3. 团购价：200–300
    4. 发货：3 天内、顺丰
    ```
  - 调 `sendText(...)` 作为新的用户消息发出。
  - 卡片切换为"已提交"只读态，禁止重复点。
- 已答过的卡片重新挂载（如刷新历史）时，从 `tool` part 的 `result`/UI state 还原只读态即可（简单做法：本地用 `useState` 标记已发送的 questionId 集合，仅区分"未提交/已提交"两态）。

### 配套清理
- 移除 `ChatEmpty` 与首屏建议里类似"帮我想几个问题问我"这种鼓励团宝写长问句的引导。
- `suggestions`（`suggest_next`）保持不变，问卷与建议并存：问卷在回复主体里，建议在输入框上方。

---

## 技术细节速览

| 改动 | 文件 |
| --- | --- |
| 生成团宝头像 | `src/assets/tuanbao-avatar.png`（新增，imagegen premium） |
| 顶栏 / Assistant 头像 / 文案 | `src/routes/app.project.$id.tsx` |
| 首页与工作台对外文案 | `src/routes/index.tsx`、`src/routes/app.index.tsx`、`src/routes/app.tsx` |
| 新 `ask_questions` 工具 + system prompt | `src/routes/api/chat.ts` |
| 问卷卡片组件 | `src/components/chat/questionnaire-card.tsx`（新增） |

不涉及数据库迁移，不动 `convertToModelMessages` 流程，AI SDK 工具 part 已天然走 `message.parts`，前端无需新协议。

---

## 不在本次范围

- 不改 SEO 用的 page title / meta（仍保留"团宝助手 — AI 驱动…"，避免搜索流量回退）。
- 不调整聊天历史持久化结构。
- 不重做首页整体视觉，只替换 AI 相关词与角色出场处。
