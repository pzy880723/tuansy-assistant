import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  count: z.number().int().min(1).max(9),
  referenceImages: z.array(z.string().url()).max(3).optional(),
  projectId: z.string().uuid(),
  variant: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch (e) {
          return new Response((e as Error).message, { status: 400 });
        }

        const { readSessionUserIdFromRequest } = await import("@/lib/auth-session.server");
        const userId = await readSessionUserIdFromRequest(request);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner } = await supabaseAdmin
          .from("projects")
          .select("owner_id")
          .eq("id", body.projectId)
          .maybeSingle();
        if (!owner) return new Response("Project not found", { status: 404 });
        if (owner.owner_id && owner.owner_id !== userId) {
          return new Response("Forbidden", { status: 403 });
        }

        const { generateImagesBatch, uploadGeneratedImage } = await import(
          "@/lib/image-gen.server"
        );

        try {
          const finalPrompt = body.variant
            ? `${body.prompt}\n\n[variation hint: ${body.variant}]`
            : body.prompt;
          const b64s = await generateImagesBatch(
            key,
            { prompt: finalPrompt, referenceImages: body.referenceImages },
            body.count,
          );
          const urls = await Promise.all(
            b64s.map((b) => uploadGeneratedImage(b, userId, body.projectId)),
          );
          return Response.json({ urls });
        } catch (e) {
          const err = e as Error & { status?: number };
          const status = err.status === 429 || err.status === 402 ? err.status : 500;
          return new Response(err.message || "生图失败", { status });
        }
      },
    },
  },
});
