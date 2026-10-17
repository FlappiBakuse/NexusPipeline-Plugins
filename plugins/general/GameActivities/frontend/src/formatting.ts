import { displayInstant } from "./activityPolicy";
import type { ActivityHost, Feed, TimePoint } from "./types";

export function translator(host: ActivityHost) {
  return (key: string, args: Record<string, unknown> = {}) => host.i18n.t(key, args, key);
}

export function formatTime(time: TimePoint | null | undefined, host: ActivityHost, zone?: string): string {
  const value = displayInstant(time);
  if (value === null) {
    const label = host.i18n.t("time.unverified");
    return time?.rawValue ? `${label} · ${time.rawValue}` : label;
  }
  const formatted = new Intl.DateTimeFormat(host.i18n.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zone,
  }).format(value);
  if (time?.timeBasis !== "source-default") return formatted;
  const sourceZone = time.sourceZone === "Asia/Shanghai" ? "UTC+8" : time.sourceZone === "Asia/Tokyo" ? "UTC+9" : time.sourceZone;
  return `${formatted} · ${host.i18n.t("time.sourceDefault", { zone: sourceZone })}`;
}

export function versionLabel(feed: Feed | undefined | null, host: ActivityHost): string {
  const t = translator(host);
  if (feed?.overview?.number) return `${t("version.label")} ${feed.overview.number}`;
  return t("version.unverified");
}
