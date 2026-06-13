import { flushSync } from "react-dom";

type ImageStreamPayload = {
  type?: string;
  b64_json?: string;
};

export function userFacingImageError(status: number, text: string) {
  if (status === 401) return "登录状态失效，请刷新页面重新登录";
  if (status === 402) return "AI 额度已用完，请联系管理员充值";
  if (status === 429) return "请求太频繁，请稍后再试";
  return `生图失败 (${status}): ${text.slice(0, 160) || "请稍后重试"}`;
}

export async function readImageStream(
  res: Response,
  onFrame?: (dataUrl: string, isFinal: boolean) => void,
): Promise<string> {
  if (!res.body) throw new Error("生图流为空");
  let buffer = "";
  let finalB64 = "";
  let sawCompleted = false;

  const consumeBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    let eventName = "";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const raw = dataLines.join("\n");
    if (!raw || raw === "[DONE]") return;
    let payload: ImageStreamPayload;
    try {
      payload = JSON.parse(raw) as ImageStreamPayload;
    } catch {
      return;
    }
    const type = eventName || payload.type || "";
    if (
      type !== "image_generation.partial_image" &&
      type !== "image_generation.completed"
    )
      return;
    if (!payload.b64_json) return;
    const isFinal = type === "image_generation.completed";
    if (isFinal) {
      finalB64 = payload.b64_json;
      sawCompleted = true;
    }
    if (onFrame) {
      flushSync(() => onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal));
    }
  };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      blocks.forEach(consumeBlock);
    }
    if (buffer.trim()) consumeBlock(buffer);
  } finally {
    reader.cancel().catch(() => undefined);
  }
  if (!sawCompleted || !finalB64) throw new Error("图片生成中断，请重试");
  return finalB64;
}
