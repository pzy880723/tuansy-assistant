import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

const SkuSchema = z.object({
  name: z.string().describe("规格名，例如 1 斤装"),
  price: z.string().describe("价格字符串，元，保留 1 位小数，例如 19.9"),
  stock: z.string().describe("库存字符串，整数，例如 100"),
  original_price: z.string().optional().describe("划线价，可选"),
  image: z.string().optional().describe("规格图 URL，可选"),
  desc: z.string().optional().describe("规格说明，可选"),
});

const IntroBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("image_lg"), url: z.string().nullable().optional() }),
  z.object({ type: z.literal("image_sm"), urls: z.array(z.string()) }),
  z.object({ type: z.literal("video"), url: z.string().nullable().optional() }),
  
]);

function genBlockId() {
  return Math.random().toString(36).slice(2, 10);
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          messages?: UIMessage[];
          projectId?: string;
          snapshot?: unknown;
          copyLogicId?: string | null;
          startupMode?: "draft" | "plan";
        };
        if (!Array.isArray(body.messages) || !body.projectId) {
          return new Response("Bad request", { status: 400 });
        }

        const projectId = body.projectId;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { readSessionUserIdFromRequest } = await import("@/lib/auth-session.server");
        const userId = await readSessionUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });
        const { data: ownerRow } = await supabaseAdmin
          .from("projects")
          .select("owner_id")
          .eq("id", projectId)
          .maybeSingle();
        if (!ownerRow) return new Response("Project not found", { status: 404 });
        if (ownerRow.owner_id && ownerRow.owner_id !== userId) {
          return new Response("Forbidden", { status: 403 });
        }

        // Load fresh project state so the model sees the SAME data the preview renders.
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("name, intro, skus, settings, product")
          .eq("id", projectId)
          .maybeSingle();

        const product = (project?.product ?? {}) as Record<string, unknown>;
        const intro = (project?.intro ?? {}) as Record<string, unknown>;
        const skus = (project?.skus ?? []) as unknown[];
        const settings = (project?.settings ?? {}) as Record<string, unknown>;
        const category =
          ((product.category as string[] | undefined)?.[0]) ?? "未分类";

        // ---------- Resolve active copy logic ----------
        type LogicRow = {
          id: string;
          name: string;
          description: string | null;
          modules: Array<{ type: string; label: string; guidance: string }> | null;
          formatting: Record<string, unknown> | null;
          is_active: boolean;
        };
        let activeLogic: LogicRow | null = null;
        const presetPrefix = "preset:";
        if (body.copyLogicId && body.copyLogicId.startsWith(presetPrefix)) {
          const presetId = body.copyLogicId.slice(presetPrefix.length);
          const { data: preset } = await supabaseAdmin
            .from("preset_copy_logics")
            .select("id, name, description, modules, formatting, is_published")
            .eq("id", presetId)
            .eq("is_published", true)
            .maybeSingle();
          if (preset) {
            activeLogic = {
              id: preset.id,
              name: `${preset.name}（标准）`,
              description: preset.description,
              modules: preset.modules as LogicRow["modules"],
              formatting: (preset as { formatting?: unknown }).formatting as
                | Record<string, unknown>
                | null,
              is_active: true,
            };
          }
        }
        if (!activeLogic) {
          const { data: allLogics } = await supabaseAdmin
            .from("copy_logics")
            .select("id, name, description, modules, formatting, is_active")
            .eq("user_id", userId);
          const logics = (allLogics ?? []) as unknown as LogicRow[];
          if (body.copyLogicId) {
            activeLogic = logics.find((l) => l.id === body.copyLogicId) ?? null;
          }
          if (!activeLogic && logics.length > 0) {
            const fallback = logics.find((l) => l.is_active) ?? logics[0];
            if (logics.length === 1) {
              activeLogic = fallback;
            } else {
              try {
                const ids = logics.map((l) => l.id);
                const matcherGateway = createLovableAiGatewayProvider(key);
                const productTitle =
                  (product.title as string | undefined) ??
                  (project?.name as string | undefined) ??
                  "";
                const candidates = logics
                  .map(
                    (l, i) =>
                      `${i + 1}. id=${l.id} | 名称：${l.name} | 简介：${(l.description ?? "").slice(0, 200)} | 模块：${(l.modules ?? []).map((m) => m.label).join("/")}`,
                  )
                  .join("\n");
                const { Output: MatchOutput, generateText: matchGen } = await import("ai");
                const matched = await matchGen({
                  model: matcherGateway("google/gemini-3-flash-preview"),
                  output: MatchOutput.object({
                    schema: z.object({
                      id: z.enum(["__none__", ...ids] as [string, ...string[]]),
                    }),
                  }),
                  prompt: `从下列文案逻辑中挑一条最适合当前商品；都不匹配返回 __none__。\n商品品类：${category}\n商品标题：${productTitle}\n候选：\n${candidates}`,
                });
                const picked = (matched.output as { id?: string } | undefined)?.id;
                activeLogic =
                  picked && picked !== "__none__"
                    ? (logics.find((l) => l.id === picked) ?? fallback)
                    : fallback;
              } catch {
                activeLogic = fallback;
              }
            }
          }
        }

        const fmt = (activeLogic?.formatting ?? {}) as {
          paragraphMode?: "natural" | "one-sentence-per-line";
          lineGap?: 0 | 1 | 2;
          indentFirstLine?: boolean;
          tailBlankLines?: 0 | 1 | 2;
          emojiDensity?: "none" | "light" | "rich";
        };
        const fmtParaMode = fmt.paragraphMode ?? "natural";
        const fmtLineGap = fmt.lineGap ?? 1;
        const fmtIndent = fmt.indentFirstLine ?? false;
        const fmtTail = fmt.tailBlankLines ?? 0;
        const fmtEmoji = fmt.emojiDensity ?? "light";
        const formattingPromptBlock = activeLogic
          ? `\n【排版规则 — 写每个 text block 时严格执行】\n- 段落模式：${fmtParaMode === "one-sentence-per-line" ? "一句一段（句号/问号/感叹号后强制换行另起一段）" : "自然分段（按语义分段）"}\n- 段间空行：每段之间空 ${fmtLineGap} 个空白行（用 \\n${"\\n".repeat(fmtLineGap)} 拼接）\n- 首行缩进：${fmtIndent ? "每段首行加 2 个全角空格「　　」" : "不缩进"}\n- 尾部空行：整段文本最后追加 ${fmtTail} 个空行\n- Emoji 浓度：${fmtEmoji === "none" ? "禁止使用任何 emoji" : fmtEmoji === "light" ? "每段最多 1 个 emoji，仅在段首或句末点缀" : "标题和每段段首都可以放 emoji"}\n`
          : "";
        const logicPromptBlock = activeLogic
          ? `\n【当前启用文案逻辑：${activeLogic.name}】（用户在「设置 → 文案编辑逻辑」里定义）\n总纲：${activeLogic.description ?? ""}\n模块清单（必须严格按此顺序，每个模块产生一个 block，不可合并、不可跳过）：\n${(activeLogic.modules ?? [])
              .map(
                (m, i) =>
                  `${i + 1}. [${m.type}] ${m.label} — ${m.guidance || "（无额外要求）"}`,
              )
              .join("\n")}\n硬约束：本逻辑优先级高于下方通用五步法；冲突时以本逻辑为准。${formattingPromptBlock}`
          : "";

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        const isSeededStart = body.messages.length === 1 && body.messages[0]?.role === "user";
        const result = streamText({
          model,
          stopWhen: stepCountIs(50),
          system: `你是「团宝」，一只圆滚滚的橙色礼盒小精灵，是快团团团长的开团搭子。说话像真人助理一样自然、利落、有温度，不端架子、不寒暄。

当前项目: 「${project?.name ?? "未命名"}」
当前商品品类: ${category}
当前是否首次开团: ${isSeededStart ? "是" : "否"}
首页模式: ${body.startupMode === "plan" ? "计划模式" : "立即撰写"}

【右侧预览正在显示的真实数据，必须基于这个来改】
介绍 intro: ${JSON.stringify(intro, null, 2)}
SKU 列表 skus: ${JSON.stringify(skus, null, 2)}
设置 settings: ${JSON.stringify(settings, null, 2)}
商品元信息 product: ${JSON.stringify(product, null, 2)}

按品类撰写重点（根据上面的品类挑对应那一行）：
水果生鲜：产地、采摘时间、净重斤数、保鲜/冷链方式、坏果包赔
零食烘焙：保质期、配料表、口味档位、独立小包装
服饰鞋包：面料、尺码表、版型、洗涤说明、模特身高参考
美妆个护：核心成分、功效、适用肤质、备案/资质
家居日用：材质、尺寸、使用场景、保修
母婴儿童：适用年龄段、安全认证、材质安全性
其他：突出最强卖点和差异化
${logicPromptBlock}
【文案五步转化框架 — 写 title/description/blocks 时必须遵守】
核心理念：不是推销产品，而是激发购买欲望。整条逻辑链：吸引眼球 → 引发共鸣 → 建立信任 → 激发欲望 → 促成下单。

第 1 步 强力吸睛标题（写入 intro.title，10-20 字）
  公式 = 情绪/痛点 emoji（🔥💥绝了爽飞了闭眼入）+ 核心卖点（材质/版型/效果）+ 利益点（清仓/骨折价/赠品/限时）+ 人群标签（宝妈/梨形/打工人）
  反例：只写"商品名称"。正例：🔥再生纤维气球裤·显瘦闭眼入·梨形必备

第 2 步 痛点共鸣开篇（写入 intro.description 第 1 段）
  从"我懂你"切入，列举 1-2 个用户日常具体尴尬/不满，然后一句话抛出产品作为"救星"，再升华到一种生活方式。

第 3 步 品牌故事 / 背书（description 第 2 段）
  给低价或好品质一个合理理由：品牌光环、设计师理念、工厂背景、质检承诺，让用户消除"便宜没好货"的顾虑。

第 4 步 深度卖点拆解（description 第 3-N 段，3-4 段，每段 1 个核心卖点）
  分块阐述（面料 / 版型 / 设计 / 工艺 / 场景），多用感官词（丝滑、软糯、垂坠感、奶香、果香），结合具体生活场景（出汗不粘腿、遮大肚子、通勤即穿）。

第 5 步 款式与参数详解（description 末段或独立 text block）
  颜色性格化（黑色显瘦、卡其气质、米白温柔）+ 详细尺码/规格表 + 防掉坑提示（"卡码拍大一码"等专业建议）。

description 整体要求：四到六个自然段，覆盖第 2-5 步，纯文本无 Markdown，120-300 字（卖点多可放宽到 500 字）。

【首次开团的真人感工作流】
- 如果当前是首次开团且为计划模式：不要修改项目。先复述你看懂的商品/品类/用户目标，再调用 ask_questions 提 3-4 个关键问题，最后调用 suggest_next。
- 如果当前是首次开团且为立即撰写：先用 2-3 句复述你看懂的项目、品类、用户原文要点、当前文案逻辑以及是否带图；再说一句「我先理一下这次的文案节奏」，然后开始调用工具。
- 首次立即撰写必须渐进完成：先单独调用 update_intro 只写 title 和不超过 60 字的 description；随后严格按模块顺序，每个模块单独调用一次 update_intro，只传一个 blocksAppend 元素。每次工具调用前先用一句自然的过程说明，例如「先把痛点说透」「接着补上品质背书」。
- 禁止一次调用塞入全部 blocks。即使多个模块都已想好，也必须逐模块调用，让用户在右侧看到段落逐个出现。
- 所有模块完成后，用一句话总结本版的核心转化角度；再给 3 条带中文编号的、针对当前商品的调整建议，并问用户想先改哪一项；最后调用 suggest_next 给出 3-4 个可直接点击的调整指令。
- 后续对话优先微调已有段落，不要无故整篇重写。

【图文配对工作流 — 模块化优先，两阶段】

阶段 A：用户只丢文字/口头描述（聊天没有图片附件）
  1) 立刻开始渐进撰写，按当前文案逻辑模块清单顺序逐一产出，每个模块必须单独调用 update_intro 的 blocksAppend：
     - 每个 [title] / [paragraph] / [params] 模块 → 生成一个 type:"text" 的 block，内容严格按对应 guidance 撰写，并完全套用上面【排版规则】（分段、空行、首行缩进、emoji 浓度）。
     - 每个 [image_large] 模块 → 插入一个 type:"text" 占位 block，固定格式：「[图位·大图建议：xxx]」（xxx 描述此处应放什么图，例如：模特正面上身实拍）。
     - 每个 [image_grid] 模块 → 插入 type:"text" 占位 block：「[图位·九宫格建议：xxx]」。
     - 每个 [video] 模块 → 插入 type:"text" 占位 block：「[图位·视频建议：xxx]」。
  2) intro.title 仍要按第 1 步公式写好；intro.description 只写 1-2 句封面摘要（≤60 字），正文全部承载在 blocks 里。
  3) 全部完成后告诉用户「已按 X 个模块分好段落，预留了 N 个图位」，再总结和给 3 条调整建议。
  4) 没有启用任何文案逻辑时，也必须按默认五步框架渐进生成：痛点共鸣、品质背书、卖点拆解、场景体验、参数/下单建议各自成为独立 text block，每段单独调用一次 blocksAppend。

阶段 B：用户后续丢图片进来（聊天里有 file part）
  1) 读现有 intro.blocks，找出所有「[图位·...]」占位 text block，按图片语义把它们替换为 image_lg / image_sm / video block：
     - 商品全景/模特上身 → 卖点段或款式段后的图位
     - 细节/材质特写 → 面料/工艺段后的图位
     - 对比/痛点场景 → 痛点段后的图位
     - 尺码表/参数 → 末段图位
  2) 同段 1 张用 image_lg；同段 ≥3 张合并成 1 个 image_sm 九宫格 block 替换原占位。
   3) 调用 update_intro 的 blocksReplaceAt 原地替换对应索引。严禁把图堆在结尾，也不要重写其他文字块。
  4) 占位用完后还有多余图，按语义补到最相关段落后；判断不出归属时调 ask_questions 让用户选。
  5) 没有启用文案逻辑时，沿用旧的"文字-图交替穿插"重排逻辑。

回复风格（务必遵守）：
- 全程纯文本中文，禁止使用任何 Markdown 符号（不要出现 *、**、#、- 列表、反引号、表格语法）
- 聊天回复控制在 3 到 8 行内，简洁、像真人助理一样说话
- 写入 blocks 的每个 text 段落必须是完整内容，禁止只写一句话占位（图位除外，图位就用规定格式）
- 不寒暄、不重复用户的话、不要"好的，我来帮你..."这种开场
- 自称"团宝"，不要说"AI"或"助手"

工作原则（极其重要 — 工具必须对应右侧预览的字段）：
- 团购活动标题（短，10-20 字）→ update_intro 的 title
- 团购正文/卖点描述（长段落 120-300 字）→ update_intro 的 description；不要把整段塞到 title
- 图文模块 blocks：首次阶段 A 按逻辑逐模块使用 blocksAppend；阶段 B 用 blocksReplaceAt；只有用户明确要求整体重排时才传 blocks
- 改 SKU（增、删、改价格/库存/规格名）→ update_skus，必须传完整的 SKU 数组
- 改配送、起团、保障、自提、截团时间等设置项 → update_settings
- 改商品标题、副标题、服务标签、封面 → update_product_meta
- 不要把所有改动都塞进 update_product_meta；不同 Tab 的数据走不同工具
- 用户描述意图时，主动调用工具修改预览，不要只是回复文字
- 修改后用一句中文简短确认所做改动
- 价格保留 1 位小数，库存为整数字符串
- 不确定时主动询问用户


询问用户信息时（极其重要）：
- 一次需要确认 2 个及以上信息时，必须调用 ask_questions 工具发出问卷，禁止把多个问题塞进一段文字里
- 每个问题给 2 到 5 个最常见的候选选项，让用户点选；问题文案精简到 20 字内
- 单个开放性问题（比如让用户描述卖点）可以直接用一句话问
- 调用 ask_questions 时，不要再额外用文字重复同样的问题

每次回复结束前，必须调用一次 suggest_next 工具，给出 2 到 4 条用户下一步最可能想做的短指令（每条不超过 18 个汉字，必须能直接当作下一条用户消息发送）。`,

          messages: await convertToModelMessages(body.messages),
          tools: {
            update_intro: tool({
              description:
                "渐进更新介绍 Tab。首次撰写先写 title/description，再按模块逐次用 blocksAppend 追加一个段落；图片用 blocksReplaceAt 原地替换；blocks 仅用于用户明确要求整体重排。",
              inputSchema: z.object({
                title: z
                  .string()
                  .describe("团购活动主标题，简短有力，10-20 字，可选")
                  .optional(),
                description: z
                  .string()
                  .describe(
                    "团购活动封面摘要。首次渐进撰写时只写 1-2 句且不超过 60 字，正文放在逐次追加的 blocks 中；仅旧项目整体修改时可写 120-300 字完整版。",
                  )
                  .optional(),
                blocks: z
                  .array(IntroBlockSchema)
                  .describe(
                    "图文模块数组，整体替换。仅当用户明确要求整体重排时使用。",
                  )
                  .optional(),
                blocksAppend: z
                  .array(IntroBlockSchema)
                  .max(1)
                  .describe("渐进追加一个模块。首次撰写每次必须只传一个元素。")
                  .optional(),
                blocksReplaceAt: z
                  .array(
                    z.object({
                      index: z.number().int().min(0),
                      block: IntroBlockSchema,
                    }),
                  )
                  .describe("按索引原地替换图位，不改动其他模块。")
                  .optional(),
              }),
              execute: async (input) => {
                const { data: freshRow, error: readError } = await supabaseAdmin
                  .from("projects")
                  .select("intro")
                  .eq("id", projectId)
                  .maybeSingle();
                if (readError) return { ok: false, error: readError.message };
                const freshIntro = (freshRow?.intro ?? {}) as Record<string, unknown>;
                const currentBlocks = Array.isArray(freshIntro.blocks)
                  ? ([...freshIntro.blocks] as Array<Record<string, unknown>>)
                  : [];
                const { blocksAppend, blocksReplaceAt, ...fields } = input;
                const patch: Record<string, unknown> = { ...fields };
                if (Array.isArray(input.blocks)) {
                  patch.blocks = input.blocks.map((b) => ({ id: genBlockId(), ...b }));
                } else {
                  let nextBlocks = currentBlocks;
                  if (blocksAppend?.length) {
                    nextBlocks = [
                      ...nextBlocks,
                      ...blocksAppend.map((b) => ({ id: genBlockId(), ...b })),
                    ];
                  }
                  for (const replacement of blocksReplaceAt ?? []) {
                    if (replacement.index < nextBlocks.length) {
                      nextBlocks[replacement.index] = {
                        id: genBlockId(),
                        ...replacement.block,
                      };
                    }
                  }
                  if (blocksAppend?.length || blocksReplaceAt?.length) patch.blocks = nextBlocks;
                }
                const next = { ...freshIntro, ...patch };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ intro: next as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return {
                  ok: true,
                  updated: Object.keys(input),
                  blockCount: Array.isArray(next.blocks) ? next.blocks.length : currentBlocks.length,
                };
              },
            }),
            update_skus: tool({
              description:
                "整体替换 SKU 列表（顶层 skus 列，预览的商品 Tab 直接读这里）。传完整的 SKU 数组，每项至少包含 name、price、stock。",
              inputSchema: z.object({
                skus: z.array(SkuSchema).min(1).describe("完整的 SKU 数组"),
              }),
              execute: async ({ skus: nextSkus }) => {
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ skus: nextSkus })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, count: nextSkus.length };
              },
            }),
            update_settings: tool({
              description:
                "更新设置 Tab 的字段（配送方式、起团件数、截团时间、保障、自提点、发货时效等）。只传要改的 key，做浅合并。",
              inputSchema: z.object({
                patch: z
                  .record(z.string(), z.unknown())
                  .describe("要合并进 settings 的 key-value，例如 { min_order: '10', delivery: '包邮' }"),
              }),
              execute: async ({ patch }) => {
                const next = { ...settings, ...patch } as Record<string, unknown>;
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ settings: next as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, updated: Object.keys(patch) };
              },
            }),
            update_product_meta: tool({
              description:
                "更新商品元信息（标题、副标题、服务标签、封面图等），写入 product 列，做浅合并。不要在这里改 SKU。",
              inputSchema: z.object({
                title: z.string().describe("新的商品标题，可选").optional(),
                subtitle: z.string().describe("新的副标题/卖点行，可选").optional(),
                tags: z
                  .array(z.string())
                  .describe("服务标签数组，可选，会整体替换")
                  .optional(),
                cover: z.string().describe("封面图 URL，可选").optional(),
              }),
              execute: async (input) => {
                const next = { ...product, ...input };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ product: next })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, updated: Object.keys(input) };
              },
            }),
            ask_questions: tool({
              description:
                "需要向用户确认 2 个及以上信息时必须调用，禁止把多个问题塞进文字回复里。每个问题给 2-5 个常见候选选项，用户点击即可作答。",
              inputSchema: z.object({
                intro: z
                  .string()
                  .max(40)
                  .describe("一句话说明为什么要问，例如：先确认几个细节我好写文案"),
                questions: z
                  .array(
                    z.object({
                      id: z.string().describe("简短英文/拼音 id，例如 audience"),
                      question: z.string().max(40).describe("问题文案，20 字内"),
                      multi: z.boolean().describe("是否多选，默认 false"),
                      options: z.array(z.string().max(20)).min(2).max(5),
                      allow_other: z.boolean().describe("是否允许用户填写其他，默认 true"),
                    }),
                  )
                  .min(1)
                  .max(4),
              }),
              execute: async (input) => ({ ok: true, ...input }),
            }),
            generate_product_images: tool({
              description:
                "根据中文场景描述用 AI 生成商品配图（1-9 张），自动插入到介绍 blocks 中。用户说『给我配图/生成图片/做几张场景图』时调用。referenceImages 传聊天中用户已上传的图 URL，可让 AI 保持商品一致性。",
              inputSchema: z.object({
                prompt: z
                  .string()
                  .min(2)
                  .max(800)
                  .describe("中文场景描述，越具体越好，例如『清晨阳光下的草莓园特写，水珠晶莹』"),
                count: z
                  .number()
                  .int()
                  .min(1)
                  .max(9)
                  .describe("生成张数，建议 1/3/6/9，单图用 image_lg，多图用 image_sm 九宫格"),
                referenceImages: z
                  .array(z.string().url())
                  .max(3)
                  .optional()
                  .describe("参考图 URL 数组，可让 AI 保持商品外观一致；通常传用户在聊天中上传的图"),
              }),
              execute: async ({ prompt, count, referenceImages }) => {
                try {
                  const { generateImagesBatch, uploadGeneratedImage } = await import(
                    "@/lib/image-gen.server"
                  );
                  const b64s = await generateImagesBatch(
                    key,
                    { prompt, referenceImages },
                    count,
                  );
                  const urls = await Promise.all(
                    b64s.map((b) => uploadGeneratedImage(b, userId, projectId)),
                  );
                  if (urls.length === 0) return { ok: false, error: "没有生成任何图片" };

                  // Append a new block to intro.blocks
                  const currentBlocks = Array.isArray((intro as { blocks?: unknown }).blocks)
                    ? ((intro as { blocks?: unknown[] }).blocks as Array<Record<string, unknown>>)
                    : [];
                  const newBlock =
                    urls.length === 1
                      ? { id: genBlockId(), type: "image_lg" as const, url: urls[0] }
                      : { id: genBlockId(), type: "image_sm" as const, urls: urls.slice(0, 9) };
                  const nextIntro = { ...intro, blocks: [...currentBlocks, newBlock] };
                  const { error } = await supabaseAdmin
                    .from("projects")
                    .update({ intro: nextIntro as never })
                    .eq("id", projectId);
                  if (error) return { ok: false, error: error.message };
                  return { ok: true, urls, count: urls.length };
                } catch (e) {
                  return { ok: false, error: (e as Error).message };
                }
              },
            }),
            suggest_next: tool({
              description:
                "在回复末尾给出 2 到 4 条用户下一步可能想做的快速操作建议，每条不超过 18 个汉字。每次回复都要调用一次。",
              inputSchema: z.object({
                suggestions: z.array(z.string().min(2).max(24)).min(2).max(4),
              }),
              execute: async ({ suggestions }) => ({ ok: true, suggestions }),
            }),
          },
        });

        const response = result.toUIMessageStreamResponse({
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { [LOVABLE_AIG_RUN_ID_HEADER]: initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
