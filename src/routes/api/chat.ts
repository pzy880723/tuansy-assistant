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
          is_active: boolean;
        };
        let activeLogic: LogicRow | null = null;
        const { data: allLogics } = await supabaseAdmin
          .from("copy_logics")
          .select("id, name, description, modules, is_active")
          .eq("user_id", userId);
        const logics = (allLogics ?? []) as LogicRow[];
        if (body.copyLogicId) {
          activeLogic = logics.find((l) => l.id === body.copyLogicId) ?? null;
        } else if (logics.length > 0) {
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
                experimental_output: MatchOutput.object({
                  schema: z.object({
                    id: z.enum(["__none__", ...ids] as [string, ...string[]]),
                  }),
                }),
                prompt: `从下列文案逻辑中挑一条最适合当前商品；都不匹配返回 __none__。\n商品品类：${category}\n商品标题：${productTitle}\n候选：\n${candidates}`,
              });
              const picked = (matched as { experimental_output?: { id?: string } })
                .experimental_output?.id;
              activeLogic =
                picked && picked !== "__none__"
                  ? (logics.find((l) => l.id === picked) ?? fallback)
                  : fallback;
            } catch {
              activeLogic = fallback;
            }
          }
        }

        const logicPromptBlock = activeLogic
          ? `\n【当前启用文案逻辑：${activeLogic.name}】（用户在「设置 → 文案编辑逻辑」里定义）\n总纲：${activeLogic.description ?? ""}\n模块清单（写 intro.title/description/blocks 时必须按此顺序逐段输出；每段必须满足对应 guidance）：\n${(activeLogic.modules ?? [])
              .map(
                (m, i) =>
                  `${i + 1}. [${m.type}] ${m.label} — ${m.guidance || "（无额外要求）"}`,
              )
              .join("\n")}\n硬约束：本逻辑优先级高于下方通用五步法；冲突时以本逻辑为准。\n`
          : "";

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          stopWhen: stepCountIs(50),
          system: `你是「团宝」，一只圆滚滚的橙色礼盒小精灵，是快团团团长的开团搭子。说话像真人助理一样自然、利落、有温度，不端架子、不寒暄。

当前项目: 「${project?.name ?? "未命名"}」
当前商品品类: ${category}

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

【图文配对工作流 — 两阶段，必须严格区分】

阶段 A：用户只丢文字/口头描述（还没图）
  1) 立刻按五步框架用 update_intro 写好 title + description 完整版
  2) 在聊天回复里给出"图文骨架建议"，用纯文本编号列出每段标题以及该段建议配什么类型的图（例：① 痛点段 → 建议放对比场景图；② 卖点段·面料 → 建议九宫格细节图；③ 款式段 → 建议色卡平铺图）
  3) 此阶段绝对不要主动调用 update_intro 传 blocks，等用户补图

阶段 B：用户后续丢图片进来（聊天里有 file part）
  1) 看图判断对应骨架里的哪一段：商品全景/模特上身 → 卖点段或款式段；细节/材质特写 → 面料段；对比/痛点场景 → 痛点段；尺码表/参数 → 末段
  2) 立刻调用 update_intro 把 blocks 整体重排：让结构变成「文字 block → 该段对应的图片 block(s) → 下一段文字 block → 对应图片 block(s)」，文字与图交替穿插
  3) 单张配图用 image_lg；同段 ≥3 张用 image_sm 九宫格；视频用 video
  4) 严禁把所有图堆在末尾，必须语义化插入对应段落之间
  5) 如果用户没说图属于哪段、你也判断不出来，调 ask_questions 让用户选

回复风格（务必遵守）：
- 全程纯文本中文，禁止使用任何 Markdown 符号（不要出现 *、**、#、- 列表、反引号、表格语法）
- 聊天回复控制在 3 到 8 行内，简洁、像真人助理一样说话；给"图文骨架建议"时可适当展开到 10 行内
- 但写入预览的正文 description 必须是完整段落（覆盖五步法第 2-5 步），禁止只写一句话
- 不寒暄、不重复用户的话、不要"好的，我来帮你..."这种开场
- 自称"团宝"，不要说"AI"或"助手"

工作原则（极其重要 — 工具必须对应右侧预览的字段）：
- 团购活动标题（短，10-20 字）→ update_intro 的 title
- 团购正文/卖点描述（长段落 120-300 字）→ update_intro 的 description；不要把整段塞到 title
- 图文模块 blocks：阶段 A 不主动加；阶段 B（用户上传图片）或用户明确说"加张大图/加段文字/加九宫格"时，必须用 update_intro 传 blocks
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
                "更新介绍 Tab 内容。只传需要修改的字段；blocks 若传则整体替换。注意：blocks 默认由用户在右侧手动点按钮添加，AI 只在用户明确要求时才传。",
              inputSchema: z.object({
                title: z
                  .string()
                  .describe("团购活动主标题，简短有力，10-20 字，可选")
                  .optional(),
                description: z
                  .string()
                  .describe(
                    "团购活动正文卖点描述。必须写成完整段落，120-300 字，分 2-4 个自然段，结合品类要点突出卖点（产地/口感/适用人群/保障等）。禁止只写一句话。可选。",
                  )
                  .optional(),
                blocks: z
                  .array(IntroBlockSchema)
                  .describe(
                    "图文模块数组，整体替换。仅当用户明确要求添加大图/小图九宫格/视频/文字段落/标签时才传；默认留空不动。",
                  )
                  .optional(),
              }),
              execute: async (input) => {
                const patch: Record<string, unknown> = { ...input };
                if (Array.isArray(input.blocks)) {
                  patch.blocks = input.blocks.map((b) => ({ id: genBlockId(), ...b }));
                }
                const next = { ...intro, ...patch };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ intro: next as never })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, updated: Object.keys(input) };
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
