import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserId } from "@/lib/auth-session.server";
import {
  DEFAULT_FORMATTING,
  type CopyFormatting,
  type CopyLogic,
  type CopyModule,
} from "@/lib/copy-logics.functions";

export type PresetCopyLogic = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  description: string;
  modules: CopyModule[];
  formatting: CopyFormatting;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export const listPresetCopyLogics = createServerFn({ method: "GET" }).handler(async () => {
  await requireUserId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("preset_copy_logics")
    .select("*")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return { presets: (data ?? []) as unknown as PresetCopyLogic[] };
});

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

export const copyPresetToMine = createServerFn({ method: "POST" })
  .inputValidator((d: { presetId: string }) =>
    z.object({ presetId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: preset, error: pErr } = await supabaseAdmin
      .from("preset_copy_logics")
      .select("name, description, modules")
      .eq("id", data.presetId)
      .eq("is_published", true)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!preset) throw new Error("预设不存在或已下架");

    // Clone modules with fresh ids so user can edit freely
    const modules: CopyModule[] = ((preset.modules ?? []) as CopyModule[]).map((m) => ({
      ...m,
      id: rid(),
    }));

    const { count } = await supabaseAdmin
      .from("copy_logics")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { data: row, error } = await supabaseAdmin
      .from("copy_logics")
      .insert({
        user_id: userId,
        name: `${preset.name}（我的副本）`,
        description: preset.description,
        modules,
        is_active: (count ?? 0) === 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { logic: row as unknown as CopyLogic };
  });
