import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireUserId } from "@/lib/auth-session.server";

const CreateInput = z.object({ projectId: z.string().uuid() });

export const createExportToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // verify ownership
    const { data: project, error: pErr } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("项目不存在");
    if (project.owner_id && project.owner_id !== userId) throw new Error("无权访问该项目");

    const token = randomBytes(24).toString("base64url");
    const { error } = await supabaseAdmin.from("export_tokens").insert({
      token,
      user_id: userId,
      project_id: data.projectId,
    });
    if (error) throw new Error(error.message);

    return { token, expiresInMinutes: 30 };
  });

const RevokeInput = z.object({ token: z.string().min(1).max(200) });

export const revokeExportToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RevokeInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("export_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", userId);
    return { ok: true };
  });
