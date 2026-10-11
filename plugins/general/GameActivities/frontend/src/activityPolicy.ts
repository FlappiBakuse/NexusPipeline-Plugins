import type { Activity, TimePoint } from "./types";
export function instant(time: TimePoint | null | undefined): number | null {
  if (!time?.instantUtc) return null;
  const value = Date.parse(time.instantUtc); return Number.isFinite(value) ? value : null;
}
export const displayInstant = instant;
export function status(item: Activity, now: number): string {
  const start = instant(item.times.start), end = instant(item.times.playEnd);
  if (start !== null && end !== null && start >= end) return "unknown";
  if (end !== null && end <= now) return "ended";
  if (start !== null && start > now) return "upcoming";
  return start !== null && end !== null ? "ongoing" : "unknown";
}
export function countdown(deltaMs: number): { unit: string; first: number; second: number } {
  if (deltaMs <= 0) return { unit: "ended", first: 0, second: 0 };
  const seconds = Math.max(1, Math.floor(deltaMs / 1000));
  return deltaMs >= 259200000 ? { unit: "days", first: Math.floor(seconds / 86400), second: Math.floor(seconds % 86400 / 3600) }
    : deltaMs >= 3600000 ? { unit: "hours", first: Math.floor(seconds / 3600), second: Math.floor(seconds % 3600 / 60) }
    : deltaMs >= 60000 ? { unit: "minutes", first: Math.floor(seconds / 60), second: seconds % 60 }
    : { unit: "seconds", first: seconds, second: 0 };
}
export function order(items: Activity[], now: number): Activity[] {
  const states = ["ongoing", "upcoming", "unknown", "ended"];
  return [...items].sort((a, b) => {
    const sa = status(a, now), sb = status(b, now);
    const state = states.indexOf(sa) - states.indexOf(sb); if (state) return state;
    const time = (item: Activity) => sa === "ongoing" ? instant(item.times.playEnd) ?? Number.MAX_SAFE_INTEGER : sa === "upcoming" ? instant(item.times.start) ?? Number.MAX_SAFE_INTEGER : sa === "ended" ? -(instant(item.times.playEnd) ?? 0) : 0;
    return time(a) - time(b);
  });
}
