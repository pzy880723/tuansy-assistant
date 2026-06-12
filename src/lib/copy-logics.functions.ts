import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireUserId } from "@/lib/auth-session.server";

const MODULE_TYPES = [
  "title",
  "paragraph",
  "image_large",
  "image_grid",
  "video",
  "params",
] as const;
export type CopyModuleType = (typeof MODULE_TYPES)[number];

const ModuleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(MODULE_TYPES),
  label: z.string().min(1).max(40),
  guidance: z.string().max(1000),
});

export type CopyModule = z.infer<typeof ModuleSchema>;

export const FormattingSchema = z.object({
  paragraphMode: z
    .enum(["natural", "one-sentence-per-line", "period-only"])
    .default("natural"),
  lineGap: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(1),
  indentFirstLine: z.boolean().optional(),
  headBlankLines: z.number().int().min(0).max(10).default(0),
  tailBlankLines: z.number().int().min(0).max(10).default(0),
  emojiDensity: z.enum(["none", "light", "rich"]).default("light"),
});
export type CopyFormatting = z.infer<typeof FormattingSchema>;
export const DEFAULT_FORMATTING: CopyFormatting = {
  paragraphMode: "natural",
  lineGap: 1,
  headBlankLines: 0,
  tailBlankLines: 0,
  emojiDensity: "light",
};

export type CopyLogic = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  modules: CopyModule[];
  formatting: CopyFormatting;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function assertOwner(id: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("copy_logics")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("文案逻辑不存在");
  if (data.user_id !== userId) throw new Error("无权访问该文案逻辑");
}

export const listCopyLogics = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("copy_logics")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { logics: (data ?? []) as unknown as CopyLogic[] };
});

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  description: z.string().max(8000).default(""),
  modules: z.array(ModuleSchema).max(40).default([]),
  formatting: FormattingSchema.optional(),
  is_active: z.boolean().optional(),
});

export const upsertCopyLogic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.id) {
      await assertOwner(data.id, userId);
      const { data: row, error } = await supabaseAdmin
        .from("copy_logics")
        .update({
          name: data.name,
          description: data.description,
          modules: data.modules,
          ...(data.formatting !== undefined ? { formatting: data.formatting } : {}),
          ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
        })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { logic: row as unknown as CopyLogic };
    }

    const { data: row, error } = await supabaseAdmin
      .from("copy_logics")
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description,
        modules: data.modules,
        formatting: data.formatting ?? DEFAULT_FORMATTING,
        is_active: data.is_active ?? false,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { logic: row as unknown as CopyLogic };
  });


export const deleteCopyLogic = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    await assertOwner(data.id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("copy_logics")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setActiveCopyLogic = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; active?: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    await assertOwner(data.id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nextActive = data.active ?? true;
    const { error } = await supabaseAdmin
      .from("copy_logics")
      .update({ is_active: nextActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, is_active: nextActive };
  });


function rid() {
  return Math.random().toString(36).slice(2, 10);
}

const MODULE_TYPE_HINT = `模块 type 含义：
- title: 强力吸睛主标题（10-20 字）
- paragraph: 一段正文（痛点共鸣 / 品牌背书 / 卖点拆解 / 款式参数等都用 paragraph）
- image_large: 单张大图，对应一个段落
- image_grid: 九宫格小图，呈现细节或对比
- video: 视频展示
- params: 颜色、尺码、参数表`;

export const generateModulesFromText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(60),
        description: z.string().min(1).max(8000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireUserId();
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const ItemSchema = z.object({
      type: z.enum(MODULE_TYPES),
      label: z.string(),
      guidance: z.string(),
    });

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      maxOutputTokens: 4000,
      prompt: `你在帮一位团长设计「文案撰写逻辑」模板，名称叫「${data.name}」。
团长用自然语言描述了他写文案想遵守的整套思路：
"""
${data.description}
"""

把这套思路拆成有序的模块清单（3-15 个）。每个模块包含 type、label（不超过 12 字）、guidance（60-200 字，纯文本无 Markdown）。
${MODULE_TYPE_HINT}
默认骨架可参考：标题 → 痛点 → 品牌背书 → 卖点拆解 → 款式参数；忠实于团长描述的特殊要求与品类侧重。

只输出一个 JSON 对象，形如：
{"modules":[{"type":"title","label":"标题","guidance":"..."}, ...]}
不要包裹 \`\`\` 代码块，不要任何额外文字。`,
    });

    // Tolerant JSON extraction
    let raw = text.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const objStart = raw.indexOf("{");
    const objEnd = raw.lastIndexOf("}");
    if (objStart === -1 || objEnd <= objStart) {
      throw new Error("AI 返回内容无法解析为 JSON，请重试或简化描述");
    }
    const parsed = JSON.parse(raw.slice(objStart, objEnd + 1)) as {
      modules?: unknown;
    };
    const list = z.array(ItemSchema).parse(parsed.modules ?? []);
    const trimmed = list
      .map((m) => ({
        type: m.type,
        label: (m.label ?? "").trim().slice(0, 40) || "模块",
        guidance: (m.guidance ?? "").trim().slice(0, 800),
      }))
      .slice(0, 15);
    return {
      modules: trimmed.map((m) => ({ id: rid(), ...m })) as CopyModule[],
    };
  });

export const generateTextFromModules = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(60),
        modules: z.array(ModuleSchema).min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireUserId();
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const list = data.modules
      .map(
        (m, i) =>
          `${i + 1}. [${m.type}] ${m.label}\n   要点：${m.guidance || "（未填）"}`,
      )
      .join("\n");

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      prompt: `这是团长「${data.name}」文案逻辑的模块清单：
${list}

请把它总结成一段连贯的自然语言描述，让别人一眼就明白这套文案的撰写思路、节奏、重点。要求：
- 200-500 字，纯中文，无 Markdown
- 按模块顺序讲解，强调每段重点和情绪
- 不要逐字复述 guidance，要提炼概括`,
    });
    return { description: text.trim() };
  });
