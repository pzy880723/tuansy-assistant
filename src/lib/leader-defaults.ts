// Defaults & helpers for the 团长 (group leader) avatar/name/background.
import type { IntroData } from "@/components/tuan/types";

const LEADER_NAMES = [
  "团团妈",
  "小美选物",
  "邻居老王",
  "甜甜的店",
  "阿May 严选",
  "果果妈优选",
  "楼下小卖部",
  "懒猫严选",
  "丸子家",
  "妞妞奶奶",
];

/** Deterministic pick from a list, seeded by a string (project id). */
function pickFromSeed<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

export function defaultLeaderName(projectId: string): string {
  return pickFromSeed(LEADER_NAMES, projectId);
}

export function defaultLeaderAvatar(projectId: string): string {
  // DiceBear deterministic avatar — no upload required.
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(projectId)}&backgroundColor=ffd5dc,c0aede,b6e3f4,ffdfbf,d1d4f9`;
}

/** Returns a patched intro with non-empty leader_name / leader_avatar.
 *  Caller is responsible for triggering image generation for the background. */
export function fillLeaderDefaults(intro: IntroData, projectId: string): IntroData {
  const next: IntroData = { ...intro };
  if (!next.leader_name || !next.leader_name.trim()) {
    next.leader_name = defaultLeaderName(projectId);
  }
  if (!next.leader_avatar) {
    next.leader_avatar = defaultLeaderAvatar(projectId);
  }
  return next;
}
