// Lightweight pub/sub for "manual edit happened in the preview pane" events.
// Used to mirror right-side edits into the left-side chat (system messages + history).

export type ManualEditPayload = {
  field: string; // e.g. "intro.title", "skus", "settings.delivery"
  label: string; // human-readable Chinese label
  snapshot: {
    name?: string;
    product?: unknown;
    intro?: unknown;
    skus?: unknown;
    settings?: unknown;
  };
};

const evt = (projectId: string) => `tuanbao:manual-edit:${projectId}`;

export function emitManualEdit(projectId: string, payload: ManualEditPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(evt(projectId), { detail: payload }));
}

export function onManualEdit(
  projectId: string,
  cb: (p: ManualEditPayload) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const ce = e as CustomEvent<ManualEditPayload>;
    if (ce.detail) cb(ce.detail);
  };
  window.addEventListener(evt(projectId), handler);
  return () => window.removeEventListener(evt(projectId), handler);
}
