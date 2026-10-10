import type { Activity, Feed, TimePoint } from "./types";
export function instant(time: TimePoint | null | undefined): number | null {
  if (!time?.instantUtc || !["confirmed", "reported"].includes(time.certainty) || time.timeBasis === "unknown" || !["second", "minute"].includes(time.precision)) return null;
  const value = Date.parse(time.instantUtc); return Number.isFinite(value) ? value : null;
}
export function status(item: Activity, now: number): string {
  const start = instant(item.times.start), end = instant(item.times.playEnd);
  if (end !== null && end <= now) return "ended";
  if (start !== null && start > now) return "upcoming";
  return "ongoing";
}
export function countdown(deltaMs: number): { unit: string; first: number; second: number } {
  if (deltaMs <= 0) return { unit: "ended", first: 0, second: 0 };
  const seconds = Math.max(1, Math.floor(deltaMs / 1000));
  return deltaMs >= 259200000 ? { unit: "days", first: Math.floor(seconds / 86400), second: Math.floor(seconds % 86400 / 3600) }
    : deltaMs >= 3600000 ? { unit: "hours", first: Math.floor(seconds / 3600), second: Math.floor(seconds % 3600 / 60) }
    : deltaMs >= 60000 ? { unit: "minutes", first: Math.floor(seconds / 60), second: seconds % 60 }
    : { unit: "seconds", first: seconds, second: 0 };
}
const importance = (item: Activity) => ["major-story", "story", "featured-gameplay", "routine", "unknown"].indexOf(item.importance);
export const isGacha = (item: Activity) => item.category.startsWith("gacha-");
export function order(items: Activity[], now: number): Activity[] {
  const states = ["ongoing", "upcoming", "ended", "unknown"];
  return [...items].sort((a, b) => {
    const sa = status(a, now), sb = status(b, now);
    const section = Number(isGacha(b)) - Number(isGacha(a)); if (section) return section;
    const state = states.indexOf(sa) - states.indexOf(sb); if (state) return state;
    const time = (item: Activity) => sa === "ongoing" ? instant(item.times.playEnd) ?? Number.MAX_SAFE_INTEGER : sa === "upcoming" ? instant(item.times.start) ?? Number.MAX_SAFE_INTEGER : sa === "ended" ? -(instant(item.times.playEnd) ?? 0) : 0;
    const byTime = time(a) - time(b); if (byTime) return byTime;
    if (sa === "ongoing") { const rank = importance(a) - importance(b); if (rank) return rank; const start = (instant(a.times.start) ?? Number.MAX_SAFE_INTEGER) - (instant(b.times.start) ?? Number.MAX_SAFE_INTEGER); if (start) return start; }
    if (sa === "unknown") { const title = compare(a.title.normalize(), b.title.normalize()); if (title) return title; }
    return compare(a.eventId, b.eventId);
  });
}
function compare(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }
export function primary(feed: Feed, now: number): Activity | null {
  const rank = (item: Activity) => {
    if (isGacha(item) || ["shop", "battle-pass"].includes(item.category) || !item.provenance.some(p => p.field === "/importance")) return 99;
    const state = status(item, now), current = Boolean(feed.contentPeriod && feed.contentPeriod.key === item.periodKey && item.versionRelation === "current");
    const featured = item.isOfficialFeatured && item.provenance.some(p => p.field === "/isOfficialFeatured");
    if (state === "ongoing" && current) { const tier = ["major-story", "story", "featured-gameplay"].indexOf(item.importance); if (tier >= 0) return tier + 1; }
    if (state === "ongoing" && featured && ["major-story", "story"].includes(item.importance)) return 4;
    if (state === "ongoing" && (featured || item.importance === "featured-gameplay") && ["combat", "exploration", "minigame"].includes(item.category)) return 5;
    if (state === "upcoming" && current && ["major-story", "story"].includes(item.importance)) return 6;
    return 99;
  };
  return feed.activities.filter(item => rank(item) < 99).sort((a, b) => rank(a) - rank(b)
    || Number(b.isOfficialFeatured && b.provenance.some(p => p.field === "/isOfficialFeatured")) - Number(a.isOfficialFeatured && a.provenance.some(p => p.field === "/isOfficialFeatured"))
    || Number(a.availability === "permanent") - Number(b.availability === "permanent")
    || (instant(a.times.playEnd) ?? Number.MAX_SAFE_INTEGER) - (instant(b.times.playEnd) ?? Number.MAX_SAFE_INTEGER)
    || (instant(b.times.start) ?? 0) - (instant(a.times.start) ?? 0) || compare(a.eventId, b.eventId))[0] ?? null;
}

