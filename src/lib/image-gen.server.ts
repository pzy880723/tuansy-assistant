// Server-only helpers for AI image generation via Lovable AI Gateway.
// Uses Gemini Nano Banana 2 (`google/gemini-3.1-flash-image-preview`) which supports
// both text-to-image and image editing with reference images.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const MODEL = "google/gemini-3.1-flash-image-preview";

export type GenerateOneInput = {
  prompt: string;
  /** Reference image URLs (https) the model should take inspiration from. */
  referenceImages?: string[];
};

/** Calls the Gateway once and returns the base64 PNG payload (no data: prefix). */
export async function generateOneImage(
  apiKey: string,
  { prompt, referenceImages }: GenerateOneInput,
): Promise<string> {
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const url of referenceImages ?? []) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`AI 生图失败 (${res.status}): ${text.slice(0, 300)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI 生图返回空数据");
  return b64;
}

/** Generates N images in parallel, returns array of base64 payloads. */
export async function generateImagesBatch(
  apiKey: string,
  input: GenerateOneInput,
  count: number,
): Promise<string[]> {
  const n = Math.max(1, Math.min(9, count));
  const results = await Promise.allSettled(
    Array.from({ length: n }, () => generateOneImage(apiKey, input)),
  );
  const ok: string[] = [];
  let firstErr: Error | null = null;
  for (const r of results) {
    if (r.status === "fulfilled") ok.push(r.value);
    else if (!firstErr) firstErr = r.reason as Error;
  }
  if (ok.length === 0 && firstErr) throw firstErr;
  return ok;
}

/** Uploads a base64 PNG to the product-images bucket and returns a signed URL. */
export async function uploadGeneratedImage(
  b64: string,
  userId: string,
  projectId: string,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = Buffer.from(b64, "base64");
  const path = `${userId}/${projectId}/ai-gen/${crypto.randomUUID()}.png`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("product-images")
    .upload(path, bytes, { contentType: "image/png", upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("product-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "签发链接失败");
  return signed.signedUrl;
}
