## 目标
1. 团宝写文案时，不再把全部内容塞进一个 `description`，而是按当前启用的文案逻辑「模块清单」逐段生成，每段写成独立的 text block。
2. 用户没传图 → 先生成所有文字 block，并为每段预留"图位占位"（建议配图类型）。用户后续丢图 → 智能放到对应段后面，不再堆末尾。
3. 在文案逻辑里加「排版预设」（一句一段 / 段间空行 / 首行缩进 / 尾部留白等），保存后团宝写文案时自动套用，不用每次口头交代。

## 改动一：文案逻辑数据加排版字段

`copy_logics` 表 + `preset_copy_logics` 表新增 `formatting jsonb`，结构：
```
{ paragraphMode: 'natural'|'one-sentence-per-line',
  lineGap: 0|1|2,                  // 段间空行数
  indentFirstLine: boolean,         // 首行缩进两格
  tailBlankLines: 0|1|2,            // 尾部空行
  emojiDensity: 'none'|'light'|'rich' }
```
默认 `{ paragraphMode:'natural', lineGap:1, indentFirstLine:false, tailBlankLines:0, emojiDensity:'light' }`。

## 改动二：编辑器 UI（`CopyLogicEditor.tsx`）

在「模块清单」上方加一块「排版预设」折叠面板：
- 段落模式：自然分段 / 一句一段
- 段间空行：0 / 1 / 2 行
- 首行缩进：开关
- 尾部空行：0 / 1 / 2 行
- Emoji 浓度：无 / 适量 / 丰富
变更通过 `onChange` 跟现有 name/description/modules 一起 emit。

## 改动三：聊天 API 系统提示重写（`src/routes/api/chat.ts`）

把现有"阶段 A / 阶段 B"段升级为「模块化优先」工作流：

阶段 A（无图）：
- 立刻调用 `update_intro`，**`blocks` 必传**，按文案逻辑模块清单顺序，每个 `paragraph` / `title` 模块生成一个 `type:'text'` block（套用排版预设：分段、空行、缩进、emoji）。
- 对每个 `image_large` / `image_grid` / `video` 模块，插入一个 `type:'text'` 占位 block，文字格式固定：`[图位·大图建议：xxx]`，方便后续替换。
- `description` 只填 1-2 句封面摘要，正文由 blocks 承载。
- 聊天回复 3-5 行说明"已分好 N 段，等你丢图我自动塞进对应位置"。

阶段 B（用户上传图片）：
- 找到对应的 `[图位·...]` 占位 block，替换为 `image_lg` / `image_sm`；找不到时按段落语义匹配（材质特写 → 面料段后；模特图 → 款式段后）。
- 严禁堆末尾；多张同段图自动合并为 `image_sm` 九宫格。

排版预设传给 prompt：在 `logicPromptBlock` 后追加一段 "【排版规则】…"，把当前 `formatting` 翻译成中文硬约束（如"每段之间空 1 行""首行缩进 2 个全角空格""每段最多 1 个 emoji"）。

## 改动四：迁移 SQL

```sql
alter table public.copy_logics
  add column if not exists formatting jsonb not null default '{}'::jsonb;
alter table public.preset_copy_logics
  add column if not exists formatting jsonb not null default '{}'::jsonb;
```

## 不改的内容
- 表结构其它字段、RLS、grants、模块 schema、生成模块清单的 AI 流程、AI 生图工具。
- `IntroTab` 拖动 / 缩略图层级 / 大图小图切换。
- 其它 tab、设置项、auth。

## 验收
- 在「文案逻辑」编辑页能看到并保存「排版预设」。
- 仅发"帮我写文案"且无图 → 预览的 intro blocks 立刻按模块拆成多段文字 + `[图位·…]` 占位。
- 之后上传 1-3 张图 → 占位被自动替换，没有图堆末尾。
- 切换不同文案逻辑（不同 formatting）→ 重新写文案时排版（空行/缩进/emoji）随之变化。
