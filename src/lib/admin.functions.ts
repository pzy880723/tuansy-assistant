import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-session.server";
import type { CopyModule } from "@/lib/copy-logics.functions";
import type { PresetCopyLogic } from "@/lib/presets.functions";

async function requireAdmin(): Promise<string> {
  const userId = await requireUserId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("无权访问：仅管理员可使用");
  return userId;
}

export const checkIsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireAdmin();
    return { isAdmin: true as const };
  } catch {
    return { isAdmin: false as const };
  }
});

// ============ Dashboard ============

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [users, projects, copies, recentUsers] = await Promise.all([
    supabaseAdmin.from("app_users").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("projects").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("copy_versions").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);
  return {
    totalUsers: users.count ?? 0,
    totalProjects: projects.count ?? 0,
    totalCopies: copies.count ?? 0,
    newUsers7d: recentUsers.count ?? 0,
  };
});

export const getCopyTrend = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 30 * 86400000);
  since.setHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin
    .from("copy_versions")
    .select("created_at")
    .gte("created_at", since.toISOString());
  if (error) throw new Error(error.message);
  const bucket = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    bucket.set(key, 0);
  }
  for (const row of data ?? []) {
    const d = new Date(row.created_at as string);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (bucket.has(key)) bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  return {
    trend: Array.from(bucket.entries()).map(([day, count]) => ({ day, count })),
  };
});

// ============ Users ============

export type AdminUserRow = {
  id: string;
  phone: string | null;
  wechat_openid: string | null;
  nickname: string;
  created_at: string;
  is_banned: boolean;
  is_admin: boolean;
  project_count: number;
  copy_count: number;
};

export const adminListUsers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("app_users")
      .select("id, phone, wechat_openid, nickname, created_at, is_banned", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      query = query.or(`phone.ilike.%${s}%,nickname.ilike.%${s}%`);
    }
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: users, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const ids = (users ?? []).map((u) => u.id);
    if (ids.length === 0) {
      return { users: [] as AdminUserRow[], total: count ?? 0 };
    }
    const [roles, projects, copies] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("projects").select("owner_id").in("owner_id", ids),
      supabaseAdmin.from("copy_versions").select("owner_id").in("owner_id", ids),
    ]);

    const adminSet = new Set(
      (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    const projectMap = new Map<string, number>();
    for (const p of projects.data ?? []) {
      if (p.owner_id) projectMap.set(p.owner_id, (projectMap.get(p.owner_id) ?? 0) + 1);
    }
    const copyMap = new Map<string, number>();
    for (const c of copies.data ?? []) {
      if (c.owner_id) copyMap.set(c.owner_id, (copyMap.get(c.owner_id) ?? 0) + 1);
    }

    const rows: AdminUserRow[] = (users ?? []).map((u) => ({
      id: u.id,
      phone: u.phone,
      wechat_openid: u.wechat_openid,
      nickname: u.nickname,
      created_at: u.created_at,
      is_banned: !!u.is_banned,
      is_admin: adminSet.has(u.id),
      project_count: projectMap.get(u.id) ?? 0,
      copy_count: copyMap.get(u.id) ?? 0,
    }));
    return { users: rows, total: count ?? 0 };
  });

export const adminSetBan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireAdmin();
    if (data.userId === me) throw new Error("不能封禁自己");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_users")
      .update({ is_banned: data.banned })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    // Revoke active sessions on ban
    if (data.banned) {
      await supabaseAdmin
        .from("app_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", data.userId)
        .is("revoked_at", null);
    }
    return { ok: true };
  });

export const adminSetAdminRole = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await requireAdmin();
    if (data.userId === me && !data.isAdmin) {
      throw new Error("不能撤销自己的管理员身份");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
    }
    return { ok: true };
  });

// ============ Presets management ============

const ModuleSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["title", "paragraph", "image_large", "image_grid", "video", "params"]),
  label: z.string().min(1).max(40),
  guidance: z.string().max(1000),
});

export const adminListPresets = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("preset_copy_logics")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { presets: (data ?? []) as PresetCopyLogic[] };
});

export const adminUpsertPreset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().min(1).max(60).regex(/^[a-z0-9_-]+$/),
        name: z.string().min(1).max(60),
        industry: z.string().max(40).default(""),
        description: z.string().max(8000).default(""),
        modules: z.array(ModuleSchema).max(40).default([]),
        sort_order: z.number().int().default(0),
        is_published: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("preset_copy_logics")
        .update({
          slug: data.slug,
          name: data.name,
          industry: data.industry,
          description: data.description,
          modules: data.modules as unknown as CopyModule[],
          sort_order: data.sort_order,
          is_published: data.is_published,
        })
        .eq("id", data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { preset: row as PresetCopyLogic };
    }
    const { data: row, error } = await supabaseAdmin
      .from("preset_copy_logics")
      .insert({
        slug: data.slug,
        name: data.name,
        industry: data.industry,
        description: data.description,
        modules: data.modules as unknown as CopyModule[],
        sort_order: data.sort_order,
        is_published: data.is_published,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { preset: row as PresetCopyLogic };
  });

export const adminDeletePreset = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("preset_copy_logics")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Audit ============

export const adminListProjects = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: projects, count, error } = await supabaseAdmin
      .from("projects")
      .select("id, name, status, owner_id, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const ownerIds = Array.from(new Set((projects ?? []).map((p) => p.owner_id).filter(Boolean) as string[]));
    const { data: owners } = ownerIds.length
      ? await supabaseAdmin.from("app_users").select("id, phone, nickname").in("id", ownerIds)
      : { data: [] as Array<{ id: string; phone: string | null; nickname: string }> };
    const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]));
    const rows = (projects ?? []).map((p) => ({
      ...p,
      owner: p.owner_id ? ownerMap.get(p.owner_id) ?? null : null,
    }));
    return { projects: rows, total: count ?? 0 };
  });

export const adminListCopyVersions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: versions, count, error } = await supabaseAdmin
      .from("copy_versions")
      .select("id, project_id, label, owner_id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const projIds = Array.from(new Set((versions ?? []).map((v) => v.project_id)));
    const ownerIds = Array.from(new Set((versions ?? []).map((v) => v.owner_id).filter(Boolean) as string[]));
    const [projs, owners] = await Promise.all([
      projIds.length
        ? supabaseAdmin.from("projects").select("id, name").in("id", projIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      ownerIds.length
        ? supabaseAdmin.from("app_users").select("id, phone, nickname").in("id", ownerIds)
        : Promise.resolve({ data: [] as Array<{ id: string; phone: string | null; nickname: string }> }),
    ]);
    const projMap = new Map((projs.data ?? []).map((p) => [p.id, p]));
    const ownerMap = new Map((owners.data ?? []).map((o) => [o.id, o]));
    const rows = (versions ?? []).map((v) => ({
      ...v,
      project: projMap.get(v.project_id) ?? null,
      owner: v.owner_id ? ownerMap.get(v.owner_id) ?? null : null,
    }));
    return { versions: rows, total: count ?? 0 };
  });
