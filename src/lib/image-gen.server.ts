// Server-only helpers for AI image generation via Lovable AI Gateway.
// - No reference images -> OpenAI `openai/gpt-image-2` (image2, photoreal default).
// - With reference images -> Google `google/gemini-2.5-flash-image` (Nano Banana).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const OPENAI_MODEL = "openai/gpt-image-2";
const GEMINI_MODEL = "google/gemini-2.5-flash-image";

const REALISM_SUFFIX =
  "Ultra-realistic professional product photography, natural lighting, true-to-life materials and textures, sharp focus, shallow depth of field, photo-realistic, DSLR shot, no cartoon, no illustration, no 3D render, no plastic look, no oversaturation.";

export type GenerateOneInput = {
  prompt: string;
  /** Reference image URLs (https) the model should take inspiration from. */
  referenceImages?: string[];
};

type GatewayError = Error & { status?: number; code?: string };

function gatewayHeaders(apiKey: string) {
  return {
    "Lovable-API-Key": apiKey,
    "Content-Type": "application/json",
  };
}

function buildError(status: number, text: string): GatewayError {
  let code: string | undefined;
  try {
    const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
    if (parsed.error?.code) code = parsed.error.code;
    if (parsed.error?.message) text = parsed.error.message;
  } catch {
    /* not JSON */
  }
  const err = new Error(`AI 生图失败 (${status}): ${text.slice(0, 400)}`) as GatewayError;
  err.status = status;
  err.code = code;
  return err;
}

function withRealism(prompt: string): string {
  return `${prompt}\n\n${REALISM_SUFFIX}`;
}

async function callOpenAIImage(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt: withRealism(prompt),
      quality: "low",
      size: "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw buildError(res.status, text);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI 生图返回空数据");
  return b64;
}

async function callGeminiImage(
  apiKey: string,
  prompt: string,
  referenceImages: string[],
): Promise<string> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: withRealism(prompt) },
  ];
  for (const url of referenceImages) {
    content.push({ type: "image_url", image_url: { url } });
  }
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw buildError(res.status, text);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI 生图返回空数据");
  return b64;
}

/** Opens a single-image streaming generation request and returns the upstream SSE response. */
export async function createImageGenerationStream(
  apiKey: string,
  { prompt, referenceImages }: GenerateOneInput,
): Promise<Response> {
  const refs = referenceImages ?? [];
  const hasReferences = refs.length > 0;
  const body = hasReferences
    ? {
        model: GEMINI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: withRealism(prompt) },
              ...refs.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
        modalities: ["image", "text"],
        stream: true,
      }
    : {
        model: OPENAI_MODEL,
        prompt: withRealism(prompt),
        quality: "low",
        size: "1024x1024",
        n: 1,
        stream: true,
        partial_images: 1,
      };

  return fetch(GATEWAY_URL, {
    method: "POST",
    headers: gatewayHeaders(apiKey),
    body: JSON.stringify(body),
  });
}

/** Calls the Gateway once and returns the base64 PNG payload (no data: prefix). */
export async function generateOneImage(
  apiKey: string,
  { prompt, referenceImages }: GenerateOneInput,
): Promise<string> {
  if (referenceImages && referenceImages.length > 0) {
    return callGeminiImage(apiKey, prompt, referenceImages);
  }
  return callOpenAIImage(apiKey, prompt);
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
  let firstErr: GatewayError | null = null;
  for (const r of results) {
    if (r.status === "fulfilled") ok.push(r.value);
    else if (!firstErr) firstErr = r.reason as GatewayError;
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
