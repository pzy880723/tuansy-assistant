import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const CATEGORIES = [
  "水果生鲜",
  "零食烘焙",
  "家居日用",
  "美妆个护",
  "服饰鞋包",
  "母婴儿童",
  "其他",
] as const;

const StartProjectInput = z.object({
  description: z.string().min(1).max(4000),
  mode: z.enum(["draft", "plan"]),
});

export const startProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StartProjectInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const planHint =
      data.mode === "plan"
        ? "用户选择了【计划模式】：不要立即撰写文案，seedAssistantText 要先抛出 3 到 5 个针对该品类的关键澄清问题（如目标人群、价格档位、产地/材质、配送方式等），帮助用户先想清楚再动笔。autoUserPrompt 必须为 null。"
        : "用户选择了【立即开团】：seedAssistantText 是一句不超过 60 字的开场，告诉用户你已经识别出品类、马上动笔。autoUserPrompt 是一段 30 到 80 字的隐形指令，作为用户的第一条消息触发 AI 立刻调用 update_product 与 update_skus 生成首版标题、卖点、标签和 SKU。";

    const { experimental_output: output } = await generateText({
      model,
      experimental_output: Output.object({
        schema: z.object({
          category: z.enum(CATEGORIES),
          projectName: z.string().min(2).max(18),
          productName: z.string().min(2).max(30),
          tags: z.array(z.string().min(1).max(10)).min(2).max(4),
          seedAssistantText: z.string().min(10).max(260),
          autoUserPrompt: z.string().max(200).nullable(),
          suggestNext: z.array(z.string().min(2).max(18)).min(2).max(4),
        }),
      }),

      prompt: `你是「团宝助手」的开团策划。用户刚刚提交了一段对想开的团购的描述，请你智能判断品类并准备好接下来在编辑页继续撰写所需的物料。

用户描述：
"""
${data.description}
"""

${planHint}

要求：
一、category 从给定枚举里挑一个最贴近的；
二、projectName 是给团长自己看的项目名，要吸睛、口语化、不超过 18 个字，比如「云南阳光玫瑰团」「春夏宽松直筒裤」；
三、productName 是商品本身的名字；
四、tags 给 2 到 4 个最能打动顾客的服务/卖点短标签，每个不超过 10 字；
五、所有文案使用纯文本中文，不要任何 Markdown 符号；
六、suggestNext 给 2 到 4 条用户进入编辑页后可能想点的快捷指令，每条不超过 18 字。`,
    });

    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({
        name: output.projectName,
        product: {
          name: output.productName,
          category: [output.category],
          description: data.description,
          tags: output.tags,
          weight: null,
          video_url: "",
          spec_groups: [],
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const seedMessages = [
      {
        id: `seed-assistant-${Date.now()}`,
        role: "assistant" as const,
        parts: [
          { type: "text" as const, text: output.seedAssistantText },
          {
            type: "tool-suggest_next" as const,
            toolCallId: `seed-suggest-${Date.now()}`,
            state: "output-available" as const,
            input: { suggestions: output.suggestNext },
            output: { ok: true, suggestions: output.suggestNext },
          },
        ],
      },
    ];

    return {
      id: row.id,
      seedMessages,
      autoUserPrompt: output.autoUserPrompt,
      category: output.category,
    };
  });


export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, status, cover_image_url, product, updated_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (projects ?? []).map((p) => p.id);
  let imagesByProject: Record<string, string[]> = {};
  if (ids.length > 0) {
    const { data: imgs } = await supabaseAdmin
      .from("project_images")
      .select("project_id, url, sort_order")
      .in("project_id", ids)
      .order("sort_order", { ascending: true });
    for (const row of imgs ?? []) {
      const arr = imagesByProject[row.project_id] ?? (imagesByProject[row.project_id] = []);
      if (arr.length < 3) arr.push(row.url);
    }
  }

  const enriched = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    cover_image_url: p.cover_image_url,
    product_name: (p.product as { name?: string } | null)?.name ?? "",
    updated_at: p.updated_at,
    created_at: p.created_at,
    images: imagesByProject[p.id] ?? [],
  }));

  return { projects: enriched };
});

const metaSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  product_name: z.string().max(120).optional(),
});

export const createProject = createServerFn({ method: "POST" })
  .inputValidator((d: { name?: string; product_name?: string }) => metaSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({
        name: data.name ?? "未命名项目",
        product: {
          name: data.product_name ?? "",
          category: [],
          description: "",
          tags: [],
          weight: null,
          video_url: "",
          spec_groups: [],
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("项目不存在");
    const { data: images } = await supabaseAdmin
      .from("project_images")
      .select("*")
      .eq("project_id", data.id)
      .order("sort_order", { ascending: true });
    return { project, images: images ?? [] };
  });

export const updateProject = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) =>
    z.object({ id: z.string().uuid(), patch: z.record(z.string(), z.unknown()) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").update(data.patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProjectMeta = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name?: string; product_name?: string }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      product_name: z.string().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur, error: ge } = await supabaseAdmin
      .from("projects")
      .select("product")
      .eq("id", data.id)
      .maybeSingle();
    if (ge) throw new Error(ge.message);
    if (!cur) throw new Error("项目不存在");

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.product_name !== undefined) {
      const prod = (cur.product as Record<string, unknown> | null) ?? {};
      patch.product = { ...prod, name: data.product_name };
    }
    const { error } = await supabaseAdmin
      .from("projects")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
