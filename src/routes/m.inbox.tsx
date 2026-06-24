import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Link2, Loader2, Type as TypeIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  createInboxItem,
  inboxUploadImage,
  listMyRecentProjects,
} from "@/lib/inbox.functions";
import logoMascot from "@/assets/logo-mascot.png.asset.json";

export const Route = createFileRoute("/m/inbox")({
  validateSearch: (search: Record<string, unknown>) => ({
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  head: () => ({
    meta: [
      { title: "团宝收料台" },
      {
        name: "viewport",
        content: "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover",
      },
      { name: "theme-color", content: "#fff7ed" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "团宝收料" },
    ],
  }),
  component: MobileInboxPage,
});


type Tab = "image" | "text" | "link";

function MobileInboxPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (hydrated && user === null) {
      navigate({ to: "/auth", replace: true, search: { redirect: "/m/inbox" } });
    }
  }, [hydrated, user, navigate]);

  if (!hydrated || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fff7ed] text-sm text-muted-foreground">
        {hydrated ? "正在跳转登录…" : null}
      </div>
    );
  }
  return <InboxScreen />;
}

function InboxScreen() {
  const { project: preselectedProject } = Route.useSearch();
  const [tab, setTab] = useState<Tab>("image");
  const [selectedProjectId, setSelectedProjectId] = useState<string | "new" | "">("");
  const [note, setNote] = useState("");
  const [preselectApplied, setPreselectApplied] = useState(false);

  const listProjects = useServerFn(listMyRecentProjects);
  const { data: projData } = useQuery({
    queryKey: ["m-recent-projects"],
    queryFn: () => listProjects(),
  });
  const projects = projData?.projects ?? [];

  useEffect(() => {
    if (!projData) return;
    // Honor ?project= from the desktop QR if it matches one of the user's projects.
    if (
      preselectedProject &&
      !preselectApplied &&
      projects.find((p) => p.id === preselectedProject)
    ) {
      setSelectedProjectId(preselectedProject);
      setPreselectApplied(true);
      return;
    }
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    } else if (!selectedProjectId && projects.length === 0) {
      setSelectedProjectId("new");
    }
  }, [projects, selectedProjectId, projData, preselectedProject, preselectApplied]);


  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff7ed] via-[#fff7ed] to-[#fde6c8] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-orange-100 bg-[#fff7ed]/95 backdrop-blur-xl">
        <div className="flex items-center gap-2 px-4 py-3">
          <img src={logoMascot.url} alt="团宝" className="h-8 w-8 rounded-lg object-cover" />
          <div className="flex-1">
            <div className="text-[15px] font-semibold leading-tight">收料台</div>
            <div className="text-[11px] text-muted-foreground">把素材丢给团宝，电脑端会自动生成文案</div>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-3 pb-2">
          {(
            [
              { k: "image", label: "图片", icon: ImagePlus },
              { k: "text", label: "文字", icon: TypeIcon },
              { k: "link", label: "链接", icon: Link2 },
            ] as const
          ).map((t) => {
            const active = tab === t.k;
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition",
                  active
                    ? "bg-gradient-to-r from-[oklch(0.78_0.18_55)] to-[oklch(0.62_0.22_35)] text-white shadow-sm"
                    : "bg-white/70 text-muted-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Body */}
      <div className="px-4 pt-4">
        {/* Project selector */}
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-semibold text-foreground">丢进哪个团？</div>
            <span className="text-[11px] text-muted-foreground">默认最近编辑</span>
          </div>
          <div className="-mx-1 flex flex-wrap gap-2">
            {projects.map((p) => {
              const active = selectedProjectId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={cn(
                    "max-w-[180px] truncate rounded-full border px-3 py-1.5 text-[12px] transition",
                    active
                      ? "border-transparent bg-[oklch(0.7_0.19_45)] text-white"
                      : "border-orange-100 bg-white text-muted-foreground",
                  )}
                >
                  {p.name}
                </button>
              );
            })}
            <button
              onClick={() => setSelectedProjectId("new")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] transition",
                selectedProjectId === "new"
                  ? "border-transparent bg-foreground text-background"
                  : "border-dashed border-orange-200 bg-white text-muted-foreground",
              )}
            >
              ＋ 新项目
            </button>
          </div>
          {selectedProjectId === "new" && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              暂不归属任何项目，到电脑端再决定要并入哪个团
            </p>
          )}
        </section>

        {/* Content area */}
        <section className="mt-4">
          {tab === "image" && (
            <ImageTab
              projectId={selectedProjectId === "new" ? null : (selectedProjectId as string)}
              note={note}
              onNoteChange={setNote}
            />
          )}
          {tab === "text" && (
            <TextTab
              projectId={selectedProjectId === "new" ? null : (selectedProjectId as string)}
            />
          )}
          {tab === "link" && (
            <LinkTab
              projectId={selectedProjectId === "new" ? null : (selectedProjectId as string)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// =================== 图片 Tab ===================

function ImageTab({
  projectId,
  note,
  onNoteChange,
}: {
  projectId: string | null;
  note: string;
  onNoteChange: (v: string) => void;
}) {
  const [files, setFiles] = useState<{ file: File; preview: string; url?: string; uploading?: boolean; error?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const upload = useServerFn(inboxUploadImage);
  const create = useServerFn(createInboxItem);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    const newOnes = Array.from(list).slice(0, 9 - files.length).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      uploading: true,
    }));
    setFiles((prev) => [...prev, ...newOnes]);

    for (const item of newOnes) {
      try {
        const dataBase64 = await fileToBase64(item.file);
        const { url } = await upload({
          data: {
            filename: item.file.name,
            mimeType: item.file.type || "image/jpeg",
            dataBase64,
          },
        });
        setFiles((prev) =>
          prev.map((p) => (p.preview === item.preview ? { ...p, url, uploading: false } : p)),
        );
      } catch (e) {
        setFiles((prev) =>
          prev.map((p) =>
            p.preview === item.preview ? { ...p, uploading: false, error: String(e) } : p,
          ),
        );
      }
    }
  };

  const uploadedUrls = files.map((f) => f.url).filter(Boolean) as string[];
  const ready = uploadedUrls.length > 0 && !files.some((f) => f.uploading);

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    try {
      await create({
        data: {
          projectId: projectId ?? null,
          kind: "image",
          payload: { urls: uploadedUrls },
          note: note.trim() || undefined,
        },
      });
      setDone(true);
      setFiles([]);
      onNoteChange("");
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <DoneCard onAgain={() => setDone(false)} />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {files.map((f) => (
          <div key={f.preview} className="relative aspect-square overflow-hidden rounded-xl border bg-white">
            <img src={f.preview} alt="" className="h-full w-full object-cover" />
            {f.uploading && (
              <div className="absolute inset-0 grid place-items-center bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
            {f.error && (
              <div className="absolute inset-0 grid place-items-center bg-red-500/70 px-2 text-center text-[10px] text-white">
                上传失败
              </div>
            )}
            <button
              onClick={() => setFiles((p) => p.filter((x) => x.preview !== f.preview))}
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {files.length < 9 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-orange-200 bg-white text-orange-400"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="可选：供应商在群里说了啥？随手粘一段（团宝会一起读）"
        rows={3}
        className="w-full rounded-xl border border-orange-100 bg-white p-3 text-[13px] outline-none focus:border-orange-300"
      />

      <SubmitBar disabled={!ready || submitting} loading={submitting} onClick={submit} />
    </div>
  );
}

// =================== 文字 Tab ===================

function TextTab({ projectId }: { projectId: string | null }) {
  const [text, setText] = useState("");
  const create = useServerFn(createInboxItem);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await create({
        data: {
          projectId: projectId ?? null,
          kind: "text",
          payload: { text: text.trim() },
        },
      });
      setDone(true);
      setText("");
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <DoneCard onAgain={() => setDone(false)} />;

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="把供应商发来的文字、笔记、卖点描述粘到这里…"
        rows={10}
        className="w-full rounded-2xl border border-orange-100 bg-white p-4 text-[14px] outline-none focus:border-orange-300"
      />
      <SubmitBar disabled={!text.trim() || submitting} loading={submitting} onClick={submit} />
    </div>
  );
}

// =================== 链接 Tab ===================

function LinkTab({ projectId }: { projectId: string | null }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const create = useServerFn(createInboxItem);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!isValidUrl(url)) return;
    setSubmitting(true);
    try {
      await create({
        data: {
          projectId: projectId ?? null,
          kind: "link",
          payload: { url: url.trim(), title: title.trim() || undefined },
        },
      });
      setDone(true);
      setUrl("");
      setTitle("");
    } catch (e) {
      alert(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <DoneCard onAgain={() => setDone(false)} />;

  return (
    <div className="space-y-3">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="贴链接（淘宝、拼多多、抖音、笔记…）"
        className="w-full rounded-xl border border-orange-100 bg-white p-3 text-[14px] outline-none focus:border-orange-300"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="可选：给这条链接起个备注"
        className="w-full rounded-xl border border-orange-100 bg-white p-3 text-[13px] outline-none focus:border-orange-300"
      />
      <SubmitBar disabled={!isValidUrl(url) || submitting} loading={submitting} onClick={submit} />
    </div>
  );
}

// =================== 通用组件 ===================

function SubmitBar({
  disabled,
  loading,
  onClick,
}: {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-orange-100 bg-[#fff7ed]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl">
      <Button
        disabled={disabled}
        onClick={onClick}
        className="h-12 w-full rounded-full bg-gradient-to-r from-[oklch(0.72_0.2_45)] to-[oklch(0.65_0.22_35)] text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_oklch(0.7_0.19_45/0.6)] hover:brightness-110"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 正在丢给团宝…
          </>
        ) : (
          "丢给团宝 →"
        )}
      </Button>
    </div>
  );
}

function DoneCard({ onAgain }: { onAgain: () => void }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-sm">
        <Check className="h-7 w-7" />
      </div>
      <div className="mt-4 text-[16px] font-semibold">团宝已收到 ☕</div>
      <p className="mt-1 text-[13px] text-muted-foreground">去电脑端打开项目，新版文案马上就好。</p>
      <Button
        variant="outline"
        onClick={onAgain}
        className="mt-5 h-10 rounded-full px-6 text-[13px]"
      >
        继续丢素材
      </Button>
    </div>
  );
}

// =================== 工具 ===================

function isValidUrl(s: string) {
  try {
    new URL(s.trim());
    return true;
  } catch {
    return false;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
