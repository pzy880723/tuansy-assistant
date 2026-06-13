import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/export-project")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim();
        if (!token || token.length < 8 || token.length > 200) {
          return json(400, { error: "missing token" });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tokenRow, error: tokenErr } = await supabaseAdmin
          .from("export_tokens")
          .select("project_id, expires_at")
          .eq("token", token)
          .maybeSingle();
        if (tokenErr) return json(500, { error: tokenErr.message });
        if (!tokenRow) return json(404, { error: "token 不存在或已被撤销" });
        if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
          return json(410, { error: "token 已过期，请回团宝重新生成" });
        }

        const { data: project, error: pErr } = await supabaseAdmin
          .from("projects")
          .select(
            "id, name, status, cover_image_url, intro, product, skus, delivery, schedule, settings",
          )
          .eq("id", tokenRow.project_id)
          .maybeSingle();
        if (pErr) return json(500, { error: pErr.message });
        if (!project) return json(404, { error: "项目不存在" });

        const { data: images } = await supabaseAdmin
          .from("project_images")
          .select("url, role, sort_order")
          .eq("project_id", tokenRow.project_id)
          .order("sort_order", { ascending: true });

        return json(200, {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            category: (project.product as { category?: string[] })?.category ?? [],
          },
          intro: project.intro,
          product: project.product,
          skus: project.skus,
          delivery: project.delivery,
          schedule: project.schedule,
          settings: project.settings,
          cover_image_url: project.cover_image_url,
          images: images ?? [],
        });
      },
    },
  },
});
