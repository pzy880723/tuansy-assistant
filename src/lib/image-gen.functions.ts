import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-session.server";

const UploadGeneratedImageInput = z.object({
  b64: z.string().min(100).max(20_000_000),
  projectId: z.string().uuid(),
});

export const uploadAiGeneratedImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UploadGeneratedImageInput.parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: owner, error } = await supabaseAdmin
      .from("projects")
      .select("owner_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!owner) throw new Error("项目不存在");
    if (owner.owner_id && owner.owner_id !== userId) throw new Error("无权访问该项目");

    const { uploadGeneratedImage } = await import("@/lib/image-gen.server");
    const url = await uploadGeneratedImage(data.b64, userId, data.projectId);

    // 入素材库（AI 生成）
    const { data: maxRow } = await supabaseAdmin
      .from("project_images")
      .select("sort_order")
      .eq("project_id", data.projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxRow?.sort_order ?? -1) + 1;
    await supabaseAdmin.from("project_images").insert({
      project_id: data.projectId,
      owner_id: userId,
      url,
      sort_order: nextOrder,
      role: "product",
      source: "ai",
    } as never);

    return { url };
  });
