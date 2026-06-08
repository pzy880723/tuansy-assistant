import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { uploadProductImage } from "@/lib/projects.functions";

export type Attachment = {
  id: string;
  previewUrl: string;
  uploading: boolean;
  url?: string;
  mimeType?: string;
  error?: string;
};

const MAX_FILES = 9;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;

async function compressImage(file: File): Promise<{ blob: Blob; mimeType: string }> {
  if (!file.type.startsWith("image/")) return { blob: file, mimeType: file.type };
  // Skip compression for small files or unsupported (gif/svg) — preserve as-is.
  if (file.size < 400 * 1024 || file.type === "image/gif" || file.type === "image/svg+xml") {
    return { blob: file, mimeType: file.type };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, mimeType: file.type };
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!out) return { blob: file, mimeType: file.type };
    return { blob: out, mimeType: "image/jpeg" };
  } catch {
    return { blob: file, mimeType: file.type };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function useImageAttachments(opts?: { projectId?: string }) {
  const upload = useServerFn(uploadProductImage);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const addFiles = useCallback(
    async (incoming: FileList | File[] | null | undefined) => {
      if (!incoming) return;
      const all = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
      if (all.length === 0) return;

      const current = attachments.length;
      const room = Math.max(0, MAX_FILES - current);
      if (room === 0) {
        toast.error(`最多 ${MAX_FILES} 张图片`);
        return;
      }
      const accepted = all.slice(0, room);
      if (all.length > room) toast(`仅添加前 ${room} 张，已达上限 ${MAX_FILES}`);

      const pendings: Attachment[] = accepted
        .filter((f) => {
          if (f.size > MAX_BYTES) {
            toast.error(`${f.name} 超过 8MB，已跳过`);
            return false;
          }
          return true;
        })
        .map((f) => ({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          previewUrl: URL.createObjectURL(f),
          uploading: true,
          mimeType: f.type,
        }));

      if (pendings.length === 0) return;
      setAttachments((prev) => [...prev, ...pendings]);

      await Promise.all(
        accepted.slice(0, pendings.length).map(async (file, i) => {
          const att = pendings[i];
          try {
            const { blob, mimeType } = await compressImage(file);
            const base64 = await blobToBase64(blob);
            const res = await upload({
              data: {
                projectId: opts?.projectId,
                filename: file.name,
                mimeType,
                dataBase64: base64,
              },
            });
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === att.id ? { ...a, uploading: false, url: res.url, mimeType } : a,
              ),
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : "上传失败";
            toast.error(msg);
            setAttachments((prev) =>
              prev.map((a) => (a.id === att.id ? { ...a, uploading: false, error: msg } : a)),
            );
          }
        }),
      );
    },
    [attachments.length, opts?.projectId, upload],
  );

  const remove = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachments((prev) => {
      for (const a of prev) {
        if (a.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(a.previewUrl);
      }
      return [];
    });
  }, []);

  const getReadyUrls = useCallback(
    () => attachments.filter((a) => a.url && !a.uploading).map((a) => a.url!),
    [attachments],
  );

  const getReadyFiles = useCallback(
    () =>
      attachments
        .filter((a) => a.url && !a.uploading)
        .map((a) => ({ url: a.url!, mimeType: a.mimeType ?? "image/jpeg" })),
    [attachments],
  );

  const dragHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragActive(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      if (e.dataTransfer?.files?.length) void addFiles(e.dataTransfer.files);
    },
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const files: File[] = [];
    const items = e.clipboardData?.items;
    if (items) {
      for (const it of Array.from(items)) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f && f.type.startsWith("image/")) files.push(f);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const uploading = attachments.some((a) => a.uploading);

  return {
    attachments,
    dragActive,
    uploading,
    addFiles,
    remove,
    clear,
    getReadyUrls,
    getReadyFiles,
    dragHandlers,
    onPaste,
  };
}
