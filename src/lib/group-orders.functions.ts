import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-session.server";

async function assertOwner(projectId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, name, intro, skus, delivery, cover_image_url, owner_id, product")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) throw new Error("项目不存在");
  if (data.owner_id && data.owner_id !== userId) throw new Error("无权访问该项目");
  return data;
}

export const createGroupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), endsAt: z.string().datetime().optional() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const project = await assertOwner(data.projectId, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newSlug } = await import("@/lib/quickbuy.server");

    // Close any existing active group orders for this project so there's only one live.
    await supabaseAdmin
      .from("group_orders")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("project_id", data.projectId)
      .eq("status", "active");

    // Generate unique slug (retry up to 5 times).
    let slug = "";
    for (let i = 0; i < 5; i++) {
      const s = newSlug();
      const { data: dup } = await supabaseAdmin.from("group_orders").select("id").eq("slug", s).maybeSingle();
      if (!dup) { slug = s; break; }
    }
    if (!slug) throw new Error("生成短链失败，请重试");

    const { data: row, error } = await supabaseAdmin
      .from("group_orders")
      .insert({
        project_id: data.projectId,
        owner_id: userId,
        slug,
        status: "active",
        title: project.name,
        cover_image_url: project.cover_image_url,
        snapshot_intro: project.intro,
        snapshot_skus: project.skus,
        snapshot_delivery: project.delivery,
        ends_at: data.endsAt ?? null,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, slug: row.slug };
  });

export const closeGroupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("group_orders")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reopenGroupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    // Equivalent to "open a new one" reusing latest snapshot from current project state.
    const userId = await requireUserId();
    const project = await assertOwner(data.projectId, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newSlug } = await import("@/lib/quickbuy.server");
    let slug = "";
    for (let i = 0; i < 5; i++) {
      const s = newSlug();
      const { data: dup } = await supabaseAdmin.from("group_orders").select("id").eq("slug", s).maybeSingle();
      if (!dup) { slug = s; break; }
    }
    if (!slug) throw new Error("生成短链失败");
    const { data: row, error } = await supabaseAdmin
      .from("group_orders")
      .insert({
        project_id: data.projectId,
        owner_id: userId,
        slug,
        status: "active",
        title: project.name,
        cover_image_url: project.cover_image_url,
        snapshot_intro: project.intro,
        snapshot_skus: project.skus,
        snapshot_delivery: project.delivery,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, slug: row.slug };
  });

export const getActiveGroupOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("group_orders")
      .select("id, slug, status, title, cover_image_url, started_at, ends_at, closed_at, view_count, order_count, items_sold, gmv_cents")
      .eq("project_id", data.projectId)
      .eq("owner_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { group: row ?? null };
  });

export const listGroupOrders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({}).optional().parse(d ?? {}))
  .handler(async () => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("group_orders")
      .select("id, slug, status, title, cover_image_url, project_id, started_at, ends_at, closed_at, view_count, order_count, items_sold, gmv_cents")
      .eq("owner_id", userId)
      .order("started_at", { ascending: false })
      .limit(100);
    const groups = data ?? [];
    const projectIds = Array.from(new Set(groups.map((g) => g.project_id)));
    const firstImage: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: imgs } = await supabaseAdmin
        .from("project_images")
        .select("project_id, url, sort_order")
        .in("project_id", projectIds)
        .order("sort_order", { ascending: true });
      for (const r of imgs ?? []) {
        if (!firstImage[r.project_id]) firstImage[r.project_id] = r.url;
      }
    }
    return {
      groups: groups.map((g) => ({
        ...g,
        cover_image_url: g.cover_image_url ?? firstImage[g.project_id] ?? null,
      })),
    };
  });
