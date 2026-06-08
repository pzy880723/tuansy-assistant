import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
