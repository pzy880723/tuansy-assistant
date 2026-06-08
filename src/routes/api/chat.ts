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
          system: `你是「团宝助手」，帮助快团团团长编辑团购项目内容。

当前项目: 「${project?.name ?? "未命名"}」
当前商品数据: ${JSON.stringify(project?.product ?? {}, null, 2)}

工作原则：
- 用户描述意图时，主动调用工具修改预览，不要只是回复文字
- 修改商品基础信息（标题、副标题、标签）调用 update_product
- 修改、新增或删除 SKU 调用 update_skus（传完整的 SKU 数组）
- 修改后用一句中文简短确认所做改动
- 价格保留 1 位小数，库存为整数字符串
- 不确定时主动询问用户`,
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
