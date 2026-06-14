// Cross-pane image drag bus: chat side starts a drag with an image URL,
// preview side hit-tests and commits a drop. Pointer-driven (not HTML5 DnD)
// to work reliably across panels and portals.

import { useSyncExternalStore } from "react";

export type ImageDragState = {
  url: string;
  x: number;
  y: number;
  /** Natural width/height for ghost aspect (optional). */
  w?: number;
  h?: number;
} | null;

let state: ImageDragState = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Returns true if a drop was accepted. */
type DropHandler = (x: number, y: number, url: string) => boolean;
let dropHandler: DropHandler | null = null;

export const imageDragBus = {
  start(url: string, x: number, y: number, w?: number, h?: number) {
    state = { url, x, y, w, h };
    notify();
  },
  move(x: number, y: number) {
    if (!state) return;
    state = { ...state, x, y };
    notify();
  },
  end() {
    state = null;
    notify();
  },
  tryDrop(x: number, y: number): boolean {
    if (!state || !dropHandler) return false;
    try {
      return dropHandler(x, y, state.url);
    } catch {
      return false;
    }
  },
  get(): ImageDragState {
    return state;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  registerDropHandler(fn: DropHandler): () => void {
    dropHandler = fn;
    return () => {
      if (dropHandler === fn) dropHandler = null;
    };
  },
};

export function useImageDrag(): ImageDragState {
  return useSyncExternalStore(
    imageDragBus.subscribe,
    imageDragBus.get,
    () => null,
  );
}
