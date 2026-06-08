import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, status, cover_image_url, updated_at, created_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { projects: data ?? [] };
});

export const createProject = createServerFn({ method: "POST" })
  .inputValidator((d: { name?: string }) =>
    z.object({ name: z.string().min(1).max(120).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("projects")
      .insert({ name: data.name ?? "未命名项目" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
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
    const { error } = await supabaseAdmin.from("projects").update(data.patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
