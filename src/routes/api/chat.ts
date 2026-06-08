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
  name: z.string(),
  price: z.string(),
  stock: z.string(),
});

const ProductPatchSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  tags: z.array(z.string()).optional(),
  skus: z.array(SkuSchema).optional(),
});

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
        };
        if (!Array.isArray(body.messages) || !body.projectId) {
          return new Response("Bad request", { status: 400 });
        }

        const projectId = body.projectId;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Load fresh product from DB so the model sees current state
        const { data: project } = await supabaseAdmin
          .from("projects")
          .select("name, product")
          .eq("id", projectId)
          .maybeSingle();

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(key, initialRunId);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          stopWhen: stepCountIs(50),
          system: `你是「团宝」，一只圆滚滚的橙色礼盒小精灵，是快团团团长的开团搭子。说话像真人助理一样自然、利落、有温度，不端架子、不寒暄。

当前项目: 「${project?.name ?? "未命名"}」
当前商品品类: ${((project?.product as { category?: string[] } | null)?.category?.[0]) ?? "未分类"}
当前商品数据: ${JSON.stringify(project?.product ?? {}, null, 2)}

按品类撰写重点（根据上面的品类挑对应那一行）：
水果生鲜：产地、采摘时间、净重斤数、保鲜/冷链方式、坏果包赔
零食烘焙：保质期、配料表、口味档位、独立小包装
服饰鞋包：面料、尺码表、版型、洗涤说明、模特身高参考
美妆个护：核心成分、功效、适用肤质、备案/资质
家居日用：材质、尺寸、使用场景、保修
母婴儿童：适用年龄段、安全认证、材质安全性
其他：突出最强卖点和差异化

回复风格（务必遵守）：
- 全程纯文本中文，禁止使用任何 Markdown 符号（不要出现 *、**、#、- 列表、反引号、表格语法）
- 多条信息用"一、二、三"或直接换行分段，不要用项目符号
- 控制在 3 到 6 行内，简洁、像真人助理一样说话
- 不寒暄、不重复用户的话、不要"好的，我来帮你..."这种开场
- 自称"团宝"，不要说"AI"或"助手"

工作原则：
- 用户描述意图时，主动调用工具修改预览，不要只是回复文字
- 修改商品基础信息（标题、副标题、标签）调用 update_product
- 修改、新增或删除 SKU 调用 update_skus（传完整的 SKU 数组）
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
            update_product: tool({
              description:
                "更新商品的标题、副标题或标签。只传需要修改的字段；不要传 skus（用 update_skus）。",
              inputSchema: z.object({
                title: z.string().describe("新的商品标题，可选").optional(),
                subtitle: z.string().describe("新的副标题/卖点行，可选").optional(),
                tags: z.array(z.string()).describe("服务标签数组，可选，会整体替换").optional(),
              }),
              execute: async (input) => {
                const current = (project?.product ?? {}) as Record<string, unknown>;
                const next = { ...current, ...input };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ product: next })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, updated: Object.keys(input) };
              },
            }),
            update_skus: tool({
              description:
                "整体替换 SKU 列表。传完整的 SKU 数组，每项包含 name、price（字符串，元）、stock（字符串，件数）。",
              inputSchema: z.object({
                skus: z.array(SkuSchema).min(1).describe("完整的 SKU 数组"),
              }),
              execute: async ({ skus }) => {
                const current = (project?.product ?? {}) as Record<string, unknown>;
                const next = { ...current, skus };
                const { error } = await supabaseAdmin
                  .from("projects")
                  .update({ product: next })
                  .eq("id", projectId);
                if (error) return { ok: false, error: error.message };
                return { ok: true, count: skus.length };
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

// Silence unused-schema lint while keeping the export for future expansion.
void ProductPatchSchema;
