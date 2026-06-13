import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireUserId } from "@/lib/auth-session.server";

async function assertProjectOwner(projectId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("项目不存在");
  if (data.owner_id && data.owner_id !== userId) throw new Error("无权访问该项目");
}



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
  imageUrls: z.array(z.string().url()).max(9).optional(),
});

export const startProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StartProjectInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const planHint =
      data.mode === "plan"
        ? "用户选择了【计划模式】：只需完成品类、项目名、商品名和标签判断；进入编辑页后团宝会自动提出澄清问题。"
        : "用户选择了【立即开团】：只需完成品类、项目名、商品名和标签判断；进入编辑页后团宝会自动逐段撰写。";

    const OutputSchema = z.object({
      category: z.enum(CATEGORIES),
      projectName: z.string().min(2).max(60).transform((s) => s.slice(0, 18)),
      productName: z.string().min(2).max(120).transform((s) => s.slice(0, 30)),
      tags: z.array(z.string().min(1).max(20).transform((s) => s.slice(0, 10))).min(1).max(6),
    });

    const imageHint =
      data.imageUrls && data.imageUrls.length > 0
        ? `\n用户还上传了 ${data.imageUrls.length} 张商品图，可以结合图片内容判断品类与卖点：\n${data.imageUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n`
        : "";

    const { text: raw } = await generateText({
      model,
      prompt: `你是「团宝助手」的开团策划。用户刚刚提交了一段对想开的团购的描述，请你智能判断品类并准备好接下来在编辑页继续撰写所需的物料。

用户描述：
"""
${data.description}
"""
${imageHint}
${planHint}

只返回一个 JSON 对象（不要任何 Markdown 代码块、不要解释文字），结构如下：
{
  "category": 在 ${CATEGORIES.join(" / ")} 中挑一个最贴近的,
  "projectName": "给团长看的项目名，吸睛口语化，不超过 18 个汉字",
  "productName": "商品本身的名字，不超过 30 字",
  "tags": ["2 到 4 个服务或卖点短标签，每个不超过 10 字"]
}

所有文案使用纯文本中文，不要任何 Markdown 符号。`,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 返回格式异常，请重试");
    const output = OutputSchema.parse(JSON.parse(jsonMatch[0]));


    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({
        owner_id: userId,
        name: output.projectName,
        cover_image_url: data.imageUrls?.[0] ?? null,
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

    if (data.imageUrls && data.imageUrls.length > 0) {
      await supabaseAdmin.from("project_images").insert(
        data.imageUrls.map((url, i) => ({
          project_id: row.id,
          owner_id: userId,
          url,
          sort_order: i,
          role: "product",
        })),
      );
    }

    const seedParts: Array<
      { type: "text"; text: string } | { type: "file"; mediaType: string; url: string }
    > = [{ type: "text", text: data.description }];
    for (const url of data.imageUrls ?? []) {
      seedParts.push({ type: "file", mediaType: "image/*", url });
    }
    const seedMessages = [{
      id: `seed-${data.mode}-${Date.now()}`,
      role: "user" as const,
      parts: seedParts,
    }];

    return {
      id: row.id,
      seedMessages,
      category: output.category,
    };
  });


const UploadImageInput = z.object({
  projectId: z.string().uuid().optional(),
  filename: z.string().min(1).max(200),
  mimeType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/),
  dataBase64: z.string().min(1).max(15_000_000),
});

export const uploadProductImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UploadImageInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    if (data.projectId) await assertProjectOwner(data.projectId, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("图片超过 8MB");

    const extFromMime = data.mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
    const extFromName = data.filename.includes(".")
      ? data.filename.split(".").pop()!.toLowerCase()
      : "";
    const ext = (extFromName || extFromMime).slice(0, 5);
    // Path scoped by user so storage policies can be tightened later.
    const path = `${userId}/${data.projectId ?? "starter"}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "签发链接失败");

    return { url: signed.signedUrl, path };
  });




function pickFirstImagesFromIntro(intro: unknown, n = 3): string[] {
  const out: string[] = [];
  const blocks = (intro as { blocks?: Array<Record<string, unknown>> } | null)?.blocks;
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    if (out.length >= n) break;
    if (b?.type === "image_lg") {
      const url = typeof b.url === "string" ? b.url : "";
      if (url) out.push(url);
    } else if (b?.type === "image_sm") {
      const urls = Array.isArray(b.urls) ? (b.urls as unknown[]) : [];
      for (const u of urls) {
        if (out.length >= n) break;
        if (typeof u === "string" && u) out.push(u);
      }
    }
  }
  return out;
}

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: projects, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, status, cover_image_url, product, intro, updated_at, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (projects ?? []).map((p) => p.id);
  const imagesByProject: Record<string, string[]> = {};
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

  const enriched = (projects ?? []).map((p) => {
    const images = pickFirstImagesFromIntro(p.intro, 3);
    if (images.length < 3) {
      for (const u of imagesByProject[p.id] ?? []) {
        if (images.length >= 3) break;
        if (!images.includes(u)) images.push(u);
      }
    }
    if (images.length === 0 && p.cover_image_url) images.push(p.cover_image_url);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      cover_image_url: p.cover_image_url,
      product_name: (p.product as { name?: string } | null)?.name ?? "",
      updated_at: p.updated_at,
      created_at: p.created_at,
      images,
    };
  });

  return { projects: enriched };
});

const metaSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  product_name: z.string().max(120).optional(),
});

export const createProject = createServerFn({ method: "POST" })
  .inputValidator((d: { name?: string; product_name?: string }) => metaSchema.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({
        owner_id: userId,
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
    const userId = await requireUserId();
    await assertProjectOwner(data.id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("项目不存在");
    if (project.owner_id && project.owner_id !== userId) throw new Error("无权访问该项目");
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
    const userId = await requireUserId();
    await assertProjectOwner(data.id, userId);
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
    const userId = await requireUserId();
    await assertProjectOwner(data.id, userId);
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

