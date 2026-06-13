import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-session.server";

// ---------- 列出团长最近的项目（手机端选择器用） ----------
export const listMyRecentProjects = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("id, name, updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return { projects: data ?? [] };
});

// ---------- 创建一条收料记录 ----------
const PayloadSchema = z.object({
  // image
  urls: z.array(z.string().url()).max(20).optional(),
  // text
  text: z.string().max(8000).optional(),
  // link
  url: z.string().url().max(2000).optional(),
  title: z.string().max(300).optional(),
});

const CreateInput = z.object({
  projectId: z.string().uuid().nullable().optional(),
  kind: z.enum(["image", "text", "link"]),
  payload: PayloadSchema,
  note: z.string().max(500).optional(),
});

export const createInboxItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 校验：若 projectId 存在则必须属于本人
    if (data.projectId) {
      const { data: p } = await supabaseAdmin
        .from("projects")
        .select("owner_id")
        .eq("id", data.projectId)
        .maybeSingle();
      if (!p || (p.owner_id && p.owner_id !== userId)) {
        throw new Error("无权写入该项目");
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("inbox_items")
      .insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        kind: data.kind,
        payload: data.payload,
        note: data.note ?? null,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    // 若关联了项目，触发项目 updated_at 刷新（用于电脑端排序）
    if (data.projectId) {
      await supabaseAdmin
        .from("projects")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.projectId);
    }

    return { id: row.id, created_at: row.created_at };
  });

// ---------- 上传手机端图片（base64） ----------
const UploadInput = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/),
  dataBase64: z.string().min(1).max(15_000_000),
});

export const inboxUploadImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UploadInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("图片超过 8MB");

    const extFromMime = data.mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
    const extFromName = data.filename.includes(".")
      ? data.filename.split(".").pop()!.toLowerCase()
      : "";
    const ext = (extFromName || extFromMime).slice(0, 5);
    const path = `${userId}/inbox/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "签发链接失败");

    return { url: signed.signedUrl };
  });

// ---------- 电脑端：按项目聚合 pending 数量（红点用） ----------
export const listPendingInboxCounts = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("inbox_items")
    .select("project_id")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  const byProject: Record<string, number> = {};
  let unassigned = 0;
  for (const row of data ?? []) {
    if (row.project_id) {
      byProject[row.project_id] = (byProject[row.project_id] ?? 0) + 1;
    } else {
      unassigned += 1;
    }
  }
  return { byProject, unassigned, total: (data ?? []).length };
});

// ---------- 电脑端：获取某项目的 pending 素材 ----------
export const listProjectPendingInbox = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: items, error } = await supabaseAdmin
      .from("inbox_items")
      .select("id, kind, payload, note, created_at")
      .eq("user_id", userId)
      .eq("project_id", data.projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { items: items ?? [] };
  });

// ---------- 电脑端：将 pending 标记为 consumed（团宝处理完之后调用） ----------
export const markInboxConsumed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("inbox_items")
      .update({ status: "consumed", processed_at: new Date().toISOString() })
      .in("id", data.ids)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
